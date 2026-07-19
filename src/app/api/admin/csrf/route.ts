import { NextResponse } from "next/server"
import { requireApiAdmin } from "@/lib/api-auth"
import { issueCsrfToken, CSRF_COOKIE } from "@/lib/security/mutation-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Issues a session-bound CSRF token for admin mutations.
 * The token is set as a readable cookie so the client can echo it in a header
 * (double submit); its signature binds it to this user's session.
 */
export async function GET() {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const userId = guard.session.user?.id
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })

  const token = issueCsrfToken(userId)
  const res = NextResponse.json({ token })
  res.cookies.set(CSRF_COOKIE, token, {
    // Readable by the client on purpose: double-submit requires echoing it.
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  })
  return res
}
