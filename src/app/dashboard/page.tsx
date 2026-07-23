import { requireUser } from "@/lib/rbac"
import { DashboardHome } from "@/components/dashboard/DashboardHome"

export const metadata = { title: "Dashboard | Neer Capital" }

export default async function DashboardPage() {
  const session = await requireUser()

  return (
    <DashboardHome
      name={session.user.name ?? null}
      email={session.user.email ?? null}
      role={session.user.role}
      isAdmin={session.user.role === "ADMIN"}
    />
  )
}
