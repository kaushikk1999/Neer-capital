/**
 * Bounded, resumable chunking.
 *
 * A 60-page research report will not fit in one model call, and retrying the
 * whole document because page 40 failed is wasteful and non-idempotent. We cut
 * the document into page-aligned chunks, hash each chunk's input, and persist
 * results per chunk. A retry re-uses every chunk whose inputHash still matches
 * and only re-runs the ones that failed.
 *
 * Chunks are page-aligned deliberately: evidence cites page numbers, so a
 * chunk boundary must never fall inside a page.
 */

import { createHash } from "crypto"
import type { ParsedDocument, ParsedPage } from "@/worker/parser/layout-parser"
import type { ReconstructedTable } from "@/worker/parser/table-reconstruct"

export interface ChunkLimits {
  /** Soft cap on characters per chunk; a single oversized page still ships alone. */
  maxCharsPerChunk: number
  /** Hard cap on pages per chunk, so evidence stays locatable. */
  maxPagesPerChunk: number
  /** Refuse pathological documents rather than melting the budget. */
  maxChunks: number
}

export const DEFAULT_CHUNK_LIMITS: ChunkLimits = {
  maxCharsPerChunk: 18000,
  maxPagesPerChunk: 6,
  maxChunks: 40,
}

export interface DocumentChunk {
  index: number
  pageStart: number
  pageEnd: number
  /** Text handed to the model, page-delimited so it can cite pages. */
  text: string
  charCount: number
  /** Stable hash of the chunk input; a matching hash means a cached result is reusable. */
  inputHash: string
  /** Tables falling inside this page range, for table-cell evidence. */
  tables: ReconstructedTable[]
}

export interface ChunkPlan {
  chunks: DocumentChunk[]
  /** True when the document exceeded maxChunks and was not fully covered. */
  truncated: boolean
  pagesCovered: number
  totalPages: number
}

function renderPage(page: ParsedPage): string {
  return `--- PAGE ${page.pageNumber} ---\n${page.text}`
}

function hashChunk(pageStart: number, pageEnd: number, text: string): string {
  return createHash("sha256")
    .update(`${pageStart}:${pageEnd}:`)
    .update(text)
    .digest("hex")
    .slice(0, 32)
}

/**
 * Splits a parsed document into chunks.
 *
 * A page is never split. If one page alone exceeds the char cap it becomes its
 * own chunk rather than being truncated — losing the tail of a page would lose
 * evidence silently.
 */
export function planChunks(
  doc: ParsedDocument,
  tables: ReconstructedTable[] = [],
  limits: Partial<ChunkLimits> = {}
): ChunkPlan {
  const cfg = { ...DEFAULT_CHUNK_LIMITS, ...limits }
  const chunks: DocumentChunk[] = []

  let buffer: ParsedPage[] = []
  let bufferChars = 0

  const flush = () => {
    if (buffer.length === 0) return
    const pageStart = buffer[0].pageNumber
    const pageEnd = buffer[buffer.length - 1].pageNumber
    const text = buffer.map(renderPage).join("\n\n")
    chunks.push({
      index: chunks.length,
      pageStart,
      pageEnd,
      text,
      charCount: text.length,
      inputHash: hashChunk(pageStart, pageEnd, text),
      tables: tables.filter((t) => t.pageNumber >= pageStart && t.pageNumber <= pageEnd),
    })
    buffer = []
    bufferChars = 0
  }

  for (const page of doc.pages) {
    const rendered = renderPage(page)

    // Oversized single page: emit it alone, uncut.
    if (rendered.length >= cfg.maxCharsPerChunk) {
      flush()
      buffer = [page]
      bufferChars = rendered.length
      flush()
      if (chunks.length >= cfg.maxChunks) break
      continue
    }

    const wouldExceedChars = bufferChars + rendered.length > cfg.maxCharsPerChunk
    const wouldExceedPages = buffer.length + 1 > cfg.maxPagesPerChunk
    if (buffer.length > 0 && (wouldExceedChars || wouldExceedPages)) {
      flush()
      if (chunks.length >= cfg.maxChunks) break
    }

    buffer.push(page)
    bufferChars += rendered.length + 2
  }

  if (chunks.length < cfg.maxChunks) flush()

  const pagesCovered = chunks.reduce((sum, c) => sum + (c.pageEnd - c.pageStart + 1), 0)
  return {
    chunks: chunks.slice(0, cfg.maxChunks),
    truncated: pagesCovered < doc.pages.length,
    pagesCovered,
    totalPages: doc.pages.length,
  }
}

export interface CachedChunk {
  index: number
  inputHash: string
  status: string
  extractedPayload: unknown
}

export interface ResumeDecision {
  /** Chunks whose persisted result is still valid and can be re-used as-is. */
  reusable: CachedChunk[]
  /** Chunks that must be (re-)extracted. */
  pending: DocumentChunk[]
}

/**
 * Decides what a retry actually needs to do. A cached chunk is only reused when
 * it completed AND its input hash still matches — otherwise the document
 * changed underneath us and the cached answer is not about this input.
 */
export function planResume(plan: ChunkPlan, cached: CachedChunk[]): ResumeDecision {
  const byIndex = new Map(cached.map((c) => [c.index, c]))
  const reusable: CachedChunk[] = []
  const pending: DocumentChunk[] = []

  for (const chunk of plan.chunks) {
    const prior = byIndex.get(chunk.index)
    if (prior && prior.status === "DONE" && prior.inputHash === chunk.inputHash && prior.extractedPayload) {
      reusable.push(prior)
    } else {
      pending.push(chunk)
    }
  }

  return { reusable, pending }
}

/** Lease window for a claimed chunk; an expired lease may be taken over. */
export const CHUNK_LEASE_MS = 5 * 60 * 1000

export function leaseExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + CHUNK_LEASE_MS)
}

export function isLeaseExpired(leaseExpiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!leaseExpiresAt) return true
  return leaseExpiresAt.getTime() <= now.getTime()
}
