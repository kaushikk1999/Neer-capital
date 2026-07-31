import { NextRequest, NextResponse } from "next/server"
import { consumeEmailVerificationToken } from "@/lib/security/email-verification"

export const runtime = "nodejs"

// Consumes a verification token and marks the account verified. POST (not GET)
// so the token is not carried in a Referer header to third parties.
export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }

  const email = (body.email ?? "").trim().toLowerCase()
  const token = (body.token ?? "").trim()
  if (!email || !token) return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 })

  const result = await consumeEmailVerificationToken(email, token)
  if (result !== "verified") {
    return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
