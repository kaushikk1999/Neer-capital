/**
 * Chart normalization and integrity checks.
 *
 * The defect this replaces: missing values were coerced to 0 before
 * persistence, so a year the report never disclosed was plotted as a real
 * data point at zero. Here a missing value stays null for its whole life and
 * is rendered as a gap.
 *
 * V1 config ({labels, series:number[]}) is still produced for existing
 * readers; V2 adds per-point period typing, classification and provenance.
 */

import { parsePeriod } from "@/lib/finance/normalize"
import type {
  ChartV1Config,
  ChartV2Config,
  ChartV2Point,
  ClassificationCodeT,
  ConfidenceLevelT,
  EvidenceLinkRef,
} from "@/lib/report/types"
import { isForecastCode } from "@/lib/report/types"

export interface RawChartPoint {
  period: string
  value: number | null
  classificationCode?: ClassificationCodeT | null
  evidenceLinks?: EvidenceLinkRef[]
  confidenceLevel?: ConfidenceLevelT | null
}

export interface ChartIssue {
  code:
    | "CHART_LABEL_VALUE_MISMATCH"
    | "CHART_DUPLICATE_PERIOD"
    | "CHART_UNPARSEABLE_PERIOD"
    | "CHART_EMPTY_SERIES"
    | "CHART_MIXED_PERIOD_TYPES"
    | "CHART_FORECAST_BEFORE_ACTUAL"
  message: string
  details: Record<string, unknown>
}

export interface NormalizedChart {
  configV2: ChartV2Config
  /** Always produced so V1 readers keep working unchanged. */
  configV1: ChartV1Config
  issues: ChartIssue[]
}

/**
 * Builds the continuous period sequence between the first and last observed
 * period, but ONLY when the sequence is unambiguous (single period type, and
 * a regular annual/quarterly cadence). Inserted periods carry a null value and
 * are marked SYSTEM_GENERATED_MISSING — we never invent a number.
 */
export function buildContinuousPeriods(points: ChartV2Point[]): ChartV2Point[] {
  if (points.length < 2) return points

  const types = new Set(points.map((p) => p.periodType))
  if (types.size !== 1) return points // ambiguous cadence: do not synthesize
  const type = points[0].periodType
  if (type === "TTM") return points

  const sorted = [...points].sort((a, b) => a.periodSortKey - b.periodSortKey)
  const filled: ChartV2Point[] = []

  const template = (
    fiscalYearEnd: number,
    quarter: number | null,
    label: string,
    sortKey: number
  ): ChartV2Point => ({
    periodLabel: label,
    periodType: type,
    periodSortKey: sortKey,
    fiscalYearEnd,
    quarter,
    value: null,
    currency: sorted[0].currency,
    scale: sorted[0].scale,
    classificationCode: "U",
    dataStatus: "SYSTEM_GENERATED_MISSING",
    evidenceLinks: [],
    confidenceLevel: "MISSING",
  })

  for (let i = 0; i < sorted.length; i++) {
    filled.push(sorted[i])
    const cur = sorted[i]
    const next = sorted[i + 1]
    if (!next) break

    if (type === "ANNUAL") {
      for (let y = cur.fiscalYearEnd + 1; y < next.fiscalYearEnd; y++) {
        filled.push(template(y, null, `FY${String(y).slice(-2)}`, y * 10))
      }
    } else {
      // Quarterly: walk forward one quarter at a time.
      let y = cur.fiscalYearEnd
      let q = cur.quarter ?? 1
      for (;;) {
        q += 1
        if (q > 4) {
          q = 1
          y += 1
        }
        const key = y * 10 + q
        if (key >= next.periodSortKey) break
        filled.push(template(y, q, `Q${q}FY${String(y).slice(-2)}`, key))
      }
    }
  }

  return filled
}

/**
 * Normalizes one series into V2 points plus a V1-compatible config, and
 * reports integrity problems rather than silently repairing them.
 */
export function normalizeChartSeries(
  seriesName: string,
  raw: RawChartPoint[],
  meta: { unit?: string | null; currency?: string | null; scale?: string | null } = {}
): NormalizedChart {
  const issues: ChartIssue[] = []

  if (!raw || raw.length === 0) {
    issues.push({
      code: "CHART_EMPTY_SERIES",
      message: "Series contains no data points; nothing will be plotted.",
      details: { seriesName },
    })
    return {
      configV2: { unit: meta.unit ?? null, currency: meta.currency ?? null, scale: meta.scale ?? null, points: [] },
      configV1: { labels: [], series: [{ name: seriesName, data: [] }] },
      issues,
    }
  }

  const points: ChartV2Point[] = []
  const seenSortKeys = new Map<number, string>()

  for (const p of raw) {
    const parsed = parsePeriod(p.period)
    if (!parsed) {
      issues.push({
        code: "CHART_UNPARSEABLE_PERIOD",
        message: `Period "${p.period}" could not be interpreted; the point is excluded from the ordered series.`,
        details: { seriesName, period: p.period },
      })
      continue
    }

    if (seenSortKeys.has(parsed.sortKey)) {
      issues.push({
        code: "CHART_DUPLICATE_PERIOD",
        message: `Period ${parsed.label} appears more than once in "${seriesName}".`,
        details: { seriesName, period: parsed.label },
      })
    }
    seenSortKeys.set(parsed.sortKey, parsed.label)

    const code: ClassificationCodeT = p.classificationCode ?? "U"
    points.push({
      periodLabel: parsed.label,
      periodType: parsed.periodType,
      periodSortKey: parsed.sortKey,
      fiscalYearEnd: parsed.fiscalYearEnd,
      quarter: parsed.quarter,
      // A missing value stays null. It is never coerced to zero.
      value: typeof p.value === "number" && Number.isFinite(p.value) ? p.value : null,
      currency: meta.currency ?? null,
      scale: meta.scale ?? null,
      classificationCode: code,
      dataStatus: p.value == null ? "SYSTEM_GENERATED_MISSING" : "REPORTED",
      evidenceLinks: p.evidenceLinks ?? [],
      confidenceLevel: p.confidenceLevel ?? (p.value == null ? "MISSING" : "UNVERIFIED"),
    })
  }

  const types = new Set(points.map((p) => p.periodType))
  if (types.size > 1) {
    issues.push({
      code: "CHART_MIXED_PERIOD_TYPES",
      message: `"${seriesName}" mixes annual, quarterly or TTM periods on one axis.`,
      details: { seriesName, types: [...types] },
    })
  }

  // Chronological order is enforced by sort key, never by array position.
  let ordered = points.sort((a, b) => a.periodSortKey - b.periodSortKey)
  ordered = buildContinuousPeriods(ordered)

  // A definitively-actual period must not appear after a forecast period.
  // Only A/R/P count as actual: "U" is unknown and system-generated gaps carry
  // no classification, so neither may trigger this.
  const ACTUAL_CODES: ReadonlySet<ClassificationCodeT> = new Set<ClassificationCodeT>(["A", "R", "P"])
  const firstForecastIdx = ordered.findIndex((p) => isForecastCode(p.classificationCode))
  const actualAfterForecast =
    firstForecastIdx >= 0 &&
    ordered.some((p, i) => i > firstForecastIdx && ACTUAL_CODES.has(p.classificationCode))
  if (actualAfterForecast) {
    issues.push({
      code: "CHART_FORECAST_BEFORE_ACTUAL",
      message: `"${seriesName}" has an actual period after a forecast period; classification or ordering is inconsistent.`,
      details: { seriesName },
    })
  }

  const configV2: ChartV2Config = {
    unit: meta.unit ?? null,
    currency: meta.currency ?? null,
    scale: meta.scale ?? null,
    points: ordered,
  }

  // V1 keeps nulls as nulls so legacy readers show gaps rather than zeros.
  const configV1: ChartV1Config = {
    labels: ordered.map((p) => p.periodLabel),
    series: [{ name: seriesName, data: ordered.map((p) => p.value) }],
  }

  if (configV1.labels.length !== configV1.series[0].data.length) {
    issues.push({
      code: "CHART_LABEL_VALUE_MISMATCH",
      message: "Label count does not match data-point count.",
      details: {
        seriesName,
        labels: configV1.labels.length,
        values: configV1.series[0].data.length,
      },
    })
  }

  return { configV2, configV1, issues }
}

/** Index of the first forecast point, derived from classification codes. */
export function forecastStartIndex(config: ChartV2Config): number {
  return config.points.findIndex((p) => isForecastCode(p.classificationCode))
}
