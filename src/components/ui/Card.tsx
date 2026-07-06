import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
type CardProps = { title?: string; description?: string; className?: string; children?: ReactNode };
export function Card({ title, description, children, className }: CardProps) { return <div className={cn('rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl', className)}>{title && <h3 className="text-lg font-semibold text-white">{title}</h3>}{description && <p className="mt-2 text-sm text-slate-300">{description}</p>}{children}</div>; }
