'use client';
import { useSession } from 'next-auth/react';
import { ShieldCheck } from 'lucide-react';

// Small badge shown next to the Sign-out button for ADMIN users
// (the seeded admin emails). Purely informational — the server-side
// guards on /admin remain the authoritative access control.
export function AdminBadge({ className = '' }: { className?: string }) {
  const { data } = useSession();
  
  const adminEmails = ['kaushikds1999@gmail.com', 'comms.neercapital@gmail.com'];
  const userEmail = data?.user?.email?.toLowerCase();
  const isEmailAdmin = userEmail && adminEmails.includes(userEmail);
  const isRoleAdmin = data?.user?.role === 'ADMIN';

  if (!isEmailAdmin && !isRoleAdmin) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ${className}`}
      title={`Logged in as admin${data?.user?.email ? ` (${data.user.email})` : ''}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Logged in as admin
    </span>
  );
}
