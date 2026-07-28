'use client'

import { MessageSquare, ArrowUpRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/**
 * Entry point to the external feedback form.
 *
 * The form lives in Google Forms rather than in the app: responses land in a
 * sheet the research team controls, and questions can change without a deploy.
 *
 * The URL is environment-driven and the block renders nothing when it is unset,
 * so this ships ahead of the form existing and appears the moment the variable
 * is filled in — no code change, no broken link in between.
 *
 * Two placements share this component:
 *  - a report page passes the report's title, which prefills the form's "which
 *    report" field so the response is attributable;
 *  - the home page passes nothing, giving a general website-feedback prompt with
 *    no prefill. The same form receives both.
 */
export function FeedbackPrompt({ reportSlug, reportTitle }: { reportSlug?: string; reportTitle?: string } = {}) {
  const { t } = useLanguage()

  const base = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL
  if (!base) return null

  const report = reportTitle || reportSlug
  const entryId = process.env.NEXT_PUBLIC_FEEDBACK_FORM_ENTRY

  // Prefill the "which report" field only on a report page. On the home page
  // there is no report, so the link opens the form with that field blank.
  const href =
    report && entryId
      ? `${base}${base.includes('?') ? '&' : '?'}usp=pp_url&${encodeURIComponent(entryId)}=${encodeURIComponent(report)}`
      : base

  const headingKey = report ? 'feedback.heading' : 'feedback.generalHeading'
  const bodyKey = report ? 'feedback.body' : 'feedback.generalBody'

  return (
    <section className="mb-20 rounded-3xl border border-blue-500/20 bg-blue-500/[0.04] p-8 md:p-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h3 className="flex items-center gap-3 text-xl font-semibold text-white">
            <MessageSquare className="h-5 w-5 shrink-0 text-blue-400" />
            {t(headingKey)}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">{t(bodyKey)}</p>
        </div>
        <div className="shrink-0">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
          >
            {t('feedback.cta')}
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <p className="mt-2 text-center text-xs text-gray-500">{t('feedback.time')}</p>
        </div>
      </div>
    </section>
  )
}
