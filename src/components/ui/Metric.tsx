type MetricProps = { value: string; label: string };
export function Metric({ value, label }: MetricProps) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"><div className="text-2xl font-semibold text-white">{value}</div><div className="mt-1 text-sm text-slate-400">{label}</div></div>; }
