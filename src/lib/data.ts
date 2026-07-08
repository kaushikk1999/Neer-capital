import type { FAQItem, NavItem, Pillar, PricingPlan, Solution, Stat, WorkflowStep } from './types';
export const navItems: NavItem[] = [
  { label: 'Product', href: '/#product' },
  { label: 'Solutions', href: '/#solutions' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' }
];
export const stats: Stat[] = [
  { value: '180+', label: 'source types connected' },
  { value: '99.98%', label: 'uptime target' },
  { value: '24/7', label: 'global research coverage' },
  { value: 'SOC 2', label: 'ready architecture' }
];
export const logos = ['Aurelius Capital', 'Northstar Bank', 'Helix Ventures', 'Summit Asset Mgmt', 'Kestrel Markets', 'Monarch Insurance'];
export const pillars: Pillar[] = [
  { title: 'AI-powered financial intelligence', desc: 'Turn fragmented market data into board-ready insight with citation-backed responses and guided research workflows.' },
  { title: 'Enterprise RAG at scale', desc: 'Ground every answer in private documents, approved sources, and auditable retrieval pipelines.' },
  { title: 'Multi-language support', desc: 'Equip global teams with multilingual interfaces and local-market context without sacrificing consistency.' },
  { title: 'Secure decision support', desc: 'Role-based access, compliance controls, deployment isolation, and transparent provenance from query to answer.' }
];
export const workflows: WorkflowStep[] = [
  { step: '1', title: 'Ingest', body: 'Connect filings, research notes, PDFs, data feeds, and policy documents into a unified enterprise index.' },
  { step: '2', title: 'Reason', body: 'The assistant extracts entities, cross-checks citations, and identifies signal across time, geography, and language.' },
  { step: '3', title: 'Respond', body: 'Analysts receive concise answers, source chains, and follow-up prompts with export-ready artifacts.' }
];
export const solutions: Solution[] = [
  { title: 'Investment teams', body: 'Accelerate diligence, compare competitors, and synthesize thematic research into investment narratives.' },
  { title: 'Corporate strategy', body: 'Monitor macro shifts, benchmark markets, and equip leadership with decision-grade summaries.' },
  { title: 'Risk & compliance', body: 'Trace every response to approved sources with permissions, review logs, and security controls.' },
  { title: 'Enterprise knowledge', body: 'Unify internal research and market intelligence in one governed AI experience.' }
];
export const trustPoints = ['Zero-trust access model', 'Role-based permissions', 'Encryption in transit and at rest', 'Private deployment options', 'Audit logs and provenance', 'Data retention controls'];
export const pricingPlans: PricingPlan[] = [
  { name: 'Self-serve', price: 'Starting at custom', description: 'For lean teams that want to move quickly with a secure, ready-to-use product.', features: ['Core AI workflows', 'Source citations', 'Team collaboration', 'Standard support'], cta: { label: 'Start conversation', href: '/contact' } },
  { name: 'Enterprise', description: 'For organizations that need governance, deployment flexibility, and security review.', featured: true, features: ['Private deployment', 'SSO / RBAC', 'Audit logs', 'Data controls', 'Security review support'], cta: { label: 'Talk to sales', href: '/contact' } }
];
export const faqs: FAQItem[] = [
  { q: 'How does Neer ensure answers are grounded in evidence?', a: 'Answers are grounded in approved enterprise sources, with cited evidence, retrieval traces, and confidence cues visible to users.' },
  { q: 'Can we support multilingual research workflows?', a: 'Yes. The product supports multilingual workflows and can translate, normalize, and compare materials across regions.' },
  { q: 'What deployment options are available?', a: 'Neer is designed for secure enterprise deployment patterns, including isolated environments and controlled integrations.' },
  { q: 'How do security and access controls work?', a: 'Neer supports role-based permissions, audit trails, and strict access boundaries to keep data governed and reviewable.' }
];
