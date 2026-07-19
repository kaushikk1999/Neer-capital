/**
 * Shared contracts for the Report Analysis V2 pipeline.
 *
 * These types are the single source of truth shared by the worker (extraction,
 * validation, persistence) and the UI (review, public rendering). They mirror
 * the Prisma enums so a value never loses its provenance on the way through.
 */

export type ReviewStatusT =
  | "NOT_REVIEWED"
  | "IN_REVIEW"
  | "APPROVED"
  | "NEEDS_REVIEW"
  | "ERROR"
  | "MISSING"
  | "REJECTED"

export type ConfidenceLevelT =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "CONFLICTING"
  | "MISSING"
  | "UNVERIFIED"

/** A=Actual R=Restated P=Preliminary G=Guidance E=Estimate C=Consensus S=Scenario AI=Platform U=Unclear */
export type ClassificationCodeT = "A" | "R" | "P" | "G" | "E" | "C" | "S" | "AI" | "U"

export type ProvenanceTypeT =
  | "ANALYST_STATED"
  | "PLATFORM_CALCULATED"
  | "AI_INFERRED"
  | "SYSTEM_GENERATED"

export type EvidenceRoleT = "PRIMARY" | "SUPPORTING" | "CONTRADICTING"

export type PeriodTypeT = "ANNUAL" | "QUARTER" | "TTM"

export type ChartDataStatusT = "REPORTED" | "SYSTEM_GENERATED_MISSING" | "CONFLICTING"

/**
 * Forward-looking classifications. Management guidance (G) is future data and
 * must be drawn as forecast, not actual.
 */
export const FORECAST_CODES: ReadonlySet<ClassificationCodeT> = new Set<ClassificationCodeT>([
  "G",
  "E",
  "C",
  "S",
  "AI",
])

export function isForecastCode(code: ClassificationCodeT | null | undefined): boolean {
  return code ? FORECAST_CODES.has(code) : false
}

export interface EvidenceLinkRef {
  evidenceId: string
  role: EvidenceRoleT
}

/**
 * Every material identity/valuation value carries its own provenance. A bare
 * value is never persisted for these fields — if we cannot say where it came
 * from, we cannot show it as fact.
 */
export interface SourcedField<T> {
  value: T | null
  /** Verbatim source text, e.g. "Rs 741 Cr" — preserved alongside the normalized value. */
  rawValue: string | null
  evidenceLinks: EvidenceLinkRef[]
  provenance: ProvenanceTypeT
  confidenceLevel: ConfidenceLevelT
  reviewStatus: ReviewStatusT
}

export function emptySourcedField<T>(
  provenance: ProvenanceTypeT = "SYSTEM_GENERATED"
): SourcedField<T> {
  return {
    value: null,
    rawValue: null,
    evidenceLinks: [],
    provenance,
    confidenceLevel: "MISSING",
    reviewStatus: "NOT_REVIEWED",
  }
}

/** Monetary values travel as canonical decimal strings, never JS floats. */
export type DecimalString = string

export interface ReportIdentity {
  legalName: SourcedField<string>
  displayName: SourcedField<string>
  ticker: SourcedField<string>
  exchange: SourcedField<string>
  isin: SourcedField<string>
  sector: SourcedField<string>
  industry: SourcedField<string>
  country: SourcedField<string>
  currency: SourcedField<string>
  researchHouse: SourcedField<string>
  analyst: SourcedField<string>
  analystTitle: SourcedField<string>
  publishedAt: SourcedField<string>
  dataCutoff: SourcedField<string>
  reportType: SourcedField<string>
  accountingBasis: SourcedField<string>
  consolidated: SourcedField<string>
  reportVersion: SourcedField<string>
  prevReportRef: SourcedField<string>
}

export interface ValuationDetail {
  cmp: SourcedField<DecimalString>
  cmpDate: SourcedField<string>
  ratingCurrent: SourcedField<string>
  ratingPrevious: SourcedField<string>
  baseTarget: SourcedField<DecimalString>
  bullTarget: SourcedField<DecimalString>
  bearTarget: SourcedField<DecimalString>
  prevTarget: SourcedField<DecimalString>
  horizon: SourcedField<string>
  valuationBasis: SourcedField<string>
  appliedMultiple: SourcedField<DecimalString>
  currentMultiple: SourcedField<DecimalString>
  histAvgMultiple: SourcedField<DecimalString>
  peerMedianMultiple: SourcedField<DecimalString>
  premiumDiscount: SourcedField<DecimalString>
}

/**
 * References reviewed SynthesizedClaim rows only — no free-text prose is
 * persisted here, so nothing can be shown that was not grounded and reviewed.
 */
export interface InvestmentSummaryRefs {
  verdictClaimId: string | null
  outlookClaimIds: string[]
  valuationClaimIds: string[]
  thesisDriverIds: string[]
  mainConcernClaimId: string | null
  thesisBreakIds: string[]
  topCatalystIds: string[]
  topRiskIds: string[]
  dataQualityNoticeId: string | null
}

export interface Attribution {
  analystRating: string | null
  analystRatingSource: ProvenanceTypeT
  /** NEER's own view, when one exists. Never merged with the analyst rating. */
  neerAssessment: string | null
  disclosuresPresent: boolean
  disclaimer: string | null
}

/**
 * Measurable coverage, not an accuracy claim. `formulaVersion` and
 * `denominator` are stored so a historical figure stays interpretable.
 */
export interface QualityCoverage {
  numericSourceCoverage: number
  narrativeEvidenceCoverage: number
  verifiedCount: number
  conflictCount: number
  missingCriticalCount: number
  reviewRequiredCount: number
  denominator: {
    metrics: number
    sections: number
    criticalFields: number
  }
  formulaVersion: string
  tier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR"
}

export interface ChartV2Point {
  periodLabel: string
  periodType: PeriodTypeT
  /** Sortable key derived from (fiscalYearEnd, quarter) — never string sorting. */
  periodSortKey: number
  fiscalYearEnd: number
  quarter: number | null
  /** null means "not found in source" — it is never rendered as zero. */
  value: number | null
  currency: string | null
  scale: string | null
  classificationCode: ClassificationCodeT
  dataStatus: ChartDataStatusT
  evidenceLinks: EvidenceLinkRef[]
  confidenceLevel: ConfidenceLevelT
}

export interface ChartV2Config {
  unit: string | null
  currency: string | null
  scale: string | null
  points: ChartV2Point[]
}

/** Legacy chart shape, still written for every V1 reader. */
export interface ChartV1Config {
  labels: string[]
  series: { name: string; data: (number | null)[] }[]
}
