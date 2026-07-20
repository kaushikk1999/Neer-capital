'use client';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { Menu, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { navItems } from '@/lib/data';
import { Button } from '@/components/ui/Button';
import { AuthButton } from '@/components/auth/AuthButton';
import { AdminNavLink } from '@/components/auth/AdminNavLink';
import { AdminBadge } from '@/components/auth/AdminBadge';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function Header() { 
  const [open, setOpen] = useState(false); 
  const { t } = useLanguage();
  const getNavKey = (label: string) => {
    const map: Record<string, string> = { 'Dashboard': 'nav.dashboard', 'Product': 'nav.product', 'Solutions': 'nav.solutions', 'Pricing': 'nav.pricing', 'About': 'nav.about', 'Contact': 'nav.contact' };
    return map[label] || label;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050816]/80 backdrop-blur-xl">
      {/*
        The desktop bar carries seven nav links, three language buttons and two
        calls to action. That does not fit at the md breakpoint, where the links
        collided with the language switcher and both buttons wrapped onto two
        lines, so the full bar now appears only from lg upwards and the menu
        button covers everything below it. gap-8 guarantees clear space between
        the nav and the actions even when justify-between has nothing spare.
      */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-8 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Home" className="flex shrink-0 items-center">
          <Logo className="h-6 sm:h-8 w-auto text-white" />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="whitespace-nowrap text-sm text-slate-300 transition hover:text-white"
            >
              {t(getNavKey(item.label))}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-4 lg:flex">
          <LanguageSwitcher />
          <AdminBadge />
          <AuthButton />
          <Button
            href="/contact"
            variant="primary"
            size="sm"
            className="whitespace-nowrap"
            icon={<ArrowUpRight className="h-4 w-4" />}
          >
            {t('nav.requestDemo')}
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-3 lg:hidden">
          <LanguageSwitcher />
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" onClick={() => setOpen((v) => !v)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      {/* Must match the lg breakpoint above, or 768-1024px would show neither
          the desktop bar nor this panel and leave no navigation at all. */}
      <div className={cn('lg:hidden', open ? 'block' : 'hidden')}>
        <div className="mx-4 mb-4 rounded-3xl border border-white/10 bg-[#0A1020] p-4 shadow-premium">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                {t(getNavKey(item.label))}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  ); 
}
