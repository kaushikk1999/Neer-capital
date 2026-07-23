import { requireAdmin } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import DocumentsTable from "@/components/admin/DocumentsTable"
import { AdminHeading, AdminLink, AdminButtonLink } from "@/components/admin/AdminPageHeader"

export const metadata = { title: "Documents | Neer Capital" }
export const dynamic = "force-dynamic"

export default async function AdminDocumentsPage() {
  await requireAdmin()
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      jobs: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  })
  // Serialize dates for the client component.
  const documents = docs.map((d) => ({ 
    ...d, 
    createdAt: d.createdAt.toISOString(),
    analyses: d.analyses.map(a => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })),
    jobs: d.jobs.map(j => ({ ...j, createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString(), startedAt: j.startedAt?.toISOString(), heartbeatAt: j.heartbeatAt?.toISOString(), finishedAt: j.finishedAt?.toISOString() }))
  }))

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <AdminHeading headingKey="admin.docs.heading" />
        </div>
        <AdminButtonLink href="/admin/upload" labelKey="admin.docs.uploadCta" />
      </div>
      <div className="mt-12"><DocumentsTable documents={documents} /></div>
      <p className="mt-8 text-sm text-slate-400"><AdminLink href="/admin" labelKey="admin.docs.back" /></p>
    </section>
  )
}
