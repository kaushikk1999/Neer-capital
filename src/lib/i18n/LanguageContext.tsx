'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { en } from './en';
import { hi } from './hi';
import { ta } from './ta';
import type { Locale, TranslationDict } from './types';

const dictionaries: Record<Locale, TranslationDict> = { en, hi, ta };

// Mirror the selected locale into a non-sensitive, root-scoped cookie the
// server can read (server components have no access to localStorage). Same
// key/value as the existing selector — this does not create a second source
// of truth; localStorage remains authoritative on the client.
function writeLocaleCookie(locale: Locale) {
  try {
    document.cookie = `neer_lang=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {
    // Ignore (SSR / restricted environments)
  }
}

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children, initialLocale = 'en' }: { children: ReactNode; initialLocale?: Locale }) {
  // Seed from the server-provided cookie value so the first client render matches
  // the server HTML (no English flash, no hydration mismatch).
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('neer_lang') as Locale;
      if (stored && ['en', 'hi', 'ta'].includes(stored) && stored !== initialLocale) {
        setLocaleState(stored);
        // Keep the cookie in sync so server-rendered pages (report prose) can
        // read the same locale a returning visitor picked in a prior session,
        // then refresh so server-translated content matches on this first load.
        writeLocaleCookie(stored);
        router.refresh();
      }
    } catch (e) {
      // Ignore localStorage errors (e.g. incognito)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    // Client UI (t()) updates instantly on this state change; the cookie +
    // router.refresh() re-render the server components so server-translated
    // content (report titles/summaries, report prose) switches too.
    setLocaleState(newLocale);
    try {
      localStorage.setItem('neer_lang', newLocale);
    } catch (e) {
      // Ignore
    }
    writeLocaleCookie(newLocale);
    router.refresh();
  };

  // `locale` is seeded from the server cookie, so it is already correct on the
  // first render — no need to force English pre-mount (that caused the flash).
  const t = (key: string): string => {
    const dict = dictionaries[locale] || en;
    return dict[key] || en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
