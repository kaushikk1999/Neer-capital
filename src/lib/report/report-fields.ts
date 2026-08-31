// Shared construction of the natural-language field maps that get translated.
// Used by the report page, the reports index, and the publish-time pre-warm so
// they all produce identical translation cache keys/values (no drift).

export type RiskItem = { risk?: string; explanation?: string; evidence?: string }

export function parseRisks(risks: unknown): RiskItem[] {
  if (typeof risks !== "string") return []
  try {
    const v = JSON.parse(risks)
    return Array.isArray(v) ? (v as RiskItem[]) : []
  } catch {
    return []
  }
}

type MetricLike = { id: string; label: string | null }
type SectionLike = { id: string; heading: string | null; content: string | null }
type ChartLike = { id: string; title: string | null }

/** Every prose field rendered on the full report page. Numbers, tickers,
 *  currencies, dates, units and verbatim source excerpts are intentionally
 *  excluded and stay exactly as extracted. */
export function buildReportStrings(input: {
  title: string | null
  summary: string | null
  metrics: MetricLike[]
  sections: SectionLike[]
  charts: ChartLike[]
  risks: RiskItem[]
}): Record<string, string> {
  const s: Record<string, string> = {}
  if (input.title) s["title"] = input.title
  if (input.summary) s["summary"] = input.summary
  input.metrics.forEach((m) => { if (m.label) s[`metric.${m.id}.label`] = m.label })
  input.sections.forEach((x) => {
    if (x.heading) s[`section.${x.id}.heading`] = x.heading
    if (x.content) s[`section.${x.id}.content`] = x.content
  })
  input.charts.forEach((c) => { if (c.title) s[`chart.${c.id}.title`] = c.title })
  input.risks.forEach((r, i) => {
    if (r.risk) s[`risk.${i}.risk`] = r.risk
    if (r.explanation) s[`risk.${i}.explanation`] = r.explanation
  })
  return s
}

/** Title + summary — the two prose fields shown on a report index card. */
export function buildCardStrings(title: string | null, summary: string | null): Record<string, string> {
  const s: Record<string, string> = {}
  if (title) s["title"] = title
  if (summary) s["summary"] = summary
  return s
}
