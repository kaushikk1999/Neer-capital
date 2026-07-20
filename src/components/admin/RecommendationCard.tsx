import { Calculator, FileText } from "lucide-react"
import { impliedUpside } from "@/lib/analysis/calc"
import { formatPerShare, formatPct, NOT_DISCLOSED } from "@/lib/finance/normalize"

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

function ProvenanceTag({ kind }: { kind: "reported" | "calculated" }) {
  return kind === "reported" ? (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
      <FileText className="h-3 w-3" /> Reported by analyst
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-sky-400/80">
      <Calculator className="h-3 w-3" /> Platform calculated
    </span>
  )
}

function Field({
  label,
  value,
  kind,
}: {
  label: string
  value: string | null
  kind: "reported" | "calculated"
}) {
  const disclosed = value != null && value !== ""
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-semibold ${disclosed ? "text-white" : "text-gray-600"}`}>
        {disclosed ? value : NOT_DISCLOSED}
      </p>
      {disclosed && <ProvenanceTag kind={kind} />}
    </div>
  )
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

  return (
    <section className="space-y-5 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 md:p-8">
      {/* Attribution is explicit: this is the source analyst's call, not ours. */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">
          Original analyst recommendation{researchHouse ? ` · ${researchHouse}` : ""}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-white">
          {v.rating ?? <span className="text-gray-600">{NOT_DISCLOSED}</span>}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          AI-extracted from the uploaded report. NEER has not issued an independent view on this security.
        </p>
        {v.previousRating && (
          <p className="mt-2 text-xs text-gray-400">
            Previous rating: <span className="text-gray-300">{v.previousRating}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
        <Field label="Current market price" value={money(cmp)} kind="reported" />
        <Field label="Base target" value={money(base)} kind="reported" />
        <Field label="Implied upside" value={upsideText(upside)} kind="calculated" />
        <Field label="Bull target" value={money(bull)} kind="reported" />
        <Field label="Bull upside" value={upsideText(bullUpside)} kind="calculated" />
        <Field label="Bear target" value={money(bear)} kind="reported" />
        <Field label="Bear downside" value={upsideText(bearUpside)} kind="calculated" />
        <Field label="Target horizon" value={v.horizon ?? null} kind="reported" />
        <Field label="Valuation basis" value={v.valuationBasis ?? null} kind="reported" />
        <Field label="Applied multiple" value={v.appliedMultiple ?? null} kind="reported" />
        <Field label="Previous target" value={money(numeric(v.previousTarget))} kind="reported" />
        <Field label="CMP as of" value={v.cmpDate ?? null} kind="reported" />
      </div>

      {upside.unavailableReason && (
        <p className="text-xs text-amber-300/80">
          Upside not calculable: {upside.unavailableReason.toLowerCase()}.
        </p>
      )}
      {upside.value != null && (
        <p className="text-[11px] text-gray-600">Formula: {upside.formula}</p>
      )}
    </section>
  )
}
