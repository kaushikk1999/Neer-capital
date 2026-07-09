'use client';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

// Client-side session context so header/UI can read auth state via useSession.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </SessionProvider>
  );
}
