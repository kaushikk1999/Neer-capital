import { Hero } from '@/components/hero/Hero';
import { TrustStrip } from '@/components/trust/TrustStrip';
import { Section } from '@/components/ui/Section';
import { PillarGrid } from '@/components/platform/PillarGrid';
import { SolutionsGrid } from '@/components/solutions/SolutionsGrid';
import { PricingSection } from '@/components/pricing/PricingSection';
import { FAQAccordion } from '@/components/faq/FAQAccordion';
import { faqs } from '@/lib/data';
import { SecurityDiagram } from '@/components/security/SecurityDiagram';
export default function HomePage() { return (<><Hero /><TrustStrip /><Section id="product" eyebrow="Product" title="Built for research that cannot afford uncertainty" subtitle="Combine market intelligence, internal knowledge, and governed AI in one workflow."><PillarGrid /></Section><Section id="solutions" eyebrow="Solutions" title="Built for every team that depends on trusted answers" subtitle="From investment diligence to risk and compliance, Neer adapts to how your teams work."><SolutionsGrid /></Section><Section id="security" eyebrow="Security" title="Security designed for enterprise deployment" subtitle="Governance, isolation, and transparency are built into the product architecture."><SecurityDiagram /></Section><Section id="pricing" eyebrow="Pricing" title="Flexible for teams, structured for enterprises" subtitle="Choose the right path for your organization."><PricingSection /></Section><Section id="faq" eyebrow="FAQ" title="Answers for enterprise buyers" subtitle="Common questions from procurement, security, and business stakeholders."><FAQAccordion items={faqs} /></Section></>); }
