'use client';
import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVital } from '@/lib/monitoring';

// Client component that streams Core Web Vitals (LCP, CLS, INP, ...) into the
// monitoring sink. Uses Next's built-in reporter — no extra dependency.
export function WebVitals() {
  useReportWebVitals((metric) => reportWebVital(metric));
  return null;
}
