import { solutions } from '@/lib/data';
import { Card } from '@/components/ui/Card';
export function SolutionsGrid() { return <div className="grid gap-6 md:grid-cols-2">{solutions.map((solution) => <Card key={solution.title} title={solution.title} className="h-full"><p className="mt-3 text-sm leading-6 text-slate-300">{solution.body}</p></Card>)}</div>; }
