/**
 * Stage 2: factual extraction.
 *
 * Sends one chunk to the model and returns what the report *states*, with a
 * verbatim quote and page for every claim. Two guarantees matter here:
 *
 *  1. The model never computes. Derived figures come from calc.ts later, so a
 *     number on screen is either quoted from the report or has a formula.
 *  2. Every quote is checked against the text of the page it cites. A quote we
 *     cannot find is kept but marked UNVERIFIED, so fabricated evidence cannot
 *     masquerade as a verbatim source excerpt.
 */

import { Ollama } from "ollama"
import {
  ChunkExtractionSchema,
  EXTRACTION_PROMPT_VERSION,
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  type ChunkExtraction,
} from "@/worker/extraction-schema"
import type { DocumentChunk } from "@/worker/chunker"
import { verifyQuote, type EvidenceVerifyT } from "@/lib/analysis/quote-verify"

const OLLAMA_URL =
  process.env.OLLAMA_BASE_URL || process.env.OLLAMA_API_URL || "https://api.ollama.com"
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || ""
export const EXTRACTION_MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud"

const ollama = new Ollama({
  host: OLLAMA_URL,
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${OLLAMA_KEY}` },
    }),
})

export interface QuoteCheck {
  /** Where the claim said it came from. */
  citedPage: number | null
  status: EvidenceVerifyT
  normalizedQuote: string
}

export interface ChunkExtractionResult {
  chunkIndex: number
  pageStart: number
  pageEnd: number
  data: ChunkExtraction
  /** Verification outcome per quoted item, keyed "<kind>:<index>". */
  quoteChecks: Record<string, QuoteCheck>
  attempts: number
  model: string
  promptVersion: string
  tokensIn?: number
  tokensOut?: number
  durationMs: number
}

export class ChunkExtractionError extends Error {
  constructor(
    message: string,
    readonly chunkIndex: number,
    readonly attempts: number
  ) {
    super(message)
    this.name = "ChunkExtractionError"
  }
}

/** Some models wrap JSON in a markdown fence even when asked for raw JSON. */
function stripFence(content: string): string {
  const t = content.trim()
  if (!t.startsWith("```")) return t
  return t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

/**
 * Verifies one quote against the page it claims to come from. Page-scoped on
 * purpose: a sentence found elsewhere in the document is not evidence for a
 * claim cited to this page.
 */
function checkQuote(
  quote: string | null | undefined,
  citedPage: number | null,
  pageTexts: Map<number, string>
): QuoteCheck {
  if (!quote || !quote.trim()) {
    return { citedPage, status: "UNVERIFIED", normalizedQuote: "" }
  }
  const pageText = citedPage != null ? pageTexts.get(citedPage) : undefined
  const result = verifyQuote(quote, pageText ?? "")
  return { citedPage, status: result.status, normalizedQuote: result.normalizedQuote }
}

function verifyAll(data: ChunkExtraction, pageTexts: Map<number, string>): Record<string, QuoteCheck> {
  const checks: Record<string, QuoteCheck> = {}

  if (data.identity) {
    checks["identity:0"] = checkQuote(data.identity.identityQuote, data.identity.identityPage, pageTexts)
  }
  if (data.valuation) {
    checks["valuation:0"] = checkQuote(data.valuation.valuationQuote, data.valuation.valuationPage, pageTexts)
  }
  data.metrics.forEach((m, i) => {
    checks[`metric:${i}`] = checkQuote(m.sourceQuote, m.sourcePage, pageTexts)
  })
  data.risks.forEach((r, i) => {
    checks[`risk:${i}`] = checkQuote(r.sourceQuote, r.sourcePage, pageTexts)
  })
  data.catalysts.forEach((c, i) => {
    checks[`catalyst:${i}`] = checkQuote(c.sourceQuote, c.sourcePage, pageTexts)
  })
  data.thesisPoints.forEach((t, i) => {
    checks[`thesis:${i}`] = checkQuote(t.sourceQuote, t.sourcePage, pageTexts)
  })
  data.sections.forEach((s, i) => {
    checks[`section:${i}`] = checkQuote(s.sourceQuote, s.sourcePage, pageTexts)
  })

  return checks
}

export interface ExtractChunkOptions {
  maxAttempts?: number
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * Extracts one chunk. Retries a malformed generation a bounded number of times
 * (the model is stochastic), then fails loudly so the chunk can be retried or
 * the run marked PARTIAL — it never returns a half-parsed result.
 */
export async function extractChunk(
  chunk: DocumentChunk,
  pageTexts: Map<number, string>,
  options: ExtractChunkOptions = {}
): Promise<ChunkExtractionResult> {
  const maxAttempts = options.maxAttempts ?? 2
  const started = Date.now()
  const systemPrompt = buildExtractionSystemPrompt()
  const userPrompt = buildExtractionUserPrompt(chunk.text, chunk.pageStart, chunk.pageEnd)

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Awaited<ReturnType<typeof ollama.chat>>
    try {
      response = await ollama.chat({
        model: EXTRACTION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        options: { temperature: 0 },
      })
    } catch (error) {
      // A transport/API failure is not a parsing problem — surface it as-is.
      throw new ChunkExtractionError(
        `Model request failed for chunk ${chunk.index}: ${error instanceof Error ? error.message : String(error)}`,
        chunk.index,
        attempt
      )
    }

    try {
      const parsed = JSON.parse(stripFence(response.message.content))
      const data = ChunkExtractionSchema.parse(parsed)
      return {
        chunkIndex: chunk.index,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        data,
        quoteChecks: verifyAll(data, pageTexts),
        attempts: attempt,
        model: EXTRACTION_MODEL,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        tokensIn: (response as { prompt_eval_count?: number }).prompt_eval_count,
        tokensOut: (response as { eval_count?: number }).eval_count,
        durationMs: Date.now() - started,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw new ChunkExtractionError(
    `Chunk ${chunk.index} produced non-conforming output after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    chunk.index,
    maxAttempts
  )
}

/** Convenience: page number -> page text, for quote verification. */
export function buildPageTextMap(pages: { pageNumber: number; text: string }[]): Map<number, string> {
  return new Map(pages.map((p) => [p.pageNumber, p.text]))
}

/** Share of quoted claims that could be located on the page they cite. */
export function quoteVerificationRate(checks: Record<string, QuoteCheck>): number {
  const values = Object.values(checks)
  if (values.length === 0) return 0
  const ok = values.filter((c) => c.status === "EXACT_MATCH" || c.status === "NORMALIZED_MATCH").length
  return Math.round((ok / values.length) * 100) / 100
}
