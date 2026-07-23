'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ShieldCheck, User as UserIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// memberSince arrives as an ISO string so the date can be formatted against the
// active locale here, rather than being frozen to en-US on the server.
export function AccountView({
  name,
  email,
  image,
  role,
  isAdmin,
  providers,
  memberSinceISO,
}: {
  name: string | null
  email: string | null
  image: string | null
  role: string
  isAdmin: boolean
  providers: string[]
  memberSinceISO: string | null
}) {
  const { t, locale } = useLanguage()

  const providerText = providers.length
    ? providers.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
    : t('account.emailPassword')

  const localeTag = locale === 'hi' ? 'hi-IN' : locale === 'ta' ? 'ta-IN' : 'en-US'
  const memberSince = memberSinceISO
    ? new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric', day: 'numeric' }).format(new Date(memberSinceISO))
    : t('account.unknown')

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('account.eyebrow')}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t('account.heading')}</h1>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card title={t('account.profile')} className="h-full">
          <div className="mt-6 flex items-center gap-4">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={name || 'Avatar'} className="h-16 w-16 rounded-full border border-white/10" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-blue-300">
                <UserIcon className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium text-white truncate">{name || email}</p>
              <p className="text-sm text-slate-400 truncate">{email}</p>
            </div>
          </div>
        </Card>

        <Card title={t('account.details')} className="h-full">
          <div className="mt-6 space-y-4 text-sm text-slate-300">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-slate-400">{t('account.role')}</span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {role}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-blue-200">
                  {role}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-slate-400">{t('account.signInMethod')}</span>
              <span className="text-white">{providerText}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">{t('account.memberSince')}</span>
              <span className="text-white">{memberSince}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-10 flex gap-4">
        <Button href="/dashboard" variant="secondary" size="sm">
          ← {t('account.back')}
        </Button>
        {isAdmin && (
          <Button href="/admin" variant="primary" size="sm">
            {t('account.adminCta')}
          </Button>
        )}
      </div>
    </section>
  )
}
