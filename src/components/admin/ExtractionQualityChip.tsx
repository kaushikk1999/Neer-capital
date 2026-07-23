"use client"

import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle } from "lucide-react"
import type { QualityCoverage } from "@/lib/report/types"
import { useLanguage } from "@/lib/i18n/LanguageContext"

/**
 * Replaces the old "100% Confidence" badge.
 *
 * That badge was a single global certainty claim produced by a synthetic
 * score, and it was wrong in a way that mattered: a financial PDF can carry
 * OCR errors, ambiguous periods, mixed units and contradictory tables, none of
 * which a single percentage can honestly express.
 *
 * What we show instead is measured coverage — how much of what we extracted is
 * backed by verified source evidence, what conflicts, and what still needs a
 * human. No number here is an accuracy claim; accuracy would require a labelled
 * golden dataset we do not have.
 */

const TIER_STYLE: Record<QualityCoverage["tier"], { cls: string; Icon: typeof ShieldCheck }> = {
  EXCELLENT: { cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", Icon: ShieldCheck },
  GOOD: { cls: "border-sky-400/30 bg-sky-400/10 text-sky-300", Icon: ShieldCheck },
  FAIR: { cls: "border-amber-400/30 bg-amber-400/10 text-amber-300", Icon: ShieldQuestion },
  POOR: { cls: "border-red-400/30 bg-red-400/10 text-red-300", Icon: ShieldAlert },
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function ExtractionQualityChip({ coverage }: { coverage: QualityCoverage | null }) {
  const { t } = useLanguage()
  if (!coverage) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-gray-400">
        <ShieldQuestion className="h-3.5 w-3.5" />
        {t("quality.notAssessed")}
      </span>
    )
  }

  const { cls, Icon } = TIER_STYLE[coverage.tier]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
      title={`Coverage formula ${coverage.formulaVersion}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {t("quality.prefix")} {t(`quality.tier.${coverage.tier}`)}
    </span>
  )
}

/** The detail panel behind the chip — the numbers that justify the label. */
export function ExtractionQualityPanel({ coverage }: { coverage: QualityCoverage | null }) {
  const { t } = useLanguage()
  if (!coverage) return null

  const stats: { label: string; value: string; warn?: boolean }[] = [
    { label: t("quality.numericCoverage"), value: pct(coverage.numericSourceCoverage) },
    { label: t("quality.narrativeCoverage"), value: pct(coverage.narrativeEvidenceCoverage) },
    { label: t("quality.verified"), value: String(coverage.verifiedCount) },
    { label: t("quality.conflicts"), value: String(coverage.conflictCount), warn: coverage.conflictCount > 0 },
    { label: t("quality.missing"), value: String(coverage.missingCriticalCount), warn: coverage.missingCriticalCount > 0 },
    { label: t("quality.needsReview"), value: String(coverage.reviewRequiredCount), warn: coverage.reviewRequiredCount > 0 },
  ]

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-widest text-gray-400">{t("quality.label")}</h3>
        <ExtractionQualityChip coverage={coverage} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-gray-500">{s.label}</dt>
            <dd className={`text-lg font-semibold ${s.warn ? "text-amber-300" : "text-white"}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
        <span>
          {t("quality.footnote")} ({coverage.denominator.metrics} / {coverage.denominator.sections} /{" "}
          {coverage.denominator.criticalFields})
        </span>
      </p>
    </section>
  )
}
