import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createEmailVerificationToken, sendVerificationEmail } from "@/lib/security/email-verification"
import { normalizeLocale } from "@/lib/i18n/server"

export const runtime = "nodejs"

// Resend a verification email. Enumeration-safe: always returns ok, and only
// actually sends when an unverified account exists for the address. Verified
// accounts and unknown addresses produce no email and no distinguishable
// response, mirroring the forgot-password flow.
export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const email = (body.email ?? "").trim().toLowerCase()

  const ok = NextResponse.json({ ok: true })
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return ok

  const user = await prisma.user.findUnique({ where: { email } })
  // Only credentials accounts that are not yet verified need this.
  if (!user || !user.passwordHash || user.emailVerified) return ok

  const rawToken = await createEmailVerificationToken(email)
  await sendVerificationEmail(email, rawToken, normalizeLocale(req.cookies.get("neer_lang")?.value))
  return ok
}
