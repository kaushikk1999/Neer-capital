"use client"

import { useEffect, useRef } from "react"
import { X, FileText, Calculator, AlertTriangle, Quote } from "lucide-react"

/**
 * Provenance panel for a single extracted value.
 *
 * The distinction this panel exists to make visible: an EXACT or NORMALIZED
 * match was located verbatim on the page it cites, whereas an APPROXIMATE or
 * UNVERIFIED excerpt was not. The latter are still shown — deleting them would
 * hide that the model produced something we could not confirm — but they are
 * never presented as a verbatim quote from the report.
 */

export type VerificationTier =
  | "EXACT_MATCH"
  | "NORMALIZED_MATCH"
  | "APPROXIMATE_MATCH"
  | "UNVERIFIED"
  | "CONFLICTING"

export interface EvidenceDetail {
  fieldLabel: string
  normalizedValue: string | null
  rawValue: string | null
  period: string | null
  classification: string | null
  sourcePage: number | null
  quote: string | null
  verification: VerificationTier | null
  extractionMethod: string | null
  confidence: string | null
  validationStatus: string | null
  reviewStatus: string | null
  provenance: string | null
  conflicts?: { value: string | null; page: number | null }[]
  documentId?: string
}

const TIER: Record<VerificationTier, { label: string; cls: string; verbatim: boolean }> = {
  EXACT_MATCH: { label: "Verified verbatim", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", verbatim: true },
  NORMALIZED_MATCH: { label: "Verified (normalised text)", cls: "text-sky-300 border-sky-400/30 bg-sky-400/10", verbatim: true },
  APPROXIMATE_MATCH: { label: "Approximate — not verbatim", cls: "text-amber-300 border-amber-400/30 bg-amber-400/10", verbatim: false },
  UNVERIFIED: { label: "Unverified — could not be located", cls: "text-red-300 border-red-400/30 bg-red-400/10", verbatim: false },
  CONFLICTING: { label: "Conflicting sources", cls: "text-red-300 border-red-400/30 bg-red-400/10", verbatim: false },
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2 text-sm">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right text-gray-200">{value ?? <span className="text-gray-600">Not recorded</span>}</dd>
    </div>
  )
}

export function EvidenceDrawer({
  detail,
  onClose,
}: {
  detail: EvidenceDetail | null
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!detail) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [detail, onClose])

  if (!detail) return null

  const tier = detail.verification ? TIER[detail.verification] : null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Source evidence">
      <button
        type="button"
        aria-label="Close evidence panel"
        onClick={onClose}
        className="flex-1 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0a0f1c] p-6 shadow-2xl sm:max-w-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">Source evidence</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{detail.fieldLabel}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {tier && (
          <p className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tier.cls}`}>
            {tier.verbatim ? <Quote className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {tier.label}
          </p>
        )}

        {detail.quote ? (
          <figure className="mb-5">
            <blockquote
              className={`border-l-2 pl-4 text-sm italic ${
                tier?.verbatim ? "border-blue-500/40 text-gray-300" : "border-amber-500/40 text-gray-400"
              }`}
            >
              &ldquo;{detail.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-2 text-xs text-gray-500">
              {tier?.verbatim
                ? `Located on page ${detail.sourcePage ?? "?"} of the source report.`
                : "This excerpt could not be matched to the cited page and is not shown as a verbatim quote."}
            </figcaption>
          </figure>
        ) : (
          <p className="mb-5 text-sm text-gray-500">No excerpt was captured for this value.</p>
        )}

        <dl className="mb-5">
          <Row label="Normalised value" value={detail.normalizedValue} />
          <Row label="Raw source text" value={detail.rawValue} />
          <Row label="Period" value={detail.period} />
          <Row label="Basis" value={detail.classification} />
          <Row label="Source page" value={detail.sourcePage != null ? String(detail.sourcePage) : null} />
          <Row label="Extraction method" value={detail.extractionMethod} />
          <Row label="Confidence" value={detail.confidence} />
          <Row label="Validation" value={detail.validationStatus} />
          <Row label="Review status" value={detail.reviewStatus} />
          <Row label="Attribution" value={detail.provenance} />
        </dl>

        {detail.conflicts && detail.conflicts.length > 0 && (
          <section className="mb-5 rounded-xl border border-red-500/25 bg-red-950/20 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-300">
              <AlertTriangle className="h-4 w-4" /> Conflicting values in the source
            </h3>
            <ul className="space-y-1 text-sm text-gray-300">
              {detail.conflicts.map((c, i) => (
                <li key={i}>
                  {c.value ?? "—"} <span className="text-gray-500">(page {c.page ?? "?"})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-300/80">
              The report states more than one value here. A reviewer must decide before publication.
            </p>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {detail.documentId && detail.sourcePage != null && (
            <a
              href={`/api/admin/documents/${detail.documentId}/file#page=${detail.sourcePage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <FileText className="h-4 w-4" /> Open source page {detail.sourcePage}
            </a>
          )}
          {detail.provenance === "PLATFORM_CALCULATED" && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-sm text-sky-300">
              <Calculator className="h-4 w-4" /> Calculated by the platform
            </span>
          )}
        </div>
      </aside>
    </div>
  )
}
