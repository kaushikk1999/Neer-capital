'use client';
import { solutions } from '@/lib/data';
import { Card } from '@/components/ui/Card';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function SolutionsGrid() { 
  const { t } = useLanguage();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {solutions.map((solution) => (
        <Card key={solution.key} title={t(`solutions.${solution.key}.title`)} className="h-full">
          <p className="mt-3 text-sm leading-6 text-slate-300">{t(`solutions.${solution.key}.body`)}</p>
        </Card>
      ))}
    </div>
  ); 
}
