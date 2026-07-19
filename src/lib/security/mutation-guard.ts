/**
 * Guard for cookie-authenticated admin mutations.
 *
 * Session cookies are sent automatically by the browser, so authentication
 * alone does not prove the request was intended by the user. Same-origin
 * assumptions are not a complete control either. Every mutating admin route
 * therefore passes four checks:
 *
 *   method        - only the verbs the route declares
 *   content type  - JSON only, which blocks HTML form cross-site posts
 *   origin        - must be an allowed origin, not merely present
 *   CSRF token    - HMAC-signed, bound to this session, and time-limited
 *
 * The token is a double-submit: it travels in a cookie and must be echoed in a
 * header. A cross-site attacker can cause the cookie to be sent but cannot read
 * it to set the header, and cannot forge the signature without the secret.
 */

import { createHmac, timingSafeEqual, randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { requireApiAdmin } from "@/lib/api-auth"

export { CSRF_COOKIE, CSRF_HEADER } from "@/lib/security/csrf-constants"
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/security/csrf-constants"

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is required to sign CSRF tokens")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

/**
 * Builds a token bound to a session. Changing session, expiry or nonce
 * invalidates the signature, so a token cannot be replayed across sessions.
 */
export function issueCsrfToken(sessionKey: string): string {
  const nonce = randomBytes(16).toString("base64url")
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const payload = `${sessionKey}.${nonce}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export type CsrfFailure = "MISSING" | "MISMATCH" | "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" | "WRONG_SESSION"

export function verifyCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined,
  sessionKey: string
): { ok: true } | { ok: false; reason: CsrfFailure } {
  if (!cookieToken || !headerToken) return { ok: false, reason: "MISSING" }
  // Double submit: the two must match before we bother verifying the signature.
  if (!safeEqual(cookieToken, headerToken)) return { ok: false, reason: "MISMATCH" }

  const parts = cookieToken.split(".")
  if (parts.length !== 4) return { ok: false, reason: "MALFORMED" }
  const [tokenSession, nonce, expiresRaw, signature] = parts

  const payload = `${tokenSession}.${nonce}.${expiresRaw}`
  if (!safeEqual(signature, sign(payload))) return { ok: false, reason: "BAD_SIGNATURE" }

  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return { ok: false, reason: "EXPIRED" }

  // Signature valid but issued for a different session — reject.
  if (!safeEqual(tokenSession, sessionKey)) return { ok: false, reason: "WRONG_SESSION" }

  return { ok: true }
}

function allowedOrigins(): string[] {
  const configured = [process.env.AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean) as string[]
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`] : []
  const dev = process.env.NODE_ENV !== "production" ? ["http://localhost:3000"] : []
  return [...configured, ...railway, ...dev].map((o) => o.replace(/\/$/, ""))
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin") ?? deriveOrigin(req.headers.get("referer"))
  if (!origin) return false
  const normalized = origin.replace(/\/$/, "")
  return allowedOrigins().some((a) => a === normalized)
}

function deriveOrigin(referer: string | null): string | null {
  if (!referer) return null
  try {
    const u = new URL(referer)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export interface GuardOk {
  ok: true
  userId: string
  sessionKey: string
}

export interface GuardFail {
  ok: false
  response: NextResponse
}

function deny(status: number, code: string, message: string): GuardFail {
  return { ok: false, response: NextResponse.json({ error: code, message }, { status }) }
}

/**
 * Runs every guard in order and returns the admin identity on success.
 * Call this first in any mutating admin route, before reading the body.
 */
export async function assertAdminMutation(
  req: Request,
  options: { methods?: string[] } = {}
): Promise<GuardOk | GuardFail> {
  const methods = options.methods ?? ["POST", "PATCH", "PUT", "DELETE"]
  if (!methods.includes(req.method.toUpperCase())) {
    return deny(405, "METHOD_NOT_ALLOWED", `${req.method} is not permitted on this route.`)
  }

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (contentType !== "application/json") {
    return deny(415, "UNSUPPORTED_MEDIA_TYPE", "Request body must be application/json.")
  }

  if (!originAllowed(req)) {
    return deny(403, "ORIGIN_REJECTED", "Request origin is not allowed.")
  }

  const guard = await requireApiAdmin()
  if ("error" in guard) return { ok: false, response: guard.error }

  const userId = guard.session.user?.id
  if (!userId) return deny(401, "UNAUTHENTICATED", "No authenticated user on the session.")

  // Session-bound: the token must have been issued for this user's session.
  const sessionKey = userId
  const cookieToken = readCookie(req.headers.get("cookie"), CSRF_COOKIE)
  const headerToken = req.headers.get(CSRF_HEADER) ?? undefined

  const csrf = verifyCsrfToken(cookieToken, headerToken, sessionKey)
  if (!csrf.ok) {
    return deny(403, "CSRF_REJECTED", `CSRF validation failed (${csrf.reason}).`)
  }

  return { ok: true, userId, sessionKey }
}

export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return undefined
}
