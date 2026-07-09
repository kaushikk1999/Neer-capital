'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/types';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  const languages: { code: Locale; labelKey: string }[] = [
    { code: 'en', labelKey: 'lang.en' },
    { code: 'hi', labelKey: 'lang.hi' },
    { code: 'ta', labelKey: 'lang.ta' },
  ];

  return (
    <div className={cn('flex items-center gap-1 sm:gap-2', className)}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLocale(lang.code)}
          className={cn(
            'px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap',
            locale === lang.code
              ? 'bg-white/10 text-white font-medium border border-white/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          )}
          aria-label={`Switch to ${t(lang.labelKey)}`}
        >
          {t(lang.labelKey)}
        </button>
      ))}
    </div>
  );
}
