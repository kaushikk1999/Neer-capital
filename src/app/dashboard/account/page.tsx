import { requireUser } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { ShieldCheck, User as UserIcon } from "lucide-react"

export const metadata = { title: "Account | Neer Capital" }

export default async function AccountPage() {
  const session = await requireUser()
  const isAdmin = session.user.role === "ADMIN"

  // Secure server-side fetch based exclusively on the session ID
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      createdAt: true,
      accounts: { select: { provider: true } },
    },
  })

  // Determine provider string safely
  const providers = dbUser?.accounts?.map((a) => a.provider) || []
  let providerText = "Email & Password"
  if (providers.length > 0) {
    providerText = providers
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(", ")
  }

  // Format creation date
  const memberSince = dbUser?.createdAt
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", day: "numeric" }).format(dbUser.createdAt)
    : "Unknown"

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Profile</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Your Account</h1>
      
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {/* Profile Card */}
        <Card title="Profile" className="h-full">
          <div className="mt-6 flex items-center gap-4">
            {session.user.image ? (
              <img src={session.user.image} alt={session.user.name || "Avatar"} className="h-16 w-16 rounded-full border border-white/10" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-blue-300">
                <UserIcon className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-medium text-white truncate">{session.user.name || "User"}</p>
              <p className="text-sm text-slate-400 truncate">{session.user.email}</p>
            </div>
          </div>
        </Card>

        {/* Account Details Card */}
        <Card title="Account Details" className="h-full">
          <div className="mt-6 space-y-4 text-sm text-slate-300">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-slate-400">Role</span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ADMIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-blue-200">
                  USER
                </span>
              )}
            </div>
            
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-slate-400">Sign-in Method</span>
              <span className="text-white">{providerText}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Member Since</span>
              <span className="text-white">{memberSince}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation Actions */}
      <div className="mt-10 flex gap-4">
        <Button href="/dashboard" variant="secondary" size="sm">
          ← Back to Dashboard
        </Button>
        {isAdmin && (
          <Button href="/admin" variant="primary" size="sm">
            Admin Dashboard
          </Button>
        )}
      </div>
    </section>
  )
}
