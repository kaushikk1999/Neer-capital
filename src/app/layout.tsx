import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { WebVitals } from './web-vitals';
import { Providers } from './providers';
import type { Locale } from '@/lib/i18n/types';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const title = 'Neer — AI Financial Intelligence';
const description = 'Enterprise AI financial intelligence product with citations, security, and decision support.';
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: { title, description, url: siteUrl, siteName: 'Neer', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Seed the language provider from the cookie so the very first server paint is
  // already in the visitor's language (no English flash before hydration).
  const cookieLocale = cookies().get('neer_lang')?.value;
  const initialLocale: Locale = cookieLocale === 'hi' || cookieLocale === 'ta' ? cookieLocale : 'en';
  return (<html lang={initialLocale} className={inter.variable}><body className="bg-[#050816] text-white antialiased"><Providers initialLocale={initialLocale}><WebVitals /><Header /><main>{children}</main><Footer /></Providers></body></html>);
}
