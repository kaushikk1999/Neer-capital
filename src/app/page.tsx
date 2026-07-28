'use client';
import { Hero } from '@/components/hero/Hero';
import { Section } from '@/components/ui/Section';
import { PillarGrid } from '@/components/platform/PillarGrid';
import { SolutionsGrid } from '@/components/solutions/SolutionsGrid';
import { PricingSection } from '@/components/pricing/PricingSection';
import { FAQAccordion } from '@/components/faq/FAQAccordion';
import { FeedbackPrompt } from '@/components/reports/FeedbackPrompt';
import { faqs } from '@/lib/data';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function HomePage() { 
  const { t } = useLanguage();
  return (
    <>
      <Hero />
      <Section id="product" eyebrow={t('product.eyebrow')} title={t('product.heading')} subtitle={t('product.subtitle')}>
        <PillarGrid />
      </Section>
      <Section id="solutions" eyebrow={t('solutions.eyebrow')} title={t('solutions.heading')} subtitle={t('solutions.subtitle')}>
        <SolutionsGrid />
      </Section>
      <Section id="pricing" eyebrow={t('pricing.eyebrow')} title={t('pricing.heading')} subtitle={t('pricing.subtitle')}>
        <PricingSection />
      </Section>
      <Section id="faq" eyebrow={t('faq.eyebrow')} title={t('faq.heading')} subtitle={t('faq.subtitle')}>
        <FAQAccordion items={faqs} />
      </Section>
      {/* General website feedback — no report, so no prefill. Same form as the
          per-report prompts, giving one place for overall impressions. */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <FeedbackPrompt />
      </div>
    </>
  );
}
