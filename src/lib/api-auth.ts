import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

// API-route admin guard — returns 401/403 JSON (never a redirect). Every admin
// document route must call this; frontend checks are not authoritative.
export async function requireApiAdmin(): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session }
}

export function audit(event: string, data: { userId?: string; documentId?: string; details?: object }) {
  return prisma.auditLog
    .create({ data: { event, userId: data.userId, documentId: data.documentId, details: data.details } })
    .catch(() => {})
}
