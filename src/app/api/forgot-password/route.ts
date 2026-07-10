import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { Resend } from "resend"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const email = (body.email ?? "").trim().toLowerCase()

  // Always return ok to avoid account enumeration.
  const ok = NextResponse.json({ ok: true })
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return ok

  const user = await prisma.user.findUnique({ where: { email } })
  const apiKey = process.env.RESEND_API_KEY
  if (!user || !apiKey) return ok

  const token = crypto.randomBytes(32).toString("hex")
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + 60 * 60_000) },
  })

  const site = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
  const link = `${site}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
  try {
    await new Resend(apiKey).emails.send({
      from: process.env.CONTACT_FROM || "Neer <onboarding@resend.dev>",
      to: email,
      subject: "Reset your Neer Capital password",
      html: `<p>We received a request to reset your password.</p>
<p><a href="${link}">Click here to reset it</a> (valid for 1 hour).</p>
<p>If you didn't request this, you can ignore this email.</p>`,
    })
  } catch {
    // Swallow — never reveal delivery state to the caller.
  }
  return ok
}
