/**
 * Deterministic financial normalization and presentation.
 *
 * Two rules drive this module:
 *  1. The raw source string is never lost — we normalize *alongside* it.
 *  2. Metric names are not synonyms. Revenue, Total operating income, EBITDA,
 *     EBIT, Reported PAT, Adjusted PAT and EPS are distinct concepts and are
 *     mapped to a controlled taxonomy while the analyst's own label is kept.
 */

import type { ClassificationCodeT, PeriodTypeT } from "@/lib/report/types"

// ---------------------------------------------------------------------------
// Scale / currency
// ---------------------------------------------------------------------------

export type Scale = "absolute" | "thousand" | "lakh" | "million" | "crore" | "billion"

const SCALE_MULTIPLIER: Record<Scale, number> = {
  absolute: 1,
  thousand: 1e3,
  lakh: 1e5,
  million: 1e6,
  crore: 1e7,
  billion: 1e9,
}

const SCALE_LABEL: Record<Scale, string> = {
  absolute: "",
  thousand: "k",
  lakh: "lakh",
  million: "mn",
  crore: "cr",
  billion: "bn",
}

const SCALE_ALIASES: [RegExp, Scale][] = [
  [/\b(cr|crore|crores)\b/i, "crore"],
  [/\b(lakh|lac|lakhs)\b/i, "lakh"],
  [/\b(mn|mm|million|millions)\b/i, "million"],
  [/\b(bn|billion|billions)\b/i, "billion"],
  [/\b(k|thousand|thousands)\b/i, "thousand"],
]

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
}

const CURRENCY_ALIASES: [RegExp, string][] = [
  [/(₹|\bRs\.?\b|\bINR\b|\bRupees?\b)/i, "INR"],
  [/(\$|\bUSD\b|\bUS\$)/i, "USD"],
  [/(€|\bEUR\b)/i, "EUR"],
  [/(£|\bGBP\b)/i, "GBP"],
  [/(¥|\bJPY\b)/i, "JPY"],
]

export function normalizeScale(input: string | null | undefined): Scale | null {
  if (!input) return null
  for (const [re, scale] of SCALE_ALIASES) if (re.test(input)) return scale
  return null
}

export function normalizeCurrency(input: string | null | undefined): string | null {
  if (!input) return null
  for (const [re, code] of CURRENCY_ALIASES) if (re.test(input)) return code
  const upper = input.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(upper) ? upper : null
}

export function scaleMultiplier(scale: Scale | null | undefined): number {
  return scale ? SCALE_MULTIPLIER[scale] : 1
}

// ---------------------------------------------------------------------------
// Raw value parsing
// ---------------------------------------------------------------------------

export interface ParsedValue {
  /** Numeric magnitude as written, before scale is applied. null when absent. */
  value: number | null
  currency: string | null
  scale: Scale | null
  unit: string | null
  isPercent: boolean
  isMultiple: boolean
  /** Untouched source text. */
  raw: string
}

/**
 * Parses "Rs 741 Cr", "₹1,234.5", "(52.3)", "9.5%", "3.0x" without guessing.
 * A string with no digits yields value:null rather than a fabricated 0.
 */
export function parseRawValue(raw: string | null | undefined): ParsedValue {
  const text = (raw ?? "").trim()
  const empty: ParsedValue = {
    value: null,
    currency: null,
    scale: null,
    unit: null,
    isPercent: false,
    isMultiple: false,
    raw: text,
  }
  if (!text) return empty

  const isPercent = /%|\bpercent\b|\bbps\b/i.test(text)
  const isMultiple = /(\d\s*[x×])|\btimes\b/i.test(text)
  // Accounting negatives: (52.3) means -52.3
  const bracketNegative = /\(\s*[\d,.]+\s*\)/.test(text)

  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return { ...empty, isPercent, isMultiple }

  let value = parseFloat(match[0])
  if (!Number.isFinite(value)) return { ...empty, isPercent, isMultiple }
  if (bracketNegative && value > 0) value = -value

  return {
    value,
    currency: normalizeCurrency(text),
    scale: normalizeScale(text),
    unit: isPercent ? "%" : isMultiple ? "x" : null,
    isPercent,
    isMultiple,
    raw: text,
  }
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

function group(n: number, decimals: number): string {
  const fixed = Math.abs(n).toFixed(decimals)
  const [int, frac] = fixed.split(".")
  const withSeparators = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const body = frac ? `${withSeparators}.${frac}` : withSeparators
  return n < 0 ? `-${body}` : body
}

/** e.g. formatMoney(11977, "INR", "crore") -> "₹11,977 cr" */
export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
  scale?: Scale | null,
  decimals = 0
): string {
  if (value == null || !Number.isFinite(value)) return NOT_AVAILABLE
  const symbol = currency ? (CURRENCY_SYMBOL[currency] ?? `${currency} `) : ""
  const suffix = scale ? ` ${SCALE_LABEL[scale]}` : ""
  return `${symbol}${group(value, decimals)}${suffix}`.trim()
}

/** e.g. formatPerShare(205, "INR") -> "₹205/share" */
export function formatPerShare(
  value: number | null | undefined,
  currency?: string | null,
  decimals = 0
): string {
  if (value == null || !Number.isFinite(value)) return NOT_AVAILABLE
  const symbol = currency ? (CURRENCY_SYMBOL[currency] ?? `${currency} `) : ""
  return `${symbol}${group(value, decimals)}/share`
}

/** e.g. formatPct(9.5) -> "9.5%" (no space before the sign) */
export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return NOT_AVAILABLE
  return `${group(value, decimals)}%`
}

/** e.g. formatMultiple(3) -> "3.0×" */
export function formatMultiple(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return NOT_AVAILABLE
  return `${group(value, decimals)}×`
}

export const NOT_AVAILABLE = "—"
export const NOT_DISCLOSED = "Not disclosed in source report"
export const NOT_FOUND_IN_SOURCE = "Value not available in source report"

// ---------------------------------------------------------------------------
// Fiscal periods
// ---------------------------------------------------------------------------

export interface ParsedPeriod {
  label: string
  periodType: PeriodTypeT
  fiscalYearEnd: number
  quarter: number | null
  sortKey: number
}

/**
 * Understands FY26, FY2026, FY25-26, Q3FY26, 3QFY26, TTM.
 * Returns null rather than guessing when the period cannot be read.
 */
export function parsePeriod(input: string | null | undefined): ParsedPeriod | null {
  if (!input) return null
  const text = input.trim().toUpperCase().replace(/\s+/g, "")

  const toFullYear = (y: string): number => {
    const n = parseInt(y, 10)
    if (Number.isNaN(n)) return NaN
    return n < 100 ? 2000 + n : n
  }

  // Quarter: Q3FY26 or 3QFY26
  const q = text.match(/^(?:Q(\d)FY|(\d)QFY)(\d{2,4})/)
  if (q) {
    const quarter = parseInt(q[1] ?? q[2], 10)
    const year = toFullYear(q[3])
    if (Number.isFinite(year) && quarter >= 1 && quarter <= 4) {
      return {
        label: `Q${quarter}FY${String(year).slice(-2)}`,
        periodType: "QUARTER",
        fiscalYearEnd: year,
        quarter,
        sortKey: year * 10 + quarter,
      }
    }
  }

  if (/^TTM/.test(text)) {
    const y = text.match(/(\d{2,4})/)
    const year = y ? toFullYear(y[1]) : new Date().getFullYear()
    return {
      label: "TTM",
      periodType: "TTM",
      fiscalYearEnd: year,
      quarter: null,
      sortKey: year * 10 + 9,
    }
  }

  // Annual: FY26, FY2026, FY25-26 (the later year is the fiscal year end)
  const a = text.match(/^FY(\d{2,4})(?:[-/](\d{2,4}))?/)
  if (a) {
    const year = toFullYear(a[2] ?? a[1])
    if (Number.isFinite(year)) {
      return {
        label: `FY${String(year).slice(-2)}`,
        periodType: "ANNUAL",
        fiscalYearEnd: year,
        quarter: null,
        sortKey: year * 10,
      }
    }
  }

  return null
}

/** e.g. formatPeriod("FY26", "E") -> "FY26E" */
export function formatPeriod(
  period: string | null | undefined,
  code?: ClassificationCodeT | null
): string {
  const parsed = parsePeriod(period)
  const base = parsed ? parsed.label : (period ?? "").trim()
  if (!base) return NOT_AVAILABLE
  // AI/U are internal qualifiers, not source-report period suffixes.
  const suffix = code && code !== "AI" && code !== "U" ? code : ""
  return `${base}${suffix}`
}

// ---------------------------------------------------------------------------
// Metric taxonomy — controlled keys, source label preserved separately
// ---------------------------------------------------------------------------

export type TaxonomyKey =
  | "revenue"
  | "total_operating_income"
  | "operating_income"
  | "operating_profit"
  | "gross_profit"
  | "ebitda"
  | "ebit"
  | "finance_cost"
  | "pbt"
  | "tax"
  | "pat_reported"
  | "pat_adjusted"
  | "eps_basic"
  | "eps_diluted"
  | "ebitda_margin"
  | "net_margin"
  | "roe"
  | "roce"
  | "net_debt"
  | "gross_debt"
  | "net_debt_ebitda"
  | "ocf"
  | "capex"
  | "fcf"
  | "unmapped"

/** Order matters: the most specific pattern must win. */
const TAXONOMY_PATTERNS: [RegExp, TaxonomyKey][] = [
  [/adjusted\s*(pat|profit after tax|net profit)|apat/i, "pat_adjusted"],
  [/reported\s*(pat|profit after tax|net profit)|^pat\b|profit after tax|net profit/i, "pat_reported"],
  [/diluted\s*eps|eps.*diluted/i, "eps_diluted"],
  [/basic\s*eps|eps.*basic|^eps\b/i, "eps_basic"],
  [/ebitda\s*margin/i, "ebitda_margin"],
  [/net\s*margin|pat\s*margin/i, "net_margin"],
  [/net\s*debt\s*\/?\s*ebitda/i, "net_debt_ebitda"],
  [/net\s*debt/i, "net_debt"],
  [/gross\s*debt|total\s*debt/i, "gross_debt"],
  [/ebitda/i, "ebitda"],
  [/\bebit\b/i, "ebit"],
  [/total\s*operating\s*income|\btoi\b/i, "total_operating_income"],
  [/operating\s*profit/i, "operating_profit"],
  [/operating\s*income/i, "operating_income"],
  [/gross\s*profit/i, "gross_profit"],
  [/finance\s*cost|interest\s*expense/i, "finance_cost"],
  [/profit\s*before\s*tax|\bpbt\b/i, "pbt"],
  [/^tax\b|tax\s*expense/i, "tax"],
  [/free\s*cash\s*flow|\bfcf\b/i, "fcf"],
  [/operating\s*cash\s*flow|\bocf\b|cash\s*from\s*operations/i, "ocf"],
  [/capex|capital\s*expenditure/i, "capex"],
  [/\broce\b/i, "roce"],
  [/\broe\b/i, "roe"],
  [/revenue|net\s*sales|turnover/i, "revenue"],
]

/**
 * Maps an analyst's label to a controlled key. Returns "unmapped" rather than
 * forcing a near-match, so distinct concepts never silently merge.
 */
export function resolveTaxonomy(sourceLabel: string | null | undefined): TaxonomyKey {
  if (!sourceLabel) return "unmapped"
  for (const [re, key] of TAXONOMY_PATTERNS) if (re.test(sourceLabel)) return key
  return "unmapped"
}
