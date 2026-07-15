import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'

// Temporary diagnostic endpoint — no secrets exposed, only safe fields.
// Will be removed after debugging the identity bug.
export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      accounts: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          userId: true,
        },
      },
    },
  })

  return NextResponse.json({
    userCount: users.length,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      linkedAccounts: u.accounts.map((a) => ({
        accountId: a.id,
        provider: a.provider,
        providerAccountId: a.providerAccountId.substring(0, 8) + "...",
        linksToUserId: a.userId,
      })),
    })),
  })
}
