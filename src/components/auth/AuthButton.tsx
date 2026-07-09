'use client';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';

// Header action: "Sign out" when authenticated, "Sign in" otherwise.
export function AuthButton() {
  const { status } = useSession();
  if (status === 'authenticated') {
    return (
      <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
        Sign out
      </Button>
    );
  }
  return (
    <Button href="/login" variant="secondary" size="sm">
      Sign in
    </Button>
  );
}
