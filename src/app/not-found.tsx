import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-32 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Error 404</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">This page could not be found</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">The page you are looking for may have moved, or the link is out of date. Let&apos;s get you back to trusted ground.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/" icon={<ArrowUpRight className="h-4 w-4" />}>Back to home</Button>
        <Button href="/contact" variant="secondary">Contact us</Button>
      </div>
    </section>
  );
}
