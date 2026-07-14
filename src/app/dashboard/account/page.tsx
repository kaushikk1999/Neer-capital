import { requireUser } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { ShieldCheck, User as UserIcon } from "lucide-react"

export const metadata = { title: "Account | Neer Capital" }

export default async function AccountPage() {
  const session = await requireUser()
  
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      createdAt: true,
      accounts: {
        select: {
          provider: true
        }
      }
    }
  })

  if (!dbUser) {
    // Fail closed if database user doesn't exist despite having a session
    throw new Error("User record not found")
  }

  const isAdmin = session.user.role === "ADMIN"
  const memberSince = new Date(dbUser.createdAt).toLocaleDateString()
  
  const rawProviders = dbUser.accounts.map(a => a.provider)
  const isCredentials = rawProviders.length === 0 // If no OAuth providers, must be credentials
  const providers = isCredentials ? ["Email & Password"] : Array.from(new Set(rawProviders.map(p => p === 'google' ? 'Google' : p)))
  const signInMethod = providers.join(", ")
  const userInitial = session.user.name?.[0] || session.user.email?.[0] || "U"

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300 transition flex items-center gap-1 w-fit">
          &larr; Back to Dashboard
        </Link>
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Account</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        View your profile and account information
      </h1>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card title="Profile" className="h-full">
          <div className="mt-6 flex items-center gap-4">
            {session.user.image ? (
              <img src={session.user.image} alt="Avatar" className="h-16 w-16 rounded-full border border-white/10" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl font-medium text-white">
                {userInitial.toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <h3 className="text-lg font-medium text-white truncate">{session.user.name || "Not provided"}</h3>
              <p className="text-sm text-slate-400 truncate">{session.user.email}</p>
            </div>
          </div>
        </Card>

        <Card title="Account Details" className="h-full flex flex-col justify-between">
          <dl className="mt-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <dt className="text-sm font-medium text-slate-400">Role</dt>
              <dd>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${isAdmin ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-blue-400/30 bg-blue-400/10 text-blue-300'}`}>
                  {isAdmin && <ShieldCheck className="h-3.5 w-3.5" />}
                  {!isAdmin && <UserIcon className="h-3.5 w-3.5" />}
                  {session.user.role}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <dt className="text-sm font-medium text-slate-400">Sign-in Method</dt>
              <dd className="text-sm text-slate-200">{signInMethod}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-400">Member Since</dt>
              <dd className="text-sm text-slate-200">{memberSince}</dd>
            </div>
          </dl>
        </Card>
      </div>
      
      {isAdmin && (
        <div className="mt-8 flex justify-end">
          <Button href="/admin" size="sm" variant="secondary">Open Admin Dashboard</Button>
        </div>
      )}
    </section>
  )
}
