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
  /** Which statement the figure is from: CONSOLIDATED / STANDALONE / SEGMENT /
   *  UNKNOWN. Keeps consolidated and standalone values of the same line item
   *  from colliding as false contradictions. */
  statementType: string
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

/** Map the model's free-text statementType to a stable bucket. */
function normalizeStatementType(v: string | null | undefined): string {
  const t = (v ?? "").toLowerCase()
  if (t.includes("consolidat")) return "CONSOLIDATED"
  if (t.includes("standalone") || t.includes("stand-alone") || t.includes("separate")) return "STANDALONE"
  if (t.includes("segment")) return "SEGMENT"
  return "UNKNOWN"
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
    statementType: normalizeStatementType(m.statementType),
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

      // Identity of a metric: what it is, for which period, in what capacity,
      // and from which statement (consolidated vs standalone are distinct facts).
      const key = `${merged.taxonomyKey}::${merged.period ?? "?"}::${merged.classificationCode}::${merged.statementType}`
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
    sections: dedupeNarrative(sections).filter(isAnalyticalSection),
    stats: {
      chunks: ordered.length,
      rawMetricCount,
      mergedMetricCount: metrics.length,
      duplicatesCollapsed,
      conflictCount,
    },
  }
}

// A statutory annual report is ~90% procedural / governance / statutory-notes
// boilerplate. The extraction prompt asks the model to skip it, but a full
// filing overwhelms that instruction, so we drop non-analytical sections
// deterministically by heading. We KEEP business/financial analysis (MD&A):
// industry structure, outlook, opportunities, strengths, performance, key
// developments, segment commentary. Numbers still come through as metrics/charts.
const NON_ANALYTICAL_SECTION = new RegExp(
  [
    // Meeting / voting / shareholder procedure
    "notice", "e-?voting", "insta ?meet", "postal ballot", "proxy", "attendance",
    "\\bagm\\b", "\\begm\\b", "general (meeting|body)", "means of communication",
    "shareholder information", "shareholding", "shareholders holding",
    // Board / governance / secretarial
    "\\bdirector", "key managerial", "\\bkmp\\b", "committee", "nomination", "remuneration",
    "senior management", "related party", "corporate governance", "secretarial",
    "board evaluation", "criteria for evaluation", "relationship between directors",
    "core competence",
    // Audit / statutory / legal
    "auditor", "audit report", "audit matter", "internal financial control", "statutory dues",
    "report on other legal", "\\bopinion\\b", "other matters", "fraud", "whistle", "vigil",
    "insolvency", "bankruptcy", "material orders", "responsible business",
    // CSR / ESG / BRSR / HR / people
    "\\bcsr\\b", "corporate social responsibility", "posh", "sexual harassment",
    "business responsibility", "sustainability", "\\bbrsr\\b", "ngrbc", "human rights",
    "stakeholder", "grievance", "conservation of energy", "energy consumption", "waste",
    "zero liquid", "pat scheme", "environment", "anti-?corruption", "bribery",
    "conflict of interest", "anti-?competitive", "public policy", "community",
    "data privacy", "cyber security", "employee", "worker", "well-?being", "workplace",
    "equal opportunity", "health and safety", "working conditions", "value chain",
    "trade and industry affiliation", "accessibility",
    // Shareholder admin / capital actions
    "dividend", "demateriali", "iepf", "investor education", "unclaimed", "unpaid",
    "share transfer", "investor grievance", "corporate benefits", "utilization of funds",
    "\\bqip\\b", "bonus shares", "stock option", "share.?based payment", "employees stock",
    // Accounting notes / statements / policies
    "^note\\s*\\d+", "balance sheet", "profit and loss", "changes in equity", "cash ?flow",
    "basis of preparation", "background and corporate", "accounting polic",
    "management judgment", "provisions", "contingent", "fair value", "financial instrument",
    "financial risk", "financial liabilit", "financial asset", "revenue recognition",
    "income tax", "deferred tax", "provision for", "borrowing cost", "finance cost",
    "property, plant", "intangible", "investment in propert", "inventor", "employee benefit",
    "defined contribution", "lease liabilit", "policy for lease", "trade payable",
    "trade receivable", "cash and cash equivalent", "segment (information|reporting|ation)",
    "operating seg", "company information", "rights attached", "depreciation", "amortis",
    "other expenses", "credit risk", "liquidity risk", "market risk", "interest rate risk",
    "price risk", "capital management", "operating cycle", "labour code", "statutory information",
    "unhedge", "earning.? per share", "earnings per share",
    // Generic disclosure / statement containers
    "annexure", "^disclosures?$", "general disclosures", "transparency and disclosures",
    "^operations$", "^governance", "subsidiar", "holding, subsidiary", "section [ab]:",
    "leadership indicators", "policy and management",
  ].join("|"),
  "i"
)

/** True only for substantive business/financial-analysis sections. */
export function isAnalyticalSection(item: { title?: string | null }): boolean {
  const h = (item.title ?? "").trim()
  return h.length > 0 && !NON_ANALYTICAL_SECTION.test(h)
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
