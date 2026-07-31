import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { Role } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

type AdminUser = { id: string; role: Role; sessionVersion: number }

// API-route admin guard — returns 401/403 JSON (never a redirect). Authoritative:
// the JWT role/version are advisory; the final decision is the live DB record,
// looked up by the trusted session user id. Every admin route must call this
// (directly, or via assertAdminMutation, which delegates here).
export async function requireApiAdmin(): Promise<{ session: Session; user: AdminUser } | { error: NextResponse }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, sessionVersion: true },
  })

  // Missing user (deleted), or a token whose version is absent (legacy) or no
  // longer matches the DB (password reset / revocation) — reject generically as
  // 401 without revealing which condition failed.
  if (!dbUser || session.user.sessionVersion !== dbUser.sessionVersion) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (dbUser.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 }) }
  }

  return { session, user: dbUser }
}

export function audit(event: string, data: { userId?: string; documentId?: string; details?: object }) {
  return prisma.auditLog
    .create({ data: { event, userId: data.userId, documentId: data.documentId, details: data.details } })
    .catch(() => {})
}
