import crypto from "crypto"
import { Resend } from "resend"
import { prisma } from "@/lib/db"
import { serverT } from "@/lib/i18n/server"
import type { Locale } from "@/lib/i18n/types"

// Email-ownership verification for credentials accounts.
//
// Tokens reuse the existing VerificationToken table but are namespaced so they
// can never be confused with password-reset tokens (which use the bare email as
// identifier). Only a SHA-256 hash of the token is stored; the raw token exists
// only in the emailed link, so a database read cannot verify an account.

const TTL_MS = 60 * 60_000 // 1 hour
const ns = (email: string) => `verify:${email}`
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex")

/** Issue a fresh verification token, replacing any outstanding one. Returns the
 *  raw token (to be emailed) — never persisted. */
export async function createEmailVerificationToken(email: string): Promise<string> {
  const identifier = ns(email)
  // Replace outstanding tokens so at most one is live and buildup is bounded.
  await prisma.verificationToken.deleteMany({ where: { identifier } })
  const raw = crypto.randomBytes(32).toString("hex")
  await prisma.verificationToken.create({
    data: { identifier, token: sha256(raw), expires: new Date(Date.now() + TTL_MS) },
  })
  return raw
}

type ConsumeResult = "verified" | "invalid"

/** Atomically consume a token and mark the account verified. Single-use and
 *  race-safe: the deleteMany acts as the lock, so only one concurrent caller
 *  can win. Never reveals whether the email exists. */
export async function consumeEmailVerificationToken(email: string, rawToken: string): Promise<ConsumeResult> {
  const identifier = ns(email)
  const hash = sha256(rawToken)

  const vt = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: hash } },
  })
  if (!vt || vt.expires < new Date()) return "invalid"

  // Deleting first claims the token; a second request finds count 0 and fails.
  const claimed = await prisma.verificationToken.deleteMany({ where: { identifier, token: hash } })
  if (claimed.count !== 1) return "invalid"

  // Mark verified only if the account still exists. updateMany avoids throwing
  // when the row is gone, keeping the response generic.
  await prisma.user.updateMany({ where: { email }, data: { emailVerified: new Date() } })

  // Invalidate any other outstanding verification tokens for this email.
  await prisma.verificationToken.deleteMany({ where: { identifier } })
  return "verified"
}

/** Send the verification email. Returns whether the provider accepted it; the
 *  raw token is never logged. Callers must not reveal delivery state to clients
 *  in a way that enables account enumeration. */
export async function sendVerificationEmail(email: string, rawToken: string, locale: Locale = "en"): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const site = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
  const link = `${site}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`
  const t = serverT(locale)
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.CONTACT_FROM || "Neer <onboarding@resend.dev>",
      to: email,
      subject: t("email.verify.subject"),
      html: `<p>${t("email.verify.p1")}</p>
<p><a href="${link}">${t("email.verify.link")}</a> ${t("email.verify.validity")}.</p>
<p>${t("email.verify.ignore")}</p>`,
    })
    if (error) {
      console.error("[verify-email] Resend error:", JSON.stringify(error))
      return false
    }
    return true
  } catch (e) {
    console.error("[verify-email] Resend threw:", e instanceof Error ? e.message : String(e))
    return false
  }
}
