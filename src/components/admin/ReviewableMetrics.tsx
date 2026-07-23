"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, X, HelpCircle, Eye, Loader2 } from "lucide-react"
import { EvidenceDrawer, type EvidenceDetail, type VerificationTier } from "@/components/admin/EvidenceDrawer"
import { CSRF_HEADER } from "@/lib/security/csrf-constants"
import { useLanguage } from "@/lib/i18n/LanguageContext"

/**
 * Metric grid with per-field review actions.
 *
 * The reviewer is the last line of defence before publication, so this
 * component is built around making the machine's uncertainty visible: values
 * whose evidence could not be verified are marked, conflicts are flagged, and
 * every action is sent with the revision the reviewer was actually looking at
 * so a concurrent edit cannot be silently overwritten.
 */

export interface ReviewableMetric {
  id: string
  label: string
  value: string
  rawValue: string | null
  unit: string | null
  period: string | null
  classificationCode: string | null
  sourcePage: number | null
  sourceQuote: string | null
  verification: VerificationTier | null
  confidenceLevel: string | null
  validationStatus: string | null
  reviewStatus: string
  provenance: string | null
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  REJECTED: "border-red-400/30 bg-red-400/10 text-red-300",
  MISSING: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  NEEDS_REVIEW: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  NOT_REVIEWED: "border-white/10 bg-white/5 text-gray-400",
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/csrf", { credentials: "same-origin" })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    return data.token ?? null
  } catch {
    return null
  }
}

export function ReviewableMetrics({
  analysisId,
  documentId,
  initialRevision,
  metrics: initialMetrics,
  canReview,
}: {
  analysisId: string
  documentId: string
  initialRevision: number
  metrics: ReviewableMetric[]
  canReview: boolean
}) {
  const { t } = useLanguage()
  const [metrics, setMetrics] = useState(initialMetrics)
  const [revision, setRevision] = useState(initialRevision)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [csrf, setCsrf] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<EvidenceDetail | null>(null)

  useEffect(() => {
    if (canReview) void getCsrfToken().then(setCsrf)
  }, [canReview])

  const act = useCallback(
    async (metric: ReviewableMetric, action: "APPROVE" | "REJECT" | "MARK_MISSING") => {
      setPending(metric.id)
      setError(null)

      const token = csrf ?? (await getCsrfToken())
      if (!token) {
        setError(t("metrics.noToken"))
        setPending(null)
        return
      }
      setCsrf(token)

      try {
        const res = await fetch(`/api/admin/analyses/${analysisId}/review`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", [CSRF_HEADER]: token },
          body: JSON.stringify({
            entityType: "DocumentMetric",
            entityId: metric.id,
            action,
            expectedRevision: revision,
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          reviewStatus?: string
          revision?: number
          message?: string
          error?: string
          currentRevision?: number
        }

        if (res.status === 409) {
          setError(data.message ?? t("metrics.stale"))
          if (typeof data.currentRevision === "number") setRevision(data.currentRevision)
          return
        }
        if (!res.ok || !data.ok) {
          setError(data.message ?? data.error ?? t("metrics.actionFailed"))
          return
        }

        setMetrics((prev) =>
          prev.map((m) => (m.id === metric.id ? { ...m, reviewStatus: data.reviewStatus ?? m.reviewStatus } : m))
        )
        if (typeof data.revision === "number") setRevision(data.revision)
      } catch {
        setError(t("metrics.networkError"))
      } finally {
        setPending(null)
      }
    },
    // t is not memoised by the provider, so this callback is rebuilt each
    // render. That is fine here: it only runs from click handlers, and a
    // stale t would show the previous language after a switch.
    [analysisId, csrf, revision, t]
  )

  const openEvidence = (m: ReviewableMetric) =>
    setDrawer({
      fieldLabel: `${m.label}${m.period ? ` · ${m.period}` : ""}`,
      normalizedValue: m.value,
      rawValue: m.rawValue,
      period: m.period,
      classification: m.classificationCode,
      sourcePage: m.sourcePage,
      quote: m.sourceQuote,
      verification: m.verification,
      extractionMethod: t("evidence.textLayer"),
      confidence: m.confidenceLevel,
      validationStatus: m.validationStatus,
      reviewStatus: m.reviewStatus,
      provenance: m.provenance,
      documentId,
    })

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const unverified = m.verification === "UNVERIFIED" || m.verification === "APPROXIMATE_MATCH"
          const conflicting = m.validationStatus === "CONFLICTING"
          return (
            <div
              key={m.id}
              className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="truncate text-sm text-gray-400" title={m.label}>{m.label}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATUS_STYLE[m.reviewStatus] ?? STATUS_STYLE.NOT_REVIEWED}`}>
                  {m.reviewStatus.replace("_", " ").toLowerCase()}
                </span>
              </div>

              <p className="text-2xl font-bold tracking-tight text-white">
                {m.value}
                {m.unit ? <span className="ml-1 text-base text-gray-400">{m.unit}</span> : null}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                {m.period && <span className="uppercase tracking-wider text-gray-500">{m.period}</span>}
                {conflicting && <span className="text-red-300">{t("metrics.conflicting")}</span>}
                {!conflicting && unverified && <span className="text-amber-300">{t("metrics.unverified")}</span>}
                {m.sourcePage != null && <span className="text-gray-600">p{m.sourcePage}</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => openEvidence(m)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <Eye className="h-3 w-3" /> {t("metrics.evidence")}
                </button>

                {canReview && (
                  <>
                    <button
                      type="button"
                      disabled={pending === m.id}
                      onClick={() => act(m, "APPROVE")}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 px-2 py-1 text-xs text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {pending === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {t("metrics.approve")}
                    </button>
                    <button
                      type="button"
                      disabled={pending === m.id}
                      onClick={() => act(m, "REJECT")}
                      className="inline-flex items-center gap-1 rounded-md border border-red-400/25 px-2 py-1 text-xs text-red-300 transition hover:bg-red-400/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <X className="h-3 w-3" /> {t("metrics.reject")}
                    </button>
                    <button
                      type="button"
                      disabled={pending === m.id}
                      onClick={() => act(m, "MARK_MISSING")}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 px-2 py-1 text-xs text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <HelpCircle className="h-3 w-3" /> {t("metrics.missing")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <EvidenceDrawer detail={drawer} onClose={() => setDrawer(null)} />
    </>
  )
}
