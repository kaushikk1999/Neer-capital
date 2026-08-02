import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { getClientIp } from "@/lib/security/client-ip"
import { consume, RateLimiterUnavailable, tooManyRequests, limiterUnavailableResponse, logRateEvent } from "@/lib/security/rate-limit"
import { POLICY } from "@/lib/security/rate-limit-policy"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }

  const email = (body.email ?? "").trim().toLowerCase()
  const token = (body.token ?? "").trim()
  const password = body.password ?? ""

  if (!email || !token) return NextResponse.json({ error: "Invalid reset link." }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 422 })

  // Rate limit BEFORE token lookup and bcrypt. The token dimension uses a local
  // hash of the token as an opaque id — the raw token is never used as a key.
  const ip = getClientIp(req.headers) ?? "noip"
  const tokenFp = createHash("sha256").update(token).digest("base64url").slice(0, 32)
  try {
    const gate = await consume([
      { namespace: "reset:ip", id: ip, ...POLICY.reset.ip },
      { namespace: "reset:account", id: email, ...POLICY.reset.account },
      { namespace: "reset:ipaccount", id: `${ip}|${email}`, ...POLICY.reset.ipAccount },
      { namespace: "reset:tokenfp", id: tokenFp, ...POLICY.reset.tokenFp },
    ])
    if (!gate.ok) { logRateEvent("rate_limited", "reset"); return tooManyRequests(gate.retryAfterSec) }
  } catch (e) {
    if (e instanceof RateLimiterUnavailable) { logRateEvent("limiter_unavailable", "reset"); return limiterUnavailableResponse() }
    return limiterUnavailableResponse()
  }

  const vt = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  })
  if (!vt || vt.expires < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  // Rotate the password and revoke every existing session in one write: the
  // version bump invalidates any JWT stamped with the prior value.
  await prisma.user.update({
    where: { email },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  })
  await prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token } } })

  return NextResponse.json({ ok: true })
}
