/**
 * Stage 4: cross-chunk merge and de-duplication.
 *
 * Chunks overlap in what they can see: the cover page carries the rating and
 * target, the financial pages carry the tables, and the same metric often
 * appears in both a narrative sentence and a table row. Merging has to do three
 * things carefully:
 *
 *  1. Resolve document-level facts (identity, valuation) by evidence quality,
 *     not by whichever chunk happened to run first.
 *  2. Collapse genuine duplicates of the same metric.
 *  3. Keep genuine *conflicts* — two different values for the same metric and
 *     period — as conflicts. Silently picking one is how a wrong number ends up
 *     presented as fact.
 */

import type { ChunkExtractionResult, QuoteCheck } from "@/worker/ai-extractor"
import type {
  ExtractedIdentity,
  ExtractedMetric,
  ExtractedValuation,
} from "@/worker/extraction-schema"
import { parseRawValue, resolveTaxonomy, type TaxonomyKey } from "@/lib/finance/normalize"
import { parsePeriod } from "@/lib/finance/normalize"
import type { EvidenceVerifyT } from "@/lib/analysis/quote-verify"

/** Verification tiers ranked so better-evidenced values win a tie. */
const VERIFY_RANK: Record<EvidenceVerifyT, number> = {
  EXACT_MATCH: 4,
  NORMALIZED_MATCH: 3,
  APPROXIMATE_MATCH: 2,
  UNVERIFIED: 1,
  CONFLICTING: 0,
}

export interface MergedEvidence {
  quote: string
  normalizedQuote: string
  page: number | null
  verification: EvidenceVerifyT
  chunkIndex: number
}

export interface MergedMetric {
  label: string
  taxonomyKey: TaxonomyKey
  rawValue: string
  /** Canonical decimal string, or null when the printed value is not numeric. */
  decimalValue: string | null
  currency: string | null
  scale: string | null
  period: string | null
  periodSortKey: number | null
  classificationCode: string
  category: string | null
  evidence: MergedEvidence
  /** Other values seen for the same metric+period that did not agree. */
  conflicts: { rawValue: string; decimalValue: string | null; evidence: MergedEvidence }[]
}

export interface MergedNarrativeItem {
  title: string
  body: string
  evidence: MergedEvidence
}

export interface MergedExtraction {
  identity: Partial<Record<keyof ExtractedIdentity, string | number | null>>
  identityEvidence: MergedEvidence | null
  valuation: Partial<Record<keyof ExtractedValuation, string | number | null>>
  valuationEvidence: MergedEvidence | null
  metrics: MergedMetric[]
  risks: MergedNarrativeItem[]
  catalysts: MergedNarrativeItem[]
  thesisPoints: MergedNarrativeItem[]
  sections: MergedNarrativeItem[]
  stats: {
    chunks: number
    rawMetricCount: number
    mergedMetricCount: number
    duplicatesCollapsed: number
    conflictCount: number
  }
}

function toEvidence(
  quote: string | null | undefined,
  check: QuoteCheck | undefined,
  chunkIndex: number
): MergedEvidence {
  return {
    quote: (quote ?? "").trim(),
    normalizedQuote: check?.normalizedQuote ?? "",
    page: check?.citedPage ?? null,
    verification: check?.status ?? "UNVERIFIED",
    chunkIndex,
  }
}

function better(a: MergedEvidence, b: MergedEvidence): boolean {
  return VERIFY_RANK[a.verification] > VERIFY_RANK[b.verification]
}

/** Two printed values agree if their parsed magnitudes match within rounding. */
function valuesAgree(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a === b
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a === b
  if (na === nb) return true
  const base = Math.max(Math.abs(na), Math.abs(nb))
  if (base === 0) return true
  return Math.abs(na - nb) / base <= 0.005
}

function normalizeMetric(
  m: ExtractedMetric,
  evidence: MergedEvidence
): MergedMetric {
  const parsed = parseRawValue(m.rawValue)
  const period = parsePeriod(m.period)
  return {
    label: m.label,
    taxonomyKey: resolveTaxonomy(m.label),
    rawValue: m.rawValue,
    decimalValue: parsed.value == null ? null : String(parsed.value),
    currency: parsed.currency,
    scale: parsed.scale,
    period: period ? period.label : m.period,
    periodSortKey: period ? period.sortKey : null,
    classificationCode: m.classificationCode,
    category: m.category,
    evidence,
    conflicts: [],
  }
}

/**
 * Document-level fields are filled from the best-evidenced chunk that actually
 * has a value. A later chunk never overwrites an earlier value with null.
 */
function mergeRecord<T extends object>(
  target: Partial<Record<keyof T, string | number | null>>,
  incoming: T | null | undefined,
  incomingEvidence: MergedEvidence,
  currentEvidence: MergedEvidence | null,
  skipKeys: (keyof T)[]
): MergedEvidence | null {
  if (!incoming) return currentEvidence
  let contributed = false

  for (const [key, value] of Object.entries(incoming) as [keyof T, unknown][]) {
    if (skipKeys.includes(key)) continue
    if (value == null || value === "") continue
    const existing = target[key]
    if (existing == null || existing === "") {
      target[key] = value as string | number
      contributed = true
    }
  }

  if (!contributed) return currentEvidence
  if (!currentEvidence || better(incomingEvidence, currentEvidence)) return incomingEvidence
  return currentEvidence
}

export function mergeChunkExtractions(results: ChunkExtractionResult[]): MergedExtraction {
  const ordered = [...results].sort((a, b) => a.chunkIndex - b.chunkIndex)

  const identity: MergedExtraction["identity"] = {}
  const valuation: MergedExtraction["valuation"] = {}
  let identityEvidence: MergedEvidence | null = null
  let valuationEvidence: MergedEvidence | null = null

  const metricsByKey = new Map<string, MergedMetric>()
  const risks: MergedNarrativeItem[] = []
  const catalysts: MergedNarrativeItem[] = []
  const thesisPoints: MergedNarrativeItem[] = []
  const sections: MergedNarrativeItem[] = []

  let rawMetricCount = 0
  let duplicatesCollapsed = 0
  let conflictCount = 0

  for (const result of ordered) {
    const { data, quoteChecks, chunkIndex } = result

    identityEvidence = mergeRecord(
      identity,
      data.identity,
      toEvidence(data.identity?.identityQuote, quoteChecks["identity:0"], chunkIndex),
      identityEvidence,
      ["identityQuote", "identityPage"]
    )

    valuationEvidence = mergeRecord(
      valuation,
      data.valuation,
      toEvidence(data.valuation?.valuationQuote, quoteChecks["valuation:0"], chunkIndex),
      valuationEvidence,
      ["valuationQuote", "valuationPage"]
    )

    data.metrics.forEach((m, i) => {
      rawMetricCount++
      const evidence = toEvidence(m.sourceQuote, quoteChecks[`metric:${i}`], chunkIndex)
      const merged = normalizeMetric(m, evidence)

      // Identity of a metric: what it is, for which period, in what capacity.
      const key = `${merged.taxonomyKey}::${merged.period ?? "?"}::${merged.classificationCode}`
      const existing = metricsByKey.get(key)

      if (!existing) {
        metricsByKey.set(key, merged)
        return
      }

      if (valuesAgree(existing.decimalValue, merged.decimalValue)) {
        // Same fact seen twice — keep the better-evidenced instance.
        duplicatesCollapsed++
        if (better(merged.evidence, existing.evidence)) {
          merged.conflicts = existing.conflicts
          metricsByKey.set(key, merged)
        }
        return
      }

      // Genuine disagreement: keep both, surface it, never choose silently.
      conflictCount++
      existing.conflicts.push({
        rawValue: merged.rawValue,
        decimalValue: merged.decimalValue,
        evidence: merged.evidence,
      })
    })

    data.risks.forEach((r, i) =>
      risks.push({
        title: r.name,
        body: r.explanation,
        evidence: toEvidence(r.sourceQuote, quoteChecks[`risk:${i}`], chunkIndex),
      })
    )
    data.catalysts.forEach((c, i) =>
      catalysts.push({
        title: c.name,
        body: c.explanation,
        evidence: toEvidence(c.sourceQuote, quoteChecks[`catalyst:${i}`], chunkIndex),
      })
    )
    data.thesisPoints.forEach((t, i) =>
      thesisPoints.push({
        title: t.title,
        body: t.explanation,
        evidence: toEvidence(t.sourceQuote, quoteChecks[`thesis:${i}`], chunkIndex),
      })
    )
    data.sections.forEach((s, i) =>
      sections.push({
        title: s.heading,
        body: s.summary,
        evidence: toEvidence(s.sourceQuote, quoteChecks[`section:${i}`], chunkIndex),
      })
    )
  }

  const metrics = [...metricsByKey.values()].sort((a, b) => {
    if (a.taxonomyKey !== b.taxonomyKey) return a.taxonomyKey < b.taxonomyKey ? -1 : 1
    return (a.periodSortKey ?? 0) - (b.periodSortKey ?? 0)
  })

  return {
    identity,
    identityEvidence,
    valuation,
    valuationEvidence,
    metrics,
    risks: dedupeNarrative(risks),
    catalysts: dedupeNarrative(catalysts),
    thesisPoints: dedupeNarrative(thesisPoints),
    sections: dedupeNarrative(sections),
    stats: {
      chunks: ordered.length,
      rawMetricCount,
      mergedMetricCount: metrics.length,
      duplicatesCollapsed,
      conflictCount,
    },
  }
}

/** Narrative items repeat across chunk boundaries; collapse on title+body. */
function dedupeNarrative(items: MergedNarrativeItem[]): MergedNarrativeItem[] {
  const seen = new Map<string, MergedNarrativeItem>()
  for (const item of items) {
    const key = `${item.title.toLowerCase().trim()}::${item.body.toLowerCase().trim().slice(0, 120)}`
    const existing = seen.get(key)
    if (!existing || better(item.evidence, existing.evidence)) seen.set(key, item)
  }
  return [...seen.values()]
}

/** Builds a chart series for one metric across periods, ordered chronologically. */
export function seriesForMetric(
  merged: MergedExtraction,
  taxonomyKey: TaxonomyKey
): { period: string; value: number | null; classificationCode: string; page: number | null }[] {
  return merged.metrics
    .filter((m) => m.taxonomyKey === taxonomyKey && m.period)
    .sort((a, b) => (a.periodSortKey ?? 0) - (b.periodSortKey ?? 0))
    .map((m) => ({
      period: m.period as string,
      value: m.decimalValue == null ? null : Number(m.decimalValue),
      classificationCode: m.classificationCode,
      page: m.evidence.page,
    }))
}
