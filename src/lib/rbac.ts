import { redirect } from "next/navigation"
import { auth } from "@/auth"

// Server-side authorization guards. Use in Server Components / Route Handlers —
// never rely on client-side hiding alone.

export async function requireUser() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return session
}

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")
  return session
}
