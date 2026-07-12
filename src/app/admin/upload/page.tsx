import Link from "next/link"
import { requireAdmin } from "@/lib/rbac"
import UploadForm from "@/components/admin/UploadForm"

export const metadata = { title: "Upload Document | Neer Capital" }

export default async function UploadPage() {
  await requireAdmin()
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Admin</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Upload document</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        Upload a PDF. It is saved as a <span className="text-white">Draft</span> and stays private until you publish it.
      </p>
      <div className="mt-12"><UploadForm /></div>
      <p className="mt-10 text-sm text-slate-400">
        <Link href="/admin/documents" className="text-blue-400 hover:text-blue-300">Manage documents →</Link>
      </p>
    </section>
  )
}
