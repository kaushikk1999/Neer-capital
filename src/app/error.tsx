'use client';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Monitoring hook: forward to an error tracker (Sentry, etc.) when wired.
    // See src/lib/monitoring.ts — kept dependency-free for now.
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-32 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Something went wrong</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">An unexpected error occurred</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">The issue has been logged. You can try again, or head back to safety.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button>
        <Button href="/" variant="secondary">Back to home</Button>
      </div>
    </section>
  );
}
