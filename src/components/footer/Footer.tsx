'use client';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const columns = [{ titleKey: 'footer.colProduct', links: [{ labelKey: 'footer.linkProduct', href: '/#product' }, { labelKey: 'footer.linkPricing', href: '/#pricing' }] }, { titleKey: 'footer.colCompany', links: [{ labelKey: 'footer.linkAbout', href: '/about' }, { labelKey: 'footer.linkContact', href: '/contact' }, { labelKey: 'footer.linkSources', href: '/sources' }] }];
export function Footer() { 
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/10 bg-[#050816] py-16">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center"><Logo className="h-6 sm:h-8 w-auto text-white" /></div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">{t('footer.description')}</p>
          <div className="mt-6 text-sm text-slate-400"><a href="mailto:comms.neercapital@gmail.com" className="transition hover:text-white">comms.neercapital@gmail.com</a></div>
        </div>
        {columns.map((col) => (
          <div key={col.titleKey}>
            <div className="text-sm font-medium text-white">{t(col.titleKey)}</div>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) => (
                <li key={link.labelKey}>
                  <Link href={link.href} className="text-sm text-slate-400 transition hover:text-white">{t(link.labelKey)}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  ); 
}
