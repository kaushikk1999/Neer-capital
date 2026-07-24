'use client';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function Hero() {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(91,140,255,0.22),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(217,181,110,0.18),transparent_25%),radial-gradient(circle_at_60%_80%,rgba(54,211,153,0.12),transparent_20%)]" />
      {/* Single column since the illustrative "Live AI workflow" panel was
          removed: its query, sources and answer were fabricated constants, not
          a real query against a report. */}
      <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('hero.eyebrow')}</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">{t('hero.heading')}</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-300">{t('hero.description')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/contact" icon={<ArrowUpRight className="h-4 w-4" />}>{t('hero.cta')}</Button>
        </div>
      </div>
    </section>
  );
}
