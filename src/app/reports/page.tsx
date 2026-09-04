import { prisma } from "@/lib/db"
import { ReportsIndex, type ReportCard } from "@/components/reports/ReportsIndex"
import { localizeReportStrings } from "@/lib/report/translate"
import { buildCardStrings } from "@/lib/report/report-fields"

export const metadata = { title: "Research Reports | Neer Capital" }
export const dynamic = "force-dynamic"

export default async function ReportsIndexPage() {
  const publishedDocs = await prisma.document.findMany({
    where: { published: true, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    include: {
      publishedAnalysis: true
    }
  })

  // Pre-translate each card's title/summary into every language up front (fast
  // durable-cache hits once warmed) and embed all three, so the client swaps
  // language instantly with no round-trip. English is the canonical base.
  const reports: ReportCard[] = await Promise.all(
    publishedDocs.map(async (doc) => {
      const analysis = doc.publishedAnalysis
      const summary = analysis?.summary ?? null
      const title = { en: doc.title, hi: doc.title, ta: doc.title }
      const summaries = { en: summary, hi: summary, ta: summary }
      if (analysis) {
        const version = { analysisId: analysis.id, revision: analysis.revision }
        const base = buildCardStrings(doc.title, summary)
        const [hiMap, taMap] = await Promise.all([
          localizeReportStrings(base, "hi", version, "card"),
          localizeReportStrings(base, "ta", version, "card"),
        ])
        title.hi = hiMap.title ?? doc.title
        title.ta = taMap.title ?? doc.title
        summaries.hi = summary ? (hiMap.summary ?? summary) : null
        summaries.ta = summary ? (taMap.summary ?? summary) : null
      }
      // Serialised for the client boundary: Date does not cross it intact.
      return {
        id: doc.id,
        slug: doc.slug,
        title,
        summary: summaries,
        updatedAt: doc.updatedAt.toISOString(),
      }
    }),
  )

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-blue-500/30">
      <ReportsIndex reports={reports} />
    </div>
  )
}
