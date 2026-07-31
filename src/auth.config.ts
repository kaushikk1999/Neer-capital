import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"

// Edge-safe config (no Prisma/bcrypt) — shared by the full auth.ts and the
// middleware. Callbacks move the role between the JWT and the session; the
// `authorized` callback gates matched routes and enforces /admin for ADMINs.
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // On sign-in `user` carries the DB role; persist it in the token.
      if (user) {
        token.role = (user as { role?: "ADMIN" | "USER" }).role ?? "USER"
        token.uid = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id
        session.user.role = (token.role as "ADMIN" | "USER") ?? "USER"
        if (token.email) session.user.email = token.email as string
        // Surfaced so server guards can compare against the live DB value.
        // Left undefined for legacy tokens issued before this field existed —
        // the guards treat that as invalid and require re-authentication.
        session.user.sessionVersion = token.sessionVersion as number | undefined
        // Per-session nonce that CSRF tokens are bound to (server reads it at
        // issue and verify time). Not a secret: the CSRF token, given to the
        // client anyway, embeds it; forgery is prevented by the HMAC signature.
        session.user.csrfNonce = token.csrf as string | undefined
      }
      return session
    },
    authorized({ auth, request }) {
      const user = auth?.user
      if (!user) return false // unauthenticated → redirect to /login
      // Admin-only area — enforced here AND server-side in the page.
      if (request.nextUrl.pathname.startsWith("/admin") && user.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", request.nextUrl))
      }
      return true
    },
  },
} satisfies NextAuthConfig
