import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { Resend } from "resend"
import { prisma } from "@/lib/db"
import { getClientIp } from "@/lib/security/client-ip"
import { consume, RateLimiterUnavailable, tooManyRequests, limiterUnavailableResponse, logRateEvent } from "@/lib/security/rate-limit"
import { POLICY } from "@/lib/security/rate-limit-policy"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }
  const email = (body.email ?? "").trim().toLowerCase()

  // Always return ok to avoid account enumeration.
  const ok = NextResponse.json({ ok: true })
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return ok

  // Rate limit BEFORE any token creation or email send. The account/cooldown
  // dimensions apply to every submitted address (existent or not), so a 429
  // never reveals whether the account exists.
  const ip = getClientIp(req.headers) ?? "noip"
  try {
    const gate = await consume([
      { namespace: "forgot:ip", id: ip, ...POLICY.forgot.ip },
      { namespace: "forgot:account", id: email, ...POLICY.forgot.account },
      { namespace: "forgot:ipaccount", id: `${ip}|${email}`, ...POLICY.forgot.ipAccount },
      { namespace: "forgot:cooldown", id: email, ...POLICY.forgot.cooldown },
    ])
    if (!gate.ok) { logRateEvent("rate_limited", "forgot"); return tooManyRequests(gate.retryAfterSec) }
  } catch (e) {
    if (e instanceof RateLimiterUnavailable) { logRateEvent("limiter_unavailable", "forgot"); return limiterUnavailableResponse() }
    return limiterUnavailableResponse()
  }

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
    const { data, error } = await new Resend(apiKey).emails.send({
      from: process.env.CONTACT_FROM || "Neer <onboarding@resend.dev>",
      to: email,
      subject: "Reset your Neer Capital password",
      html: `<p>We received a request to reset your password.</p>
<p><a href="${link}">Click here to reset it</a> (valid for 1 hour).</p>
<p>If you didn't request this, you can ignore this email.</p>`,
    })
    // Never reveal delivery state to the caller, but log it server-side so a
    // misconfigured sender (unverified domain, bad key) is diagnosable.
    if (error) console.error("[forgot-password] Resend error:", JSON.stringify(error))
    else console.log("[forgot-password] Resend accepted, id:", data?.id)
  } catch (e) {
    console.error("[forgot-password] Resend threw:", e instanceof Error ? e.message : String(e))
  }
  return ok
}
