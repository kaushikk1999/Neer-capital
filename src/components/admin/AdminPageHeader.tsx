'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Shared translated chrome for the admin sub-pages, which are server
// components so they can run requireAdmin and query Prisma.
export function AdminHeading({ headingKey, introKey }: { headingKey: string; introKey?: string }) {
  const { t } = useLanguage()
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('admin.eyebrow')}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t(headingKey)}</h1>
      {introKey && <p className="mt-6 text-lg leading-8 text-slate-300">{t(introKey)}</p>}
    </>
  )
}

export function AdminLink({ href, labelKey, className }: { href: string; labelKey: string; className?: string }) {
  const { t } = useLanguage()
  return (
    <Link href={href} className={className ?? 'text-blue-400 hover:text-blue-300'}>
      {t(labelKey)}
    </Link>
  )
}

export function AdminButtonLink({ href, labelKey }: { href: string; labelKey: string }) {
  const { t } = useLanguage()
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
    >
      {t(labelKey)}
    </Link>
  )
}
