/**
 * Deterministic validation: arithmetic agreement, contradiction detection and
 * measured extraction coverage.
 *
 * This module replaces the previous synthetic confidence score. It does not
 * emit an accuracy percentage — accuracy would require a labelled golden
 * dataset we do not have. It reports *coverage*: how much of what we extracted
 * is backed by verified source evidence, how much conflicts, and how much a
 * human still needs to look at.
 */

import { agreesWithin, marginPct, freeCashFlow, targetFromEPS, evFromMultiple } from "@/lib/analysis/calc"
import { issueFingerprint } from "@/lib/analysis/fingerprint"
import { isVerbatimSafe, type EvidenceVerifyT } from "@/lib/analysis/quote-verify"
import type {
  ClassificationCodeT,
  ConfidenceLevelT,
  DecimalString,
  QualityCoverage,
} from "@/lib/report/types"

export const QUALITY_FORMULA_VERSION = "q1"

export type IssueSeverityT = "BLOCKER" | "WARNING" | "INFO"

export interface ValidationIssue {
  code: string
  severity: IssueSeverityT
  entityType: string
  entityId: string | null
  message: string
  details: Record<string, unknown>
  fingerprint: string
}

function issue(
  code: string,
  severity: IssueSeverityT,
  entityType: string,
  entityId: string | null,
  message: string,
  details: Record<string, unknown>,
  valueSnapshot: unknown
): ValidationIssue {
  return {
    code,
    severity,
    entityType,
    entityId,
    message,
    details,
    fingerprint: issueFingerprint({ code, entityType, entityId, valueSnapshot }),
  }
}

// ---------------------------------------------------------------------------
// Inputs (kept Prisma-free so this stays pure and unit-testable)
// ---------------------------------------------------------------------------

export interface MetricInput {
  id: string
  label: string
  taxonomyKey: string
  decimalValue: DecimalString | null
  period: string | null
  classificationCode: ClassificationCodeT | null
  sourcePage: number | null
  evidenceVerification: EvidenceVerifyT | null
  currency?: string | null
  scale?: string | null
}

export interface SectionInput {
  id: string
  heading: string
  evidenceVerification: EvidenceVerifyT | null
}

export interface ValuationInput {
  cmp: DecimalString | null
  baseTarget: DecimalString | null
  appliedMultiple: DecimalString | null
  eps: DecimalString | null
  pe: DecimalString | null
}

/** Fields without which a published report would be materially incomplete. */
export const CRITICAL_FIELDS = [
  "company",
  "recommendation",
  "cmp",
  "baseTarget",
  "horizon",
  "researchHouse",
  "analyst",
  "publishedAt",
] as const
export type CriticalField = (typeof CRITICAL_FIELDS)[number]

// ---------------------------------------------------------------------------
// Arithmetic agreement
// ---------------------------------------------------------------------------

const byKey = (metrics: MetricInput[], key: string, period?: string | null) =>
  metrics.find((m) => m.taxonomyKey === key && (period ? m.period === period : true)) ?? null

/**
 * Recomputes relationships the report states and flags disagreement beyond a
 * rounding tolerance. Missing inputs are never treated as failures — they are
 * simply not checkable.
 */
export function arithmeticChecks(
  metrics: MetricInput[],
  valuation: ValuationInput,
  tolerance = 0.01
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const periods = [...new Set(metrics.map((m) => m.period).filter(Boolean))] as string[]

  for (const period of periods) {
    const revenue = byKey(metrics, "revenue", period)
    const ebitda = byKey(metrics, "ebitda", period)
    const reportedMargin = byKey(metrics, "ebitda_margin", period)

    // EBITDA / revenue = EBITDA margin
    if (revenue?.decimalValue && ebitda?.decimalValue && reportedMargin?.decimalValue) {
      const computed = marginPct(ebitda.decimalValue, revenue.decimalValue, "EBITDA")
      const cmp = agreesWithin(reportedMargin.decimalValue, computed.value, tolerance)
      if (!cmp.agrees && computed.value) {
        issues.push(
          issue(
            "ARITHMETIC_MARGIN_MISMATCH",
            "WARNING",
            "DocumentMetric",
            reportedMargin.id,
            `Reported EBITDA margin for ${period} does not match EBITDA / revenue.`,
            {
              period,
              reported: reportedMargin.decimalValue,
              computed: computed.value,
              deltaPct: cmp.deltaPct,
              formula: computed.formula,
            },
            { reported: reportedMargin.decimalValue, computed: computed.value }
          )
        )
      }
    }

    // Operating cash flow - capex = free cash flow
    const ocf = byKey(metrics, "ocf", period)
    const capex = byKey(metrics, "capex", period)
    const fcf = byKey(metrics, "fcf", period)
    if (ocf?.decimalValue && capex?.decimalValue && fcf?.decimalValue) {
      const computed = freeCashFlow(ocf.decimalValue, capex.decimalValue)
      const cmp = agreesWithin(fcf.decimalValue, computed.value, tolerance)
      if (!cmp.agrees && computed.value) {
        issues.push(
          issue(
            "ARITHMETIC_FCF_MISMATCH",
            "WARNING",
            "DocumentMetric",
            fcf.id,
            `Reported free cash flow for ${period} does not match operating cash flow minus capex.`,
            { period, reported: fcf.decimalValue, computed: computed.value, deltaPct: cmp.deltaPct },
            { reported: fcf.decimalValue, computed: computed.value }
          )
        )
      }
    }
  }

  // EPS x P/E should reconstruct the stated target price
  if (valuation.eps && valuation.pe && valuation.baseTarget) {
    const computed = targetFromEPS(valuation.eps, valuation.pe)
    const cmp = agreesWithin(valuation.baseTarget, computed.value, tolerance)
    if (!cmp.agrees && computed.value) {
      issues.push(
        issue(
          "ARITHMETIC_TARGET_MISMATCH",
          "WARNING",
          "DocumentAnalysis",
          null,
          "Stated target price does not match forecast EPS multiplied by the applied P/E.",
          { reported: valuation.baseTarget, computed: computed.value, deltaPct: cmp.deltaPct },
          { reported: valuation.baseTarget, computed: computed.value }
        )
      )
    }
  }

  // A target price below CMP alongside a positive recommendation is a
  // relationship worth a human look, not an automatic failure.
  if (valuation.cmp && valuation.baseTarget) {
    const cmpNum = Number(valuation.cmp)
    const tgtNum = Number(valuation.baseTarget)
    if (Number.isFinite(cmpNum) && Number.isFinite(tgtNum) && cmpNum > 0 && tgtNum <= 0) {
      issues.push(
        issue(
          "INVALID_TARGET_CMP_RELATIONSHIP",
          "BLOCKER",
          "DocumentAnalysis",
          null,
          "Target price is not a positive value while CMP is positive.",
          { cmp: valuation.cmp, baseTarget: valuation.baseTarget },
          { cmp: valuation.cmp, baseTarget: valuation.baseTarget }
        )
      )
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Contradiction detection
// ---------------------------------------------------------------------------

/**
 * The same metric for the same period should not carry two different values.
 * When it does we surface both rather than silently choosing one.
 */
export function contradictionChecks(metrics: MetricInput[], tolerance = 0.01): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const groups = new Map<string, MetricInput[]>()

  for (const m of metrics) {
    if (!m.decimalValue || !m.period || m.taxonomyKey === "unmapped") continue
    const key = `${m.taxonomyKey}::${m.period}::${m.classificationCode ?? "U"}`
    const list = groups.get(key) ?? []
    list.push(m)
    groups.set(key, list)
  }

  for (const [key, list] of groups) {
    if (list.length < 2) continue
    const [first, ...rest] = list
    for (const other of rest) {
      const cmp = agreesWithin(first.decimalValue, other.decimalValue, tolerance)
      if (!cmp.agrees) {
        const [taxonomyKey, period] = key.split("::")
        issues.push(
          issue(
            "CONTRADICTORY_METRIC_VALUE",
            "BLOCKER",
            "DocumentMetric",
            other.id,
            `${taxonomyKey} for ${period} appears with conflicting values in the source report.`,
            {
              taxonomyKey,
              period,
              values: [
                { id: first.id, value: first.decimalValue, page: first.sourcePage, label: first.label },
                { id: other.id, value: other.decimalValue, page: other.sourcePage, label: other.label },
              ],
              deltaPct: cmp.deltaPct,
            },
            { a: first.decimalValue, b: other.decimalValue }
          )
        )
      }
    }
  }

  // A single series should not mix currencies or scales.
  const unitGroups = new Map<string, Set<string>>()
  for (const m of metrics) {
    if (!m.decimalValue) continue
    const set = unitGroups.get(m.taxonomyKey) ?? new Set<string>()
    set.add(`${m.currency ?? "?"}/${m.scale ?? "?"}`)
    unitGroups.set(m.taxonomyKey, set)
  }
  for (const [taxonomyKey, units] of unitGroups) {
    if (units.size > 1 && taxonomyKey !== "unmapped") {
      issues.push(
        issue(
          "INCONSISTENT_UNITS",
          "WARNING",
          "DocumentMetric",
          null,
          `${taxonomyKey} appears with more than one currency/scale combination.`,
          { taxonomyKey, units: [...units] },
          { taxonomyKey, units: [...units].sort() }
        )
      )
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Coverage (replaces the synthetic global confidence)
// ---------------------------------------------------------------------------

export function computeCoverage(
  metrics: MetricInput[],
  sections: SectionInput[],
  missingCriticalFields: CriticalField[],
  extraIssues: ValidationIssue[] = []
): QualityCoverage {
  const metricTotal = metrics.length
  const metricVerified = metrics.filter((m) => m.evidenceVerification && isVerbatimSafe(m.evidenceVerification)).length
  const sectionTotal = sections.length
  const sectionVerified = sections.filter((s) => s.evidenceVerification && isVerbatimSafe(s.evidenceVerification)).length

  const conflictCount = extraIssues.filter(
    (i) => i.code === "CONTRADICTORY_METRIC_VALUE" || i.severity === "BLOCKER"
  ).length

  const reviewRequiredCount =
    metrics.filter((m) => !m.evidenceVerification || !isVerbatimSafe(m.evidenceVerification)).length +
    extraIssues.filter((i) => i.severity === "WARNING").length

  const ratio = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 1000)
  const numericSourceCoverage = ratio(metricVerified, metricTotal)
  const narrativeEvidenceCoverage = ratio(sectionVerified, sectionTotal)

  const tier: QualityCoverage["tier"] =
    missingCriticalFields.length === 0 && conflictCount === 0 && numericSourceCoverage >= 0.9 && narrativeEvidenceCoverage >= 0.8
      ? "EXCELLENT"
      : conflictCount === 0 && numericSourceCoverage >= 0.75 && missingCriticalFields.length <= 1
        ? "GOOD"
        : numericSourceCoverage >= 0.5
          ? "FAIR"
          : "POOR"

  return {
    numericSourceCoverage,
    narrativeEvidenceCoverage,
    verifiedCount: metricVerified + sectionVerified,
    conflictCount,
    missingCriticalCount: missingCriticalFields.length,
    reviewRequiredCount,
    denominator: {
      metrics: metricTotal,
      sections: sectionTotal,
      criticalFields: CRITICAL_FIELDS.length,
    },
    formulaVersion: QUALITY_FORMULA_VERSION,
    tier,
  }
}

/** Emits an issue per critical field that the report did not yield. */
export function missingCriticalFieldIssues(missing: CriticalField[]): ValidationIssue[] {
  return missing.map((field) =>
    issue(
      "MISSING_CRITICAL_FIELD",
      "BLOCKER",
      "DocumentAnalysis",
      null,
      `Required field "${field}" was not found in the source report.`,
      { field },
      { field }
    )
  )
}

/** Confidence label for a single extracted value. */
export function confidenceFromVerification(
  verification: EvidenceVerifyT | null | undefined,
  hasConflict: boolean
): ConfidenceLevelT {
  if (hasConflict) return "CONFLICTING"
  if (!verification) return "MISSING"
  switch (verification) {
    case "EXACT_MATCH":
      return "HIGH"
    case "NORMALIZED_MATCH":
      return "MEDIUM"
    case "APPROXIMATE_MATCH":
      return "LOW"
    case "CONFLICTING":
      return "CONFLICTING"
    default:
      return "UNVERIFIED"
  }
}
