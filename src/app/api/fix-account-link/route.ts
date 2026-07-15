import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'

// ONE-TIME database fix: Move the mislinked Google Account for kaushikds1999@gmail.com
// from the kaushikka99 user to the correct seeded ADMIN user.
// This endpoint will be removed after the fix is applied.
export async function POST() {
  const CORRECT_USER_ID = "cmrdgeoc10001pg2k04eyqkj3"   // kaushikds1999@gmail.com (ADMIN)
  const WRONG_USER_ID = "cmrdhazc90000o12knpimlnu3"      // kaushikka99@gmail.com (USER)

  // Find all Google accounts linked to the wrong user
  const accounts = await prisma.account.findMany({
    where: { userId: WRONG_USER_ID, provider: "google" },
    select: { id: true, providerAccountId: true, userId: true },
  })

  if (accounts.length < 2) {
    return NextResponse.json({
      status: "NO_FIX_NEEDED",
      message: "The kaushikka99 user does not have 2 Google accounts. Fix may have already been applied.",
      accounts,
    })
  }

  // The FIRST account (created with the user) belongs to kaushikka99.
  // The SECOND account (added later) is the mislinked one for kaushikds1999.
  // Sort by createdAt to identify which is which.
  const accountsSorted = await prisma.account.findMany({
    where: { userId: WRONG_USER_ID, provider: "google" },
    select: { id: true, providerAccountId: true, userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // The second (later) account is the mislinked one
  const mislinkedAccount = accountsSorted[1]

  // Move it to the correct user
  const updated = await prisma.account.update({
    where: { id: mislinkedAccount.id },
    data: { userId: CORRECT_USER_ID },
    select: { id: true, provider: true, providerAccountId: true, userId: true },
  })

  return NextResponse.json({
    status: "FIXED",
    message: "Moved mislinked Google account to correct ADMIN user",
    movedAccount: {
      accountId: updated.id,
      provider: updated.provider,
      providerAccountId: updated.providerAccountId.substring(0, 8) + "...",
      previousUserId: WRONG_USER_ID,
      newUserId: updated.userId,
    },
  })
}

// GET to check current state
export async function GET() {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ["kaushikds1999@gmail.com", "kaushikka99@gmail.com"] },
    },
    select: {
      id: true,
      email: true,
      role: true,
      accounts: {
        select: { id: true, provider: true, providerAccountId: true, userId: true },
      },
    },
  })

  return NextResponse.json({ users })
}
