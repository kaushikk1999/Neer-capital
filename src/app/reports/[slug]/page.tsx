import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { FileText, Activity, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react"
import ReportChart from "@/components/charts/ReportChart"
import { FeedbackPrompt } from "@/components/reports/FeedbackPrompt"

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

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-24">
        
        {/* Header Section */}
        <header className="mb-16 relative flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="absolute inset-0 bg-blue-500/10 blur-[100px] -z-10 rounded-full" />
          <div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-6">
              {doc.title}
            </h1>
            {/*
              The "AI Generated" chip and the confidence percentage were removed
              deliberately. The percentage came from a synthetic score that
              started at 1.0 and was reduced slightly for missing evidence, so it
              read "100% Confidence" on almost every report — a certainty claim
              about financial data that nothing in the pipeline could support.
              Per-value provenance is shown alongside each figure instead.
            */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 items-center">
              <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <a
            href={`/api/documents/${doc.slug}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all shrink-0 text-sm font-medium hover:scale-105 active:scale-95"
          >
            <FileText className="w-4 h-4" />
            View Original PDF
          </a>
        </header>

        {/* Topline Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="md:col-span-2 space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors duration-500" />
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest">Executive Summary</h2>
            <p className="text-lg md:text-xl leading-relaxed text-gray-200 whitespace-pre-wrap">
              {analysis.summary || "No executive summary available."}
            </p>
          </div>
          <div className="space-y-4 p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest">Recommendation</h2>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold text-white tracking-tighter">
                {analysis.recommendation || "N/A"}
              </span>
            </div>
            {analysis.valuation && (
              <p className="text-sm text-gray-500 mt-4">
                Methodology: <span className="text-gray-300">{analysis.valuation}</span>
              </p>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        {analysis.metrics.length > 0 && (
          <section className="mb-20">
            <h3 className="text-2xl font-semibold mb-8 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-400" /> Key Metrics
            </h3>
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
          </section>
        )}

        {/* Charts Grid */}
        {analysis.charts.length > 0 && (
          <section className="mb-20">
            <h3 className="text-2xl font-semibold mb-8 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-blue-400" /> Visualizations
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
              <AlertTriangle className="w-6 h-6" /> Key Risks
            </h3>
            <div className="prose prose-invert prose-red max-w-none">
              {typeof analysis.risks === 'string' ? (
                <ul className="space-y-6 text-gray-300 list-none pl-0">
                  {JSON.parse(analysis.risks).map((risk: any, i: number) => (
                    <li key={i} className="pl-4 border-l border-red-500/30">
                      <strong className="text-white block mb-1 text-lg">{risk.risk}</strong>
                      <span className="text-gray-400 block mb-3 leading-relaxed">{risk.explanation}</span>
                      <em className="text-xs text-red-400/70 bg-red-950/50 px-2 py-1 rounded inline-block">Source: &quot;{risk.evidence}&quot;</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">No risks identified.</p>
              )}
            </div>
          </section>
        )}

        {/* Sits after the analysis so the reader has already formed a view. */}
        <FeedbackPrompt reportSlug={doc.slug} reportTitle={doc.title} />

      </div>
    </div>
  )
}
