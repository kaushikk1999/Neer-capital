'use client';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  const { t } = useLanguage();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="relative flex min-h-[80vh] items-center justify-center py-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(91,140,255,0.1),transparent_50%)]" />
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t('error.eyebrow')}</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">{t('error.heading')}</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{t('error.description')}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()} icon={<RefreshCw className="h-4 w-4" />}>{t('error.tryAgain')}</Button>
          <Button href="/" variant="secondary">{t('error.backHome')}</Button>
        </div>
      </div>
    </section>
  );
}
