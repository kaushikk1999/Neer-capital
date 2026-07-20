'use client';
import { logos, stats } from '@/lib/data';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function TrustStrip() { 
  const { t } = useLanguage();
  return (
    <section className="border-y border-white/10 bg-white/[0.02] py-10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('trust.headline')}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
              {logos.map((logo) => (
                <span key={logo} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">{logo}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  ); 
}
