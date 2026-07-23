import { impliedUpside } from "@/lib/analysis/calc"
import { formatPerShare, formatPct } from "@/lib/finance/normalize"
import { RecommendationView, type RecField } from "@/components/admin/RecommendationView"

/**
 * The recommendation and valuation block.
 *
 * Two rules are enforced visually, not just in data:
 *
 *  1. Attribution. The rating belongs to the report's analyst. It is labelled
 *     as theirs and is never merged with any NEER view. The old UI showed a
 *     bare "BUY" under an "AI Generated" badge, which read as if the platform
 *     were making the call.
 *  2. Provenance. Every figure says whether the analyst printed it or we
 *     calculated it. A field the report did not disclose says so, rather than
 *     showing a placeholder that looks like data.
 */

interface ValuationDetailLike {
  rating?: string | null
  previousRating?: string | null
  cmp?: string | null
  cmpDate?: string | null
  baseTarget?: string | null
  bullTarget?: string | null
  bearTarget?: string | null
  previousTarget?: string | null
  horizon?: string | null
  valuationBasis?: string | null
  appliedMultiple?: string | null
}

function numeric(v: string | null | undefined): string | null {
  if (v == null) return null
  const cleaned = String(v).replace(/[^\d.-]/g, "")
  return cleaned === "" || !Number.isFinite(Number(cleaned)) ? null : cleaned
}

export function RecommendationCard({
  valuation,
  researchHouse,
}: {
  valuation: ValuationDetailLike | null
  researchHouse?: string | null
}) {
  const v = valuation ?? {}
  const cmp = numeric(v.cmp)
  const base = numeric(v.baseTarget)
  const bull = numeric(v.bullTarget)
  const bear = numeric(v.bearTarget)

  const upside = impliedUpside(base, cmp)
  const bullUpside = impliedUpside(bull, cmp)
  const bearUpside = impliedUpside(bear, cmp)

  const currency = "INR"
  const money = (s: string | null) => (s == null ? null : formatPerShare(Number(s), currency, 0))
  const upsideText = (r: ReturnType<typeof impliedUpside>) =>
    r.value == null ? null : formatPct(Number(r.value), 1)

  const fields: RecField[] = [
    { labelKey: "rec.cmp", value: money(cmp), kind: "reported" },
    { labelKey: "rec.baseTarget", value: money(base), kind: "reported" },
    { labelKey: "rec.impliedUpside", value: upsideText(upside), kind: "calculated" },
    { labelKey: "rec.bullTarget", value: money(bull), kind: "reported" },
    { labelKey: "rec.bullUpside", value: upsideText(bullUpside), kind: "calculated" },
    { labelKey: "rec.bearTarget", value: money(bear), kind: "reported" },
    { labelKey: "rec.bearDownside", value: upsideText(bearUpside), kind: "calculated" },
    { labelKey: "rec.horizon", value: v.horizon ?? null, kind: "reported" },
    { labelKey: "rec.valuationBasis", value: v.valuationBasis ?? null, kind: "reported" },
    { labelKey: "rec.appliedMultiple", value: v.appliedMultiple ?? null, kind: "reported" },
    { labelKey: "rec.previousTarget", value: money(numeric(v.previousTarget)), kind: "reported" },
    { labelKey: "rec.cmpAsOf", value: v.cmpDate ?? null, kind: "reported" },
  ]

  return (
    <RecommendationView
      rating={v.rating ?? null}
      previousRating={v.previousRating ?? null}
      researchHouse={researchHouse ?? null}
      fields={fields}
      unavailableReason={upside.unavailableReason ?? null}
      formula={upside.value != null ? upside.formula : null}
    />
  )
}
