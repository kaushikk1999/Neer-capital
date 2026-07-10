import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Uses only the edge-safe config (no Prisma/bcrypt). Protects the authenticated
// areas only — the public marketing site and contact form stay open. Guests are
// redirected to /login; non-admins are redirected away from /admin.
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
}
