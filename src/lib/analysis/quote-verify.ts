/**
 * Page-scoped verification that a quoted excerpt actually appears in the PDF.
 *
 * PDF text extraction mangles text in predictable ways: words are split across
 * line breaks with hyphens, ligatures become single glyphs, quotes become
 * typographic variants, and soft hyphens hide inside words. We normalize both
 * sides before comparing so a genuine quote is not rejected on cosmetics.
 *
 * An unmatched quote is never deleted. It is preserved and marked UNVERIFIED,
 * and the UI must not present it as exact verbatim evidence.
 */

export type EvidenceVerifyT =
  | "EXACT_MATCH"
  | "NORMALIZED_MATCH"
  | "APPROXIMATE_MATCH"
  | "UNVERIFIED"
  | "CONFLICTING"

const LIGATURES: [RegExp, string][] = [
  [/ﬀ/g, "ff"],
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  [/ﬃ/g, "ffi"],
  [/ﬄ/g, "ffl"],
  [/ﬅ/g, "st"],
  [/ﬆ/g, "st"],
  [/Œ/g, "OE"],
  [/œ/g, "oe"],
  [/Æ/g, "AE"],
  [/æ/g, "ae"],
]

/**
 * Canonical form for comparison: NFKC, ligatures expanded, soft hyphens and
 * zero-width characters dropped, line-break hyphenation joined, typographic
 * punctuation unified, whitespace collapsed, lowercased.
 */
export function normalizeForMatch(input: string | null | undefined): string {
  if (!input) return ""
  let s = input.normalize("NFKC")

  for (const [re, replacement] of LIGATURES) s = s.replace(re, replacement)

  // Soft hyphen, zero-width space/non-joiner/joiner, BOM, word joiner.
  s = s.replace(/[­​‌‍﻿⁠]/g, "")

  // Join hyphenation across a line break: "reve-\nnue" -> "revenue".
  s = s.replace(/(\p{L})[-‐‑‒–]\s*\r?\n\s*(\p{L})/gu, "$1$2")

  // Unify dashes, quotes and ellipsis.
  s = s
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/…/g, "...")

  // Non-breaking and exotic spaces -> plain space, then collapse.
  s = s.replace(/[  -   　]/g, " ")
  s = s.replace(/\s+/g, " ").trim().toLowerCase()

  return s
}

/** Token overlap ratio used only for the APPROXIMATE tier. */
function tokenOverlap(quote: string, page: string): number {
  const qTokens = quote.split(" ").filter((t) => t.length > 2)
  if (qTokens.length === 0) return 0
  let hits = 0
  for (const t of qTokens) if (page.includes(t)) hits++
  return hits / qTokens.length
}

export interface QuoteVerification {
  status: EvidenceVerifyT
  normalizedQuote: string
  /** Token-overlap ratio, present for approximate/unverified outcomes. */
  similarity?: number
}

/**
 * Verifies a quote against the text of ONE page. Page scoping matters: a
 * sentence found on a different page is not evidence for a claim cited to
 * this page.
 *
 * Tiers:
 *  - EXACT_MATCH       raw substring present verbatim
 *  - NORMALIZED_MATCH  present after canonicalization (the common PDF case)
 *  - APPROXIMATE_MATCH most content words present, but not contiguous
 *  - UNVERIFIED        cannot be located; preserved, never shown as verbatim
 */
export function verifyQuote(
  quote: string | null | undefined,
  pageText: string | null | undefined,
  opts: { approximateThreshold?: number } = {}
): QuoteVerification {
  const threshold = opts.approximateThreshold ?? 0.8
  const rawQuote = (quote ?? "").trim()
  const rawPage = pageText ?? ""

  const normalizedQuote = normalizeForMatch(rawQuote)
  if (!normalizedQuote) {
    return { status: "UNVERIFIED", normalizedQuote: "" }
  }
  if (!rawPage) {
    return { status: "UNVERIFIED", normalizedQuote, similarity: 0 }
  }

  if (rawQuote && rawPage.includes(rawQuote)) {
    return { status: "EXACT_MATCH", normalizedQuote }
  }

  const normalizedPage = normalizeForMatch(rawPage)
  if (normalizedPage.includes(normalizedQuote)) {
    return { status: "NORMALIZED_MATCH", normalizedQuote }
  }

  const similarity = tokenOverlap(normalizedQuote, normalizedPage)
  if (similarity >= threshold) {
    return { status: "APPROXIMATE_MATCH", normalizedQuote, similarity }
  }

  return { status: "UNVERIFIED", normalizedQuote, similarity }
}

/** Only these tiers may be rendered as a verbatim quote from the report. */
export function isVerbatimSafe(status: EvidenceVerifyT): boolean {
  return status === "EXACT_MATCH" || status === "NORMALIZED_MATCH"
}
