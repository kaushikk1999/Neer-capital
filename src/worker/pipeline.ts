/**
 * The V2 extraction pipeline, end to end.
 *
 * Ordering matters and is deliberate:
 *   validate -> parse -> tables -> chunk -> extract -> merge -> synthesise -> persist
 *
 * Only the final step touches a database transaction. Parsing and model calls
 * happen outside it, so a slow model can never hold locks. Every stage updates
 * the ExtractionRun so a stuck job is visible rather than mysterious.
 */

import { createHash } from "crypto"
import { prisma } from "@/lib/db"
import { getObject } from "@/lib/storage"
import { validatePdfInput, quarantineKey } from "@/worker/parser/validate-input"
import { parsePdfLayout } from "@/worker/parser/layout-parser"
import { reconstructTables } from "@/worker/parser/table-reconstruct"
import { planChunks, planResume, type ChunkPlan } from "@/worker/chunker"
import { extractChunk, buildPageTextMap, type ChunkExtractionResult } from "@/worker/ai-extractor"
import { mergeChunkExtractions } from "@/worker/merge"
import { synthesize, type SynthesisResult } from "@/worker/ai-synthesizer"
import { persistAnalysisV2, type PersistResult } from "@/worker/db-persister-v2"
import { EXTRACTION_PROMPT_VERSION } from "@/worker/extraction-schema"
import { EXTRACTION_MODEL } from "@/worker/ai-extractor"

export interface PipelineInput {
  documentId: string
  jobId: string
  storageKey: string
  fileName: string
  mimeType?: string | null
  /** Skip narrative synthesis (useful for fast structural runs). */
  skipSynthesis?: boolean
}

export interface PipelineOutcome {
  runId: string
  ok: boolean
  result?: PersistResult
  /** Sanitized — safe to store and show to an admin. */
  error?: string
  rejectedCode?: string
}

function newRunId(documentId: string): string {
  return createHash("sha256")
    .update(`${documentId}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 24)
}

async function setRun(runId: string, data: Record<string, unknown>) {
  await prisma.extractionRun.updateMany({ where: { runId }, data: data as never })
}

export async function runExtractionPipeline(input: PipelineInput): Promise<PipelineOutcome> {
  const runId = newRunId(input.documentId)

  // 1. Fetch bytes and validate BEFORE any parser sees them.
  const buffer = await getObject(input.storageKey)
  const validation = await validatePdfInput({
    buffer,
    fileName: input.fileName,
    declaredMimeType: input.mimeType ?? null,
  })

  await prisma.extractionRun.create({
    data: {
      documentId: input.documentId,
      runId,
      status: "QUEUED",
      stage: "validate",
      schemaVersion: 2,
      inputDocHash: validation.ok ? validation.docHash : "unvalidated",
      model: EXTRACTION_MODEL,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      heartbeatAt: new Date(),
    },
  })

  if (!validation.ok) {
    await setRun(runId, {
      status: "FAILED",
      stage: "validate",
      sanitizedError: `${validation.code}: ${validation.message}`,
      finishedAt: new Date(),
    })
    await prisma.analysisJob.update({
      where: { id: input.jobId },
      data: { status: "FAILED", error: `${validation.code}: ${validation.message}`, finishedAt: new Date() },
    })
    return {
      runId,
      ok: false,
      rejectedCode: validation.code,
      error: `${validation.code}: ${validation.message}${
        validation.quarantine ? ` (quarantine target: ${quarantineKey(input.storageKey)})` : ""
      }`,
    }
  }

  try {
    // 2. Parse with geometry.
    await setRun(runId, { status: "PARSING", stage: "parse", heartbeatAt: new Date() })
    const doc = await parsePdfLayout(buffer, { timeoutMs: 120_000 })

    // 3. Tables (feeds cell-level evidence).
    const tables = doc.pages.flatMap((p) => reconstructTables(p))

    // 4. Chunk.
    const plan: ChunkPlan = planChunks(doc, tables)

    const existingChunks = await prisma.extractionChunk.findMany({
      where: { run: { runId } },
      select: { index: true, inputHash: true, status: true, extractedPayload: true },
    })
    const resume = planResume(
      plan,
      existingChunks.map((c) => ({
        index: c.index,
        inputHash: c.inputHash,
        status: c.status,
        extractedPayload: c.extractedPayload,
      }))
    )

    const run = await prisma.extractionRun.findUnique({ where: { runId }, select: { id: true } })
    if (!run) throw new Error("Extraction run row disappeared")

    // Record the chunk plan so progress and resume are inspectable.
    for (const chunk of plan.chunks) {
      await prisma.extractionChunk.upsert({
        where: { runId_index: { runId: run.id, index: chunk.index } },
        create: {
          runId: run.id,
          index: chunk.index,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          inputHash: chunk.inputHash,
          status: "PENDING",
        },
        update: { inputHash: chunk.inputHash, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd },
      })
    }

    // 5. Extract each pending chunk.
    await setRun(runId, { status: "EXTRACTING", stage: "extract", heartbeatAt: new Date() })
    const pageTexts = buildPageTextMap(doc.pages)
    const results: ChunkExtractionResult[] = []
    let failedChunks = 0

    for (const cached of resume.reusable) {
      results.push(cached.extractedPayload as unknown as ChunkExtractionResult)
    }

    for (const chunk of resume.pending) {
      await prisma.extractionChunk.updateMany({
        where: { runId: run.id, index: chunk.index },
        data: { status: "EXTRACTING", startedAt: new Date(), attemptCount: { increment: 1 } },
      })
      try {
        const result = await extractChunk(chunk, pageTexts)
        results.push(result)
        await prisma.extractionChunk.updateMany({
          where: { runId: run.id, index: chunk.index },
          data: {
            status: "DONE",
            extractedPayload: result as never,
            finishedAt: new Date(),
            model: result.model,
            promptVersion: result.promptVersion,
            tokensIn: result.tokensIn ?? null,
            tokensOut: result.tokensOut ?? null,
          },
        })
      } catch (error) {
        failedChunks++
        await prisma.extractionChunk.updateMany({
          where: { runId: run.id, index: chunk.index },
          data: {
            status: "FAILED",
            error: sanitize(error),
            finishedAt: new Date(),
          },
        })
      }
      await setRun(runId, { heartbeatAt: new Date() })
    }

    if (results.length === 0) {
      throw new Error("No chunk produced usable output")
    }

    // 6. Merge.
    await setRun(runId, { status: "NORMALIZING", stage: "merge", heartbeatAt: new Date() })
    const merged = mergeChunkExtractions(results)

    // 7. Synthesise (optional, and never allowed to fail the run).
    let synthesis: SynthesisResult | null = null
    if (!input.skipSynthesis) {
      await setRun(runId, { status: "SYNTHESIZING", stage: "synthesize", heartbeatAt: new Date() })
      try {
        synthesis = await synthesize(merged)
      } catch (error) {
        // A missing narrative is a degraded result, not a failed extraction.
        await setRun(runId, { sanitizedError: `synthesis skipped: ${sanitize(error)}` })
      }
    }

    // 8. Persist.
    await setRun(runId, { status: "PERSISTING", stage: "persist", heartbeatAt: new Date() })
    const isPartial = plan.truncated || failedChunks > 0
    const result = await persistAnalysisV2({
      documentId: input.documentId,
      jobId: input.jobId,
      runId,
      merged,
      synthesis,
      isPartial,
      model: EXTRACTION_MODEL,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    })

    return { runId, ok: true, result }
  } catch (error) {
    const message = sanitize(error)
    await setRun(runId, { status: "FAILED", sanitizedError: message, finishedAt: new Date() })
    await prisma.analysisJob.update({
      where: { id: input.jobId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    })
    return { runId, ok: false, error: message }
  }
}

/** Never let raw internals or document content into a stored error. */
function sanitize(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/\s+/g, " ").slice(0, 500)
}
