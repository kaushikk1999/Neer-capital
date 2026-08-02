import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { authConfig } from "@/auth.config"
import { getClientIp } from "@/lib/security/client-ip"
import { consume, peek, record, reset, logRateEvent } from "@/lib/security/rate-limit"
import { POLICY } from "@/lib/security/rate-limit-policy"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    // Only register Google when credentials are configured — an empty
    // clientId throws at route init and breaks all of /api/auth.
    ...(process.env.GOOGLE_CLIENT_ID
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          // Never auto-link Google to an existing account by matching email:
          // a matching address is not proof the same person controls both
          // identities, and auto-linking enabled account pre-hijacking. On a
          // same-email conflict NextAuth now fails closed (OAuthAccountNotLinked).
          allowDangerousEmailAccountLinking: false,
          authorization: {
            params: {
              prompt: "select_account",
            },
          },
        })]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        if (!credentials?.email || !credentials?.password) return null
        const acct = (credentials.email as string).trim().toLowerCase()
        const ip = getClientIp(request?.headers ?? new Headers()) ?? "noip"

        // Auth.js owns the HTTP response here and cannot cleanly emit 429/503,
        // so a throttled or limiter-unavailable attempt DENIES (returns null,
        // indistinguishable from bad credentials). Broad per-IP burst runs
        // FIRST so DB lookups and bcrypt are bounded even under attack.
        try {
          const ipGate = await consume([{ namespace: "login:ip", id: ip, ...POLICY.login.ip }])
          if (!ipGate.ok) { logRateEvent("rate_limited", "login:ip"); return null }
        } catch {
          logRateEvent("limiter_unavailable", "login:ip")
          return null
        }

        const user = await prisma.user.findUnique({ where: { email: credentials.email as string } })

        // Stricter thresholds for admins (never disclosed). Failure counters are
        // keyed on the normalized account so case variation cannot bypass them,
        // and are consumed even for nonexistent accounts (probing is throttled).
        const isAdmin = user?.role === "ADMIN"
        const acctShort = isAdmin ? POLICY.login.adminAccountShort : POLICY.login.accountShort
        const acctLong = isAdmin ? POLICY.login.adminAccountLong : POLICY.login.accountLong
        const failRules = [
          { namespace: "login:acctshort", id: acct, ...acctShort },
          { namespace: "login:acctlong", id: acct, ...acctLong },
          { namespace: "login:ipacct", id: `${ip}|${acct}`, ...POLICY.login.ipAccount },
        ]

        // If failure counters are already over, deny BEFORE bcrypt.
        try {
          const failGate = await peek(failRules)
          if (!failGate.ok) { logRateEvent("rate_limited", "login:account"); return null }
        } catch {
          logRateEvent("limiter_unavailable", "login:account")
          return null
        }

        if (!user || !user.passwordHash) { await record(failRules); return null }

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!isValid) { await record(failRules); return null }

        // Ownership of the email must be proven before a credentials account
        // can authenticate (pre-hijacking guard). Not counted as a failed
        // attempt — the caller already holds the correct password.
        if (!user.emailVerified) return null

        // Success — clear failure state for this account/IP+account.
        await reset(failRules)

        // Return only safe fields — never leak passwordHash into the JWT.
        // sessionVersion is carried so the token is stamped with the version
        // current at sign-in; a later increment then invalidates this session.
        return { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // On initial sign-in, persist the user's id into the token.
      if (user) {
        token.uid = user.id
        token.sub = user.id
        // Per-session nonce for CSRF binding. Created once when this JWT session
        // is established and never regenerated on later callback invocations, so
        // it is stable within the session but differs across logins — a CSRF
        // token bound to it cannot be replayed in another session.
        if (!token.csrf) token.csrf = randomBytes(18).toString("base64url")
      }

      // Resolve the authoritative role from the DB using only the trusted
      // user ID. Never use findFirst or OR — that can return the wrong user.
      const uid = (token.uid as string | undefined) ?? token.sub
      if (uid && (user || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { id: true, role: true, email: true, sessionVersion: true },
        })
        if (dbUser) {
          token.uid = dbUser.id
          token.role = dbUser.role
          token.email = dbUser.email
          // Stamp the version ONLY at sign-in. Refreshing it on later calls
          // would let a stale token silently re-sync and defeat revocation; the
          // authoritative guards compare this frozen value to the live DB value.
          if (user) token.sessionVersion = dbUser.sessionVersion
        }
      }
      return token
    },
  },
})
