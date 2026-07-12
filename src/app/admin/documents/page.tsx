import Link from "next/link"
import { requireAdmin } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/Button"
import DocumentsTable from "@/components/admin/DocumentsTable"

export const metadata = { title: "Documents | Neer Capital" }
export const dynamic = "force-dynamic"

export default async function AdminDocumentsPage() {
  await requireAdmin()
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, fileName: true, fileSize: true, status: true, published: true, createdAt: true },
  })
  // Serialize dates for the client component.
  const documents = docs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Admin</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Documents</h1>
        </div>
        <Button href="/admin/upload" size="sm">Upload document</Button>
      </div>
      <div className="mt-12"><DocumentsTable documents={documents} /></div>
      <p className="mt-8 text-sm text-slate-400"><Link href="/admin" className="text-blue-400 hover:text-blue-300">← Back to admin</Link></p>
    </section>
  )
}
