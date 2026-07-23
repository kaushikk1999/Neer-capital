'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { FileUp, FolderKanban, Send, RefreshCw, Users, Settings } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Module copy is keyed rather than inlined so the tiles translate; the icon and
// href stay here because neither belongs in a dictionary.
const modules = [
  { key: 'upload', icon: FileUp, href: '/admin/upload' },
  { key: 'manage', icon: FolderKanban, href: '/admin/documents' },
  { key: 'publish', icon: Send, href: '/admin/documents' },
  { key: 'reprocess', icon: RefreshCw, href: '/admin/documents' },
  { key: 'users', icon: Users },
  { key: 'settings', icon: Settings },
] as const

export function AdminHome({ email }: { email: string | null }) {
  const { t } = useLanguage()

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('admin.eyebrow')}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t('admin.heading')}</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        {t('admin.signedInAs')} <span className="text-white">{email}</span>. {t('admin.modulesNote')}
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const inner = (
            <Card className="h-full">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-blue-300">
                  <m.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold text-white">{t(`admin.mod.${m.key}.title`)}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{t(`admin.mod.${m.key}.desc`)}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                {'href' in m && m.href ? t('admin.open') : t('admin.comingSoon')}
              </p>
            </Card>
          )
          return 'href' in m && m.href ? (
            <Link key={m.key} href={m.href} className="block transition hover:opacity-90">
              {inner}
            </Link>
          ) : (
            <div key={m.key}>{inner}</div>
          )
        })}
      </div>
    </section>
  )
}
