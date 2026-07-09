'use client';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// Header action: "Sign out" when authenticated, "Sign in" otherwise.
export function AuthButton() {
  const { status } = useSession();
  const { t } = useLanguage();
  if (status === 'authenticated') {
    return (
      <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
        {t('auth.signOut')}
      </Button>
    );
  }
  return (
    <Button href="/login" variant="secondary" size="sm">
      {t('auth.signIn')}
    </Button>
  );
}
