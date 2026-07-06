import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = { children: ReactNode; href?: string; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; fullWidth?: boolean; className?: string; disabled?: boolean };
const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/40';
const variants = { primary: 'rounded-full bg-white px-5 py-3 text-sm text-slate-950 hover:scale-[1.01] hover:bg-slate-100', secondary: 'rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white hover:bg-white/10', ghost: 'rounded-full px-4 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white' };
const sizes = { sm: 'text-xs px-3 py-2', md: 'text-sm px-5 py-3', lg: 'text-base px-6 py-3.5' };
export function Button({ children, href, onClick, variant = 'primary', size = 'md', icon, fullWidth, className, disabled }: ButtonProps) { const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', disabled && 'opacity-50 pointer-events-none', className); if (href) { return <Link href={href} className={classes}><span>{children}</span>{icon}</Link>; } return <button className={classes} onClick={onClick} disabled={disabled}><span>{children}</span>{icon}</button>; }
