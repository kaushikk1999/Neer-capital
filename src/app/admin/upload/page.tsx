import { requireAdmin } from "@/lib/rbac"
import UploadForm from "@/components/admin/UploadForm"
import { AdminHeading, AdminLink } from "@/components/admin/AdminPageHeader"

export const metadata = { title: "Upload Document | Neer Capital" }

export default async function UploadPage() {
  await requireAdmin()
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <AdminHeading headingKey="admin.upload.heading" introKey="admin.upload.intro" />
      <div className="mt-12"><UploadForm /></div>
      <p className="mt-10 text-sm text-slate-400">
        <AdminLink href="/admin/documents" labelKey="admin.upload.manageLink" />
      </p>
    </section>
  )
}
