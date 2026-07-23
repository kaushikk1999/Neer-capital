import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { FileText, Activity, AlertTriangle, TrendingUp, CheckCircle, BarChart3 } from "lucide-react"
import { requireAdmin } from "@/lib/rbac"
import ApproveButton from "@/components/admin/ApproveButton"
import ReportChart from "@/components/charts/ReportChart"
import { ExtractionQualityChip, ExtractionQualityPanel } from "@/components/admin/ExtractionQualityChip"
import { RecommendationCard } from "@/components/admin/RecommendationCard"
import { ReviewableMetrics } from "@/components/admin/ReviewableMetrics"
import type { QualityCoverage } from "@/lib/report/types"
import { T, ReviewBadge, PartialChip } from "@/components/admin/ReviewChrome"

/** V2 admin rendering is gated; with the flag off this page is unchanged. */
function v2AdminReadEnabled(): boolean {
  return process.env.REPORT_V2_ADMIN_READ === "true"
}

/** Review actions are gated separately from V2 reading. */
function v2ReviewActionsEnabled(): boolean {
  return process.env.REPORT_V2_REVIEW_ACTIONS === "true"
}

async function getDraftReport(slug: string) {
  const document = await prisma.document.findUnique({
    where: { slug },
    include: {
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          metrics: { orderBy: { order: 'asc' } },
          sections: { orderBy: { order: 'asc' } },
          charts: { orderBy: { order: 'asc' } }
        }
      }
    }
  })

  if (!document || document.analyses.length === 0) {
    return null
  }
  
  return { document, analysis: document.analyses[0] }
}

export default async function AdminReviewPage({ params }: { params: { slug: string } }) {
  await requireAdmin()
  const data = await getDraftReport(params.slug)
  
  if (!data) notFound()
    
  const { document, analysis } = data

  // A V2 analysis carries structured coverage and valuation; a legacy one does
  // not, so the page falls back to the original rendering for old reports.
  const isV2 = v2AdminReadEnabled() && (analysis.schemaVersion ?? 1) >= 2
  const coverage = (analysis.qualityCoverage as unknown as QualityCoverage | null) ?? null
  const valuationDetail = (analysis.valuationDetail ?? null) as Record<string, string | null> | null
  const identity = (analysis.identity ?? null) as Record<string, string | null> | null
  const reviewActionsEnabled = v2ReviewActionsEnabled()

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-blue-500/30 pb-24">
      {/* Admin Action Bar */}
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/60 backdrop-blur-xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ReviewBadge />
          <span className="text-gray-400 text-sm">{document.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`/api/admin/documents/${document.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            <T k="review.viewPdf" />
          </a>
          <ApproveButton documentId={document.id} analysisId={analysis.id} isAlreadyPublished={document.published && document.publishedAnalysisId === analysis.id} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 md:py-24">
        {/* Header Section */}
        <header className="mb-16 relative">
          <div className="absolute inset-0 bg-blue-500/10 blur-[100px] -z-10 rounded-full" />
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-6">
            {document.title}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 items-center">
            <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
            {/*
              V2 shows measured extraction coverage. V1 shows nothing: its
              confidence figure was a synthetic score that reported ~100% on
              every report regardless of how well extraction actually went, so
              displaying it was worse than displaying nothing.
            */}
            {isV2 && <ExtractionQualityChip coverage={coverage} />}
            {isV2 && analysis.status === "PARTIAL" && (
              <PartialChip />
            )}
          </div>
        </header>

        {isV2 && <div className="mb-10"><ExtractionQualityPanel coverage={coverage} /></div>}

        {/* Topline Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="md:col-span-2 space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors duration-500" />
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest"><T k="review.execSummary" /></h2>
            <p className="text-lg md:text-xl leading-relaxed text-gray-200 whitespace-pre-wrap">
              {analysis.summary || <T k="review.noSummary" />}
            </p>
          </div>
          {isV2 ? (
            <RecommendationCard
              valuation={valuationDetail}
              researchHouse={identity?.researchHouse ?? null}
            />
          ) : (
            <div className="space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest"><T k="review.recommendation" /></h2>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold text-white tracking-tighter">
                  {analysis.recommendation || "N/A"}
                </span>
              </div>
              {analysis.valuation && (
                <p className="text-sm text-gray-500 mt-4">
                  <T k="review.methodology" /> <span className="text-gray-300">{analysis.valuation}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        {analysis.metrics.length > 0 && (
          <section className="mb-20">
            <h3 className="text-2xl font-semibold mb-8 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-400" /> <T k="review.keyMetrics" />
            </h3>
            {isV2 ? (
              <ReviewableMetrics
                analysisId={analysis.id}
                documentId={document.id}
                initialRevision={analysis.revision ?? 0}
                canReview={reviewActionsEnabled && analysis.status !== "APPROVED" && analysis.status !== "SUPERSEDED"}
                metrics={analysis.metrics.map((m) => ({
                  id: m.id,
                  label: m.label,
                  value: m.value,
                  rawValue: m.rawValue ?? null,
                  unit: m.unit ?? null,
                  period: m.period ?? null,
                  classificationCode: m.classificationCode ?? null,
                  sourcePage: m.sourcePage ?? null,
                  // Only verified excerpts may be shown as verbatim quotes.
                  sourceQuote: null,
                  verification: null,
                  confidenceLevel: m.confidenceLevel ?? null,
                  validationStatus: m.validationStatus ?? null,
                  reviewStatus: m.reviewStatus ?? "NOT_REVIEWED",
                  provenance: m.provenance ?? null,
                }))}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {analysis.metrics.map((metric) => (
                  <div key={metric.id} className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.05] hover:border-white/[0.1] transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <p className="text-sm text-gray-400 mb-2 truncate" title={metric.label}>{metric.label}</p>
                    <p className="text-2xl font-bold text-white tracking-tight">
                      {metric.value}
                      {metric.unit ? ` ${metric.unit}` : ''}
                    </p>
                    {metric.period && <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">{metric.period}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Charts Grid */}
        {analysis.charts.length > 0 && (
          <section className="mb-20">
            <h3 className="text-2xl font-semibold mb-8 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-400" /> <T k="review.visualizations" />
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {analysis.charts.map((chart) => (
                <ReportChart key={chart.id} chart={chart} />
              ))}
            </div>
          </section>
        )}

        {/* Sections */}
        {analysis.sections.length > 0 && (
          <section className="mb-20">
            <div className="space-y-8">
              {analysis.sections.map((section) => (
                <div key={section.id} className="group flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] transition-all duration-300">
                  <div className="md:w-1/3 shrink-0">
                    <h4 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">{section.heading}</h4>
                  </div>
                  <div className="md:w-2/3 space-y-4">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{section.content}</p>
                    {section.sourceExcerpt && (
                      <blockquote className="pl-4 border-l-2 border-blue-500/30 text-sm text-gray-500 italic">
                        &quot;{section.sourceExcerpt}&quot;
                      </blockquote>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Risks */}
        {analysis.risks && (
          <section className="mb-20 p-8 md:p-12 rounded-3xl bg-red-950/20 border border-red-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none" />
            <h3 className="text-2xl font-semibold text-red-400 mb-8 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6" /> <T k="review.keyRisks" />
            </h3>
            <div className="prose prose-invert prose-red max-w-none">
              {typeof analysis.risks === 'string' ? (
                <ul className="space-y-6 text-gray-300 list-none pl-0">
                  {JSON.parse(analysis.risks).map((risk: any, i: number) => (
                    <li key={i} className="pl-4 border-l border-red-500/30">
                      <strong className="text-white block mb-1 text-lg">{risk.risk}</strong>
                      <span className="text-gray-400 block mb-3 leading-relaxed">{risk.explanation}</span>
                      <em className="text-xs text-red-400/70 bg-red-950/50 px-2 py-1 rounded inline-block"><T k="review.source" /> &quot;{risk.evidence}&quot;</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400"><T k="review.noRisks" /></p>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
