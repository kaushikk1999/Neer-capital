/**
 * Deterministic financial calculations.
 *
 * The language model never computes these. Everything here is code-computed
 * with Decimal arithmetic (no JS floating point on money), and every result
 * carries the formula and the inputs that produced it so the UI can label it
 * "Platform calculated" and the reviewer can audit it.
 *
 * Decimal comes from the Prisma runtime, which already ships decimal.js —
 * no additional dependency is required.
 */

import { Decimal } from "@prisma/client/runtime/library"
import type { DecimalString, ProvenanceTypeT } from "@/lib/report/types"

export interface CalcInput {
  name: string
  value: DecimalString
  /** Metric row or evidence this input came from, when it came from the report. */
  metricId?: string
  period?: string
}

export interface CalcResult {
  value: DecimalString | null
  /** Human-readable formula, e.g. "(target / cmp - 1) x 100". */
  formula: string
  inputs: CalcInput[]
  provenance: ProvenanceTypeT
  /** Set when the calculation could not be performed (missing/invalid inputs). */
  unavailableReason?: string
}

const PLATFORM: ProvenanceTypeT = "PLATFORM_CALCULATED"

/** Parses a canonical decimal string. Returns null for missing/invalid input. */
export function toDecimal(v: DecimalString | number | null | undefined): Decimal | null {
  if (v == null || v === "") return null
  try {
    const d = new Decimal(typeof v === "number" ? String(v) : v.trim())
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

export function toDecimalString(d: Decimal, dp = 4): DecimalString {
  return d.toDecimalPlaces(dp).toString()
}

function unavailable(formula: string, inputs: CalcInput[], reason: string): CalcResult {
  return { value: null, formula, inputs, provenance: PLATFORM, unavailableReason: reason }
}

// ---------------------------------------------------------------------------
// Core valuation / return maths
// ---------------------------------------------------------------------------

/** Implied upside/downside in percent: (target / cmp - 1) x 100 */
export function impliedUpside(
  target: DecimalString | null | undefined,
  cmp: DecimalString | null | undefined,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "(target / cmp - 1) x 100"
  const t = toDecimal(target)
  const c = toDecimal(cmp)
  if (!t || !c) return unavailable(formula, inputs, "Target price or CMP not available")
  if (c.isZero()) return unavailable(formula, inputs, "CMP is zero")
  return {
    value: toDecimalString(t.div(c).minus(1).mul(100), 2),
    formula,
    inputs,
    provenance: PLATFORM,
  }
}

/** Margin in percent: (numerator / revenue) x 100 — used for EBITDA/net margin. */
export function marginPct(
  numerator: DecimalString | null | undefined,
  revenue: DecimalString | null | undefined,
  label = "margin",
  inputs: CalcInput[] = []
): CalcResult {
  const formula = `(${label} numerator / revenue) x 100`
  const n = toDecimal(numerator)
  const r = toDecimal(revenue)
  if (!n || !r) return unavailable(formula, inputs, "Numerator or revenue not available")
  if (r.isZero()) return unavailable(formula, inputs, "Revenue is zero")
  return { value: toDecimalString(n.div(r).mul(100), 2), formula, inputs, provenance: PLATFORM }
}

/** Enterprise value: metric x multiple (e.g. EBITDA x EV/EBITDA). */
export function evFromMultiple(
  metric: DecimalString | null | undefined,
  multiple: DecimalString | null | undefined,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "metric x multiple"
  const m = toDecimal(metric)
  const x = toDecimal(multiple)
  if (!m || !x) return unavailable(formula, inputs, "Metric or multiple not available")
  return { value: toDecimalString(m.mul(x)), formula, inputs, provenance: PLATFORM }
}

/** Equity value bridge: EV - net debt + investments - minority + other. */
export function equityFromEV(
  ev: DecimalString | null | undefined,
  netDebt: DecimalString | null | undefined,
  opts: {
    investments?: DecimalString | null
    minorityInterest?: DecimalString | null
    otherAdjustments?: DecimalString | null
  } = {},
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "EV - net debt + investments - minority interest + other adjustments"
  const e = toDecimal(ev)
  const nd = toDecimal(netDebt)
  if (!e || !nd) return unavailable(formula, inputs, "Enterprise value or net debt not available")
  const inv = toDecimal(opts.investments) ?? new Decimal(0)
  const mi = toDecimal(opts.minorityInterest) ?? new Decimal(0)
  const other = toDecimal(opts.otherAdjustments) ?? new Decimal(0)
  return {
    value: toDecimalString(e.minus(nd).plus(inv).minus(mi).plus(other)),
    formula,
    inputs,
    provenance: PLATFORM,
  }
}

/** Target price from equity value: equity value / diluted shares. */
export function targetFromEquity(
  equityValue: DecimalString | null | undefined,
  dilutedShares: DecimalString | null | undefined,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "equity value / diluted shares"
  const e = toDecimal(equityValue)
  const s = toDecimal(dilutedShares)
  if (!e || !s) return unavailable(formula, inputs, "Equity value or diluted share count not available")
  if (s.isZero()) return unavailable(formula, inputs, "Diluted share count is zero")
  return { value: toDecimalString(e.div(s), 2), formula, inputs, provenance: PLATFORM }
}

/** Target price from earnings: EPS x P/E. */
export function targetFromEPS(
  eps: DecimalString | null | undefined,
  pe: DecimalString | null | undefined,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "EPS x P/E"
  const e = toDecimal(eps)
  const p = toDecimal(pe)
  if (!e || !p) return unavailable(formula, inputs, "EPS or P/E not available")
  return { value: toDecimalString(e.mul(p), 2), formula, inputs, provenance: PLATFORM }
}

/** Free cash flow: operating cash flow - capex. */
export function freeCashFlow(
  ocf: DecimalString | null | undefined,
  capex: DecimalString | null | undefined,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "operating cash flow - capex"
  const o = toDecimal(ocf)
  const c = toDecimal(capex)
  if (!o || !c) return unavailable(formula, inputs, "Operating cash flow or capex not available")
  // Capex is often reported as a negative outflow; use magnitude consistently.
  return { value: toDecimalString(o.minus(c.abs())), formula, inputs, provenance: PLATFORM }
}

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

/** Year-on-year growth in percent: (current / prior - 1) x 100 */
export function growthYoY(
  current: DecimalString | null | undefined,
  prior: DecimalString | null | undefined,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "(current / prior - 1) x 100"
  const c = toDecimal(current)
  const p = toDecimal(prior)
  if (!c || !p) return unavailable(formula, inputs, "Current or prior period value not available")
  if (p.isZero()) return unavailable(formula, inputs, "Prior period value is zero")
  if (p.isNegative()) {
    return unavailable(formula, inputs, "Growth is not meaningful from a negative base")
  }
  return { value: toDecimalString(c.div(p).minus(1).mul(100), 2), formula, inputs, provenance: PLATFORM }
}

/** CAGR in percent: ((end / start)^(1/years) - 1) x 100 */
export function cagr(
  start: DecimalString | null | undefined,
  end: DecimalString | null | undefined,
  years: number,
  inputs: CalcInput[] = []
): CalcResult {
  const formula = "((end / start)^(1/years) - 1) x 100"
  const s = toDecimal(start)
  const e = toDecimal(end)
  if (!s || !e) return unavailable(formula, inputs, "Start or end value not available")
  if (s.lessThanOrEqualTo(0)) return unavailable(formula, inputs, "CAGR requires a positive start value")
  if (!Number.isFinite(years) || years <= 0) {
    return unavailable(formula, inputs, "Period length not available")
  }
  // Decimal.pow accepts a fractional exponent.
  const ratio = e.div(s)
  if (ratio.lessThanOrEqualTo(0)) return unavailable(formula, inputs, "CAGR requires a positive end value")
  const value = ratio.pow(new Decimal(1).div(years)).minus(1).mul(100)
  return { value: toDecimalString(value, 2), formula, inputs, provenance: PLATFORM }
}

// ---------------------------------------------------------------------------
// Arithmetic agreement (used by the validation engine)
// ---------------------------------------------------------------------------

/**
 * Checks whether a reported figure agrees with a computed one within a
 * tolerance, expressed as a fraction (0.01 = 1%). Rounding in source tables is
 * expected, so exact equality is never required.
 */
export function agreesWithin(
  reported: DecimalString | null | undefined,
  computed: DecimalString | null | undefined,
  tolerance = 0.01
): { agrees: boolean; deltaPct: DecimalString | null } {
  const r = toDecimal(reported)
  const c = toDecimal(computed)
  if (!r || !c) return { agrees: false, deltaPct: null }
  if (r.isZero() && c.isZero()) return { agrees: true, deltaPct: "0" }
  const base = r.isZero() ? c : r
  const delta = r.minus(c).div(base.abs()).mul(100)
  return {
    agrees: delta.abs().lessThanOrEqualTo(new Decimal(tolerance).mul(100)),
    deltaPct: toDecimalString(delta, 4),
  }
}
