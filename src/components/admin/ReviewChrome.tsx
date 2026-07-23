'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

// The review page stays a server component (requireAdmin plus a Prisma read),
// so its static copy is rendered through these small client helpers rather
// than converting the whole screen.
export function T({ k }: { k: string }) {
  const { t } = useLanguage()
  return <>{t(k)}</>
}

export function ReviewBadge() {
  const { t } = useLanguage()
  return (
    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase">
      {t('review.badge')}
    </span>
  )
}

export function PartialChip() {
  const { t } = useLanguage()
  return (
    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
      {t('review.partialBlocked')}
    </span>
  )
}
