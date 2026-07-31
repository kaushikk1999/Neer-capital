import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

// Server-side authorization guards. Use in Server Components / Route Handlers —
// never rely on client-side hiding alone. Authoritative: the JWT is advisory;
// the live DB record (looked up by the trusted session user id) decides. A
// session-version mismatch (deleted user, password reset, revocation) or a
// missing version on a legacy token forces re-authentication.

async function currentUser(sessionUserId: string, sessionVersion: number | undefined) {
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, role: true, sessionVersion: true },
  })
  if (!dbUser || sessionVersion !== dbUser.sessionVersion) return null
  return dbUser
}

export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const user = await currentUser(session.user.id, session.user.sessionVersion)
  if (!user) redirect("/login")
  return session
}

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const user = await currentUser(session.user.id, session.user.sessionVersion)
  if (!user) redirect("/login")
  if (user.role !== "ADMIN") redirect("/dashboard")
  return session
}
