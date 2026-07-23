import { requireUser } from "@/lib/rbac"
import { prisma } from "@/lib/db"
import { AccountView } from "@/components/dashboard/AccountView"

export const metadata = { title: "Account | Neer Capital" }

export default async function AccountPage() {
  const session = await requireUser()

  // Secure server-side fetch based exclusively on the session ID
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      createdAt: true,
      accounts: { select: { provider: true } },
    },
  })

  return (
    <AccountView
      name={dbUser?.name ?? session.user.name ?? null}
      email={dbUser?.email ?? session.user.email ?? null}
      image={session.user.image ?? null}
      role={session.user.role}
      isAdmin={session.user.role === "ADMIN"}
      providers={dbUser?.accounts?.map((a) => a.provider) ?? []}
      memberSinceISO={dbUser?.createdAt?.toISOString() ?? null}
    />
  )
}
