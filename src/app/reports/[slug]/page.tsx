import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { ReportView } from "@/components/reports/ReportView"
import { localizeReportStrings } from "@/lib/report/translate"
import { buildReportStrings, parseRisks } from "@/lib/report/report-fields"
import type { Locale } from "@/lib/i18n/types"

async function getReport(slug: string) {
  const document = await prisma.document.findUnique({
    where: { slug },
    include: {
      publishedAnalysis: {
        include: {
          metrics: { orderBy: { order: 'asc' } },
          sections: { orderBy: { order: 'asc' } },
          charts: { orderBy: { order: 'asc' } }
        }
      }
    }
  })

  // Security: only show published documents that have an active published analysis
  if (!document || !document.published || !document.publishedAnalysisId || !document.publishedAnalysis) {
    return null
  }

  return document
}

export default async function ReportPage({ params }: { params: { slug: string } }) {
  const doc = await getReport(params.slug)
  if (!doc) notFound()

  const analysis = doc.publishedAnalysis!
  const risks = parseRisks(analysis.risks)

  // English base map (shared with the publish-time pre-warm so cache keys match).
  const strings = buildReportStrings({
    title: doc.title,
    summary: analysis.summary,
    metrics: analysis.metrics,
    sections: analysis.sections,
    charts: analysis.charts,
    risks,
  })

  // Translate into every language up front (each a fast durable-cache hit once
  // warmed) so the client can swap languages instantly with no round-trip.
  const version = { analysisId: analysis.id, revision: analysis.revision }
  const [hiMap, taMap] = await Promise.all([
    localizeReportStrings(strings, "hi", version),
    localizeReportStrings(strings, "ta", version),
  ])
  const loc: Record<Locale, Record<string, string>> = { en: strings, hi: hiMap, ta: taMap }

  return (
    <ReportView
      slug={doc.slug}
      dateLabel={new Date(analysis.createdAt).toLocaleDateString()}
      hasSummary={!!analysis.summary}
      metrics={analysis.metrics.map((m) => ({ id: m.id, value: m.value, unit: m.unit, period: m.period }))}
      charts={analysis.charts.map((c) => ({ id: c.id, type: c.type, config: c.config, configV2: c.configV2 }))}
      sections={analysis.sections.map((s) => ({ id: s.id, hasExcerpt: !!s.sourceExcerpt }))}
      risks={risks.map((r) => ({ hasEvidence: !!r.evidence }))}
      showRisks={!!analysis.risks}
      risksParsable={typeof analysis.risks === "string"}
      loc={loc}
    />
  )
}
