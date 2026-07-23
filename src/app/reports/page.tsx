import { prisma } from "@/lib/db"
import { ReportsIndex, type ReportCard } from "@/components/reports/ReportsIndex"

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

  // Serialised for the client boundary: Date does not cross it intact.
  const reports: ReportCard[] = publishedDocs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    summary: doc.publishedAnalysis?.summary ?? null,
    updatedAt: doc.updatedAt.toISOString(),
  }))

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-blue-500/30">
      <ReportsIndex reports={reports} />
    </div>
  )
}
