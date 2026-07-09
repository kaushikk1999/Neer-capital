'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
export default function SourcesPage() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('sources.eyebrow')}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t('sources.heading')}</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">{t('sources.subtitle')}</p>
    </section>
  );
}
