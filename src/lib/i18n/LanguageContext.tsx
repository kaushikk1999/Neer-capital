'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('neer_lang') as Locale;
      if (stored && ['en', 'hi', 'ta'].includes(stored)) {
        setLocaleState(stored);
        // Keep the cookie in sync so server-rendered pages (report prose) can
        // read the same locale a returning visitor picked in a prior session.
        writeLocaleCookie(stored);
      }
    } catch (e) {
      // Ignore localStorage errors (e.g. incognito)
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('neer_lang', newLocale);
    } catch (e) {
      // Ignore
    }
    // Non-sensitive, root-scoped cookie mirroring the selector, so the server
    // knows which language to localise AI report prose into.
    writeLocaleCookie(newLocale);
  };

  const t = (key: string): string => {
    if (!mounted) return en[key] || key;
    const dict = dictionaries[locale] || en;
    return dict[key] || en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale: mounted ? locale : 'en', setLocale, t }}>
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
