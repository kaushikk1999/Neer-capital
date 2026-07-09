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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: '180+', labelKey: 'trust.stat.sources' }, 
              { value: '99.98%', labelKey: 'trust.stat.uptime' }, 
              { value: '24/7', labelKey: 'trust.stat.coverage' }, 
              { value: 'SOC 2', labelKey: 'trust.stat.soc' }
            ].map((stat) => (
              <div key={stat.labelKey} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xl font-semibold text-white">{stat.value}</div>
                <div className="mt-1 text-xs text-slate-400">{t(stat.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  ); 
}
