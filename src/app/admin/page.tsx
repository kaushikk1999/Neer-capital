import { requireAdmin } from "@/lib/rbac"
import { AdminHome } from "@/components/admin/AdminHome"

export const metadata = { title: "Admin | Neer Capital" }

export default async function AdminPage() {
  const session = await requireAdmin()
  return <AdminHome email={session.user.email ?? null} />
}
