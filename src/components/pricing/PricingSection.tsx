'use client';
import { pricingPlans } from '@/lib/data';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function PricingSection() { 
  const { t } = useLanguage();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {pricingPlans.map((plan, idx) => {
        const prefix = idx === 0 ? 'pricing.selfServe' : 'pricing.enterprise';
        return (
          <Card key={plan.name} className={plan.featured ? 'border-blue-400/30 bg-white/[0.06]' : ''}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{t(`${prefix}.name`)}</h3>
                {plan.price && <p className="mt-2 text-sm text-blue-300">{t(`${prefix}.price`)}</p>}
              </div>
              {plan.featured && <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs text-blue-200">{t('pricing.recommended')}</span>}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{t(`${prefix}.description`)}</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              {plan.features.map((_, fIdx) => (
                <li key={fIdx}>• {t(`${prefix}.feature${fIdx + 1}`)}</li>
              ))}
            </ul>
            <div className="mt-6">
              <Button href={plan.cta.href} variant={plan.featured ? 'primary' : 'secondary'}>
                {t(`${prefix}.cta`)}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  ); 
}
