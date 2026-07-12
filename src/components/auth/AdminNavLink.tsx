'use client';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

// UX-only convenience link — shown to ADMINs so they can reach /admin.
// Server-side authorization on /admin remains the authoritative gate.
export function AdminNavLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { data } = useSession();
  if (data?.user?.role !== 'ADMIN') return null;
  return (
    <Link href="/admin" onClick={onClick} className={className ?? 'text-sm text-slate-300 transition hover:text-white'}>
      Admin
    </Link>
  );
}
