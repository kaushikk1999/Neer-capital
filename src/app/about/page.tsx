'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function AboutPage() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('about.eyebrow')}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{t('about.heading')}</h1>
      
      <div className="mt-8 space-y-6 text-lg leading-8 text-slate-300">
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>
        <p className="font-medium text-white pt-4">{t('about.p3')}</p>
      </div>
    </section>
  );
}
