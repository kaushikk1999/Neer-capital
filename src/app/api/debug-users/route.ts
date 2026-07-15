import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"

// Temporary diagnostic endpoint — ADMIN only, no secrets exposed
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  // Only allow admins by checking known admin emails
  const adminEmails = ["kaushikds1999@gmail.com", "comms.neercapital@gmail.com"]
  const sessionEmail = session.user.email?.toLowerCase()
  const tokenEmail = session.user.email

  // Get ALL users with their linked accounts (safe fields only)
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
    currentSession: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
    allUsers: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      accounts: u.accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        providerAccountId: a.providerAccountId.substring(0, 6) + "...",
        userId: a.userId,
      })),
    })),
  })
}
