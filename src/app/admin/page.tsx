import { requireAdmin } from "@/lib/rbac"
import { Card } from "@/components/ui/Card"
import { FileUp, FolderKanban, Send, RefreshCw, Users, Settings } from "lucide-react"

export const metadata = { title: "Admin | Neer Capital" }

// Foundation only — placeholders for Milestone 2 (Document Upload & Analysis).
const modules = [
  { title: "Document Upload", desc: "Upload PDFs for analysis.", icon: FileUp },
  { title: "Document Management", desc: "Browse, edit, and organize documents.", icon: FolderKanban },
  { title: "Publish", desc: "Publish insights to public pages.", icon: Send },
  { title: "Reprocess", desc: "Re-run analysis on existing documents.", icon: RefreshCw },
  { title: "Users", desc: "Manage users and roles.", icon: Users },
  { title: "Settings", desc: "Configure the workspace.", icon: Settings },
]

export default async function AdminPage() {
  const session = await requireAdmin()

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Admin</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Admin dashboard</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        Signed in as <span className="text-white">{session.user.email}</span>. These modules are foundations for the upcoming Document &amp; AI milestone.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <Card key={m.title} className="h-full">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-blue-300">
                <m.icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold text-white">{m.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{m.desc}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Coming soon</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
