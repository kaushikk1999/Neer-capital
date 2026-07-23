'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Session data is resolved on the server and passed in; only the copy is
// translated here. The role string stays untranslated on purpose — it is the
// literal value stored on the account, and matches what the admin tooling shows.
export function DashboardHome({
  name,
  email,
  role,
  isAdmin,
}: {
  name: string | null
  email: string | null
  role: string
  isAdmin: boolean
}) {
  const { t } = useLanguage()

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('dash.eyebrow')}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {t('dash.welcome')}
        {name ? `, ${name}` : ''}
      </h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        {t('dash.signedInAs')} <span className="text-white">{email}</span>{' '}
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-blue-200">{role}</span>
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card title={t('dash.account.title')} className="h-full">
          <p className="mt-3 text-sm leading-6 text-slate-300">{t('dash.account.body')}</p>
          <div className="mt-5">
            <Button href="/dashboard/account" size="sm">
              {t('dash.account.cta')}
            </Button>
          </div>
        </Card>
        {isAdmin && (
          <Card title={t('dash.admin.title')} className="h-full">
            <p className="mt-3 text-sm leading-6 text-slate-300">{t('dash.admin.body')}</p>
            <div className="mt-5">
              <Button href="/admin" size="sm">
                {t('dash.admin.cta')}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <p className="mt-10 text-sm text-slate-400">
        {t('dash.needHelp')}{' '}
        <Link href="/contact" className="text-blue-400 hover:text-blue-300">
          {t('dash.contactUs')}
        </Link>
      </p>
    </section>
  )
}
