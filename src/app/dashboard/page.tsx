import Link from "next/link"
import { requireUser } from "@/lib/rbac"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export const metadata = { title: "Dashboard | Neer Capital" }

export default async function DashboardPage() {
  const session = await requireUser()
  const isAdmin = session.user.role === "ADMIN"

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Dashboard</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Welcome{session.user.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        You are signed in as <span className="text-white">{session.user.email}</span>{" "}
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-blue-200">{session.user.role}</span>
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card title="Your account" className="h-full">
          <p className="mt-3 text-sm leading-6 text-slate-300">Manage your profile and session. Document insights will appear here in a future release.</p>
          <div className="mt-5"><Button href="/dashboard/account" size="sm">Manage account</Button></div>
        </Card>
        {isAdmin && (
          <Card title="Administration" className="h-full">
            <p className="mt-3 text-sm leading-6 text-slate-300">You have administrator access.</p>
            <div className="mt-5"><Button href="/admin" size="sm">Open admin dashboard</Button></div>
          </Card>
        )}
      </div>

      <p className="mt-10 text-sm text-slate-400">
        Need help? <Link href="/contact" className="text-blue-400 hover:text-blue-300">Contact us</Link>.
      </p>
    </section>
  )
}
