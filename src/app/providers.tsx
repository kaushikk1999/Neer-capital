'use client';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

// Client-side session context so header/UI can read auth state via useSession.
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
