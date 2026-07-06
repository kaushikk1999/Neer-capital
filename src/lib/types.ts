export type NavItem = { label: string; href: string; external?: boolean };
export type Stat = { value: string; label: string };
export type Pillar = { title: string; desc: string };
export type WorkflowStep = { step: string; title: string; body: string };
export type Solution = { title: string; body: string };
export type FAQItem = { q: string; a: string };
export type PricingPlan = { name: string; price?: string; description: string; features: string[]; featured?: boolean; cta: { label: string; href: string } };
