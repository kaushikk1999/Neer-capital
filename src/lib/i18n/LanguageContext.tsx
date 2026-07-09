'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { hi } from './hi';
import { ta } from './ta';
import type { Locale, TranslationDict } from './types';

const dictionaries: Record<Locale, TranslationDict> = { en, hi, ta };

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
