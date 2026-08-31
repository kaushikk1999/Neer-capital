import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { ReportsIndex, type ReportCard } from "@/components/reports/ReportsIndex"
import { localizeReportStrings } from "@/lib/report/translate"
import type { Locale } from "@/lib/i18n/types"

export const metadata = { title: "Research Reports | Neer Capital" }
export const dynamic = "force-dynamic"

function readLocale(): Locale {
  const v = cookies().get("neer_lang")?.value
  return v === "hi" || v === "ta" ? v : "en"
}

export default async function ReportsIndexPage() {
  const publishedDocs = await prisma.document.findMany({
    where: { published: true, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    include: {
      publishedAnalysis: true
    }
  })

  const locale = readLocale()

  // Localise each card's AI-generated title/summary to the selected language,
  // reusing the same cached translator as the report page (scope "card" keeps
  // its cache separate from the full-report translation). English is a no-op.
  const reports: ReportCard[] = await Promise.all(
    publishedDocs.map(async (doc) => {
      const analysis = doc.publishedAnalysis
      const summary = analysis?.summary ?? null
      let title = doc.title
      let localizedSummary = summary
      if (analysis && locale !== "en") {
        const src: Record<string, string> = { title: doc.title }
        if (summary) src.summary = summary
        const L = await localizeReportStrings(
          src,
          locale,
          { analysisId: analysis.id, revision: analysis.revision },
          "card",
        )
        title = L.title ?? doc.title
        localizedSummary = summary ? (L.summary ?? summary) : null
      }
      // Serialised for the client boundary: Date does not cross it intact.
      return {
        id: doc.id,
        slug: doc.slug,
        title,
        summary: localizedSummary,
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
