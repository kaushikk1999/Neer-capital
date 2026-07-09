'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FAQItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type FAQAccordionProps = { items: FAQItem[] };
export function FAQAccordion({ items }: FAQAccordionProps) { 
  const [open, setOpen] = useState<number | null>(0); 
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      {items.map((item, index) => { 
        const active = open === index; 
        return (
          <div key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.04]">
            <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" onClick={() => setOpen(active ? null : index)} aria-expanded={active}>
              <span className="text-sm font-medium text-white">{t(`faq.q${index + 1}`)}</span>
              <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', active && 'rotate-180')} />
            </button>
            {active && <div className="px-5 pb-5 text-sm leading-6 text-slate-300">{t(`faq.a${index + 1}`)}</div>}
          </div>
        ); 
      })}
    </div>
  ); 
}
