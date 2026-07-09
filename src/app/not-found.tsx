'use client';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <section className="relative flex min-h-[80vh] items-center justify-center py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(91,140,255,0.1),transparent_50%)]" />
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('notFound.eyebrow')}</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">{t('notFound.heading')}</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{t('notFound.description')}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button href="/" icon={<ArrowUpRight className="h-4 w-4" />}>{t('notFound.backHome')}</Button>
          <Button href="/contact" variant="secondary">{t('notFound.contactUs')}</Button>
        </div>
      </div>
    </section>
  );
}
