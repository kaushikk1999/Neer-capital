'use client'

import Link from 'next/link'
import { FileText, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// The page stays a server component so the Prisma query runs on the server;
// only the presentation moves here, because useLanguage needs a client
// boundary. Titles, summaries and dates come from the analysed documents and
// are shown in whatever language the source PDF used — the switcher governs
// the interface, not the research content.
export type ReportCard = {
  id: string
  slug: string
  title: string
  summary: string | null
  updatedAt: string
}

export function ReportsIndex({ reports }: { reports: ReportCard[] }) {
  const { t } = useLanguage()

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <header className="mb-16 relative">
        <div className="absolute inset-0 bg-blue-500/10 blur-[100px] -z-10 rounded-full" />
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-6">
          {t('reports.heading')}
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl">{t('reports.subtitle')}</p>
      </header>

      {reports.length === 0 ? (
        <div className="text-center py-20 border border-white/5 rounded-3xl bg-white/[0.02]">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-300">{t('reports.empty.title')}</h3>
          <p className="text-gray-500 mt-2">{t('reports.empty.body')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((doc) => (
            <Link
              key={doc.id}
              href={`/reports/${doc.slug}`}
              className="group p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10 transition-all block relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />

              <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-4">
                <span className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
                  <FileText className="w-3 h-3" />
                  {t('reports.badge')}
                </span>
                <span className="text-gray-500">{new Date(doc.updatedAt).toLocaleDateString()}</span>
              </div>

              <h2 className="text-xl font-bold text-white mb-3 line-clamp-2 group-hover:text-blue-200 transition-colors">
                {doc.title}
              </h2>

              {doc.summary && <p className="text-sm text-gray-400 line-clamp-3 mb-6">{doc.summary}</p>}

              <div className="flex items-center text-sm text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                {t('reports.viewFull')} <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
