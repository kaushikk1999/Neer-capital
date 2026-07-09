'use client';
import { pillars } from '@/lib/data';
import { Card } from '@/components/ui/Card';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function PillarGrid() { 
  const { t } = useLanguage();
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {pillars.map((pillar, idx) => (
        <Card key={pillar.title} title={t(`product.pillar${idx + 1}.title`)} className="h-full">
          <p className="mt-3 text-sm leading-6 text-slate-300">{t(`product.pillar${idx + 1}.desc`)}</p>
        </Card>
      ))}
    </div>
  ); 
}
