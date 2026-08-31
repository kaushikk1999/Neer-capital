'use client';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import type { Locale } from '@/lib/i18n/types';

// Client-side session context so header/UI can read auth state via useSession.
export function Providers({ children, initialLocale = 'en' }: { children: ReactNode; initialLocale?: Locale }) {
  return (
    <SessionProvider>
      <LanguageProvider initialLocale={initialLocale}>
        {children}
      </LanguageProvider>
    </SessionProvider>
  );
}
