import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { WebVitals } from './web-vitals';
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
export default function RootLayout({ children }: { children: React.ReactNode }) { return (<html lang="en" className={inter.variable}><body className="bg-[#050816] text-white antialiased"><WebVitals /><Header /><main>{children}</main><Footer /></body></html>); }
