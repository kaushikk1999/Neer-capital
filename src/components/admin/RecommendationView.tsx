'use client'

import { Calculator, FileText } from 'lucide-react'
import { NOT_DISCLOSED } from '@/lib/finance/normalize'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Presentation only. The arithmetic stays in RecommendationCard on the server,
// because @/lib/analysis/calc imports Prisma's Decimal and pulling that into a
// client bundle drags Node built-ins with it and breaks the build.
export type RecField = {
  labelKey: string
  value: string | null
  kind: 'reported' | 'calculated'
}

function ProvenanceTag({ kind }: { kind: 'reported' | 'calculated' }) {
  const { t } = useLanguage()
  return kind === 'reported' ? (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
      <FileText className="h-3 w-3" /> {t('rec.reportedBy')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-sky-400/80">
      <Calculator className="h-3 w-3" /> {t('rec.platformCalc')}
    </span>
  )
}

function Field({ labelKey, value, kind }: RecField) {
  const { t } = useLanguage()
  const disclosed = value != null && value !== ''
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-gray-500">{t(labelKey)}</p>
      <p className={`text-base font-semibold ${disclosed ? 'text-white' : 'text-gray-600'}`}>
        {disclosed ? value : NOT_DISCLOSED}
      </p>
      {disclosed && <ProvenanceTag kind={kind} />}
    </div>
  )
}

export function RecommendationView({
  rating,
  previousRating,
  researchHouse,
  fields,
  unavailableReason,
  formula,
}: {
  rating: string | null
  previousRating: string | null
  researchHouse: string | null
  fields: RecField[]
  unavailableReason: string | null
  formula: string | null
}) {
  const { t } = useLanguage()

  return (
    <section className="space-y-5 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 md:p-8">
      {/* Attribution is explicit: this is the source analyst's call, not ours. */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">
          {t('rec.originalRec')}
          {researchHouse ? ` · ${researchHouse}` : ''}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-white">
          {rating ?? <span className="text-gray-600">{NOT_DISCLOSED}</span>}
        </p>
        <p className="mt-1 text-xs text-gray-500">{t('rec.disclaimer')}</p>
        {previousRating && (
          <p className="mt-2 text-xs text-gray-400">
            {t('rec.previousRating')} <span className="text-gray-300">{previousRating}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.labelKey} {...f} />
        ))}
      </div>

      {unavailableReason && (
        <p className="text-xs text-amber-300/80">
          {t('rec.upsideUnavailable')} {unavailableReason.toLowerCase()}.
        </p>
      )}
      {formula && (
        <p className="text-[11px] text-gray-600">
          {t('rec.formula')} {formula}
        </p>
      )}
    </section>
  )
}
