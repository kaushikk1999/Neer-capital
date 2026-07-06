import { pillars } from '@/lib/data';
import { Card } from '@/components/ui/Card';
export function PillarGrid() { return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{pillars.map((pillar) => <Card key={pillar.title} title={pillar.title} className="h-full"><p className="mt-3 text-sm leading-6 text-slate-300">{pillar.desc}</p></Card>)}</div>; }
