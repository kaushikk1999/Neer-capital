import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Uses only the edge-safe config (no Prisma/bcrypt). Unauthenticated requests
// to matched routes are redirected to /login by the `authorized` callback.
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  // Protect everything except auth endpoints, the login page, and static assets.
  matcher: [
    "/((?!api/auth|api/register|login|signup|_next/static|_next/image|favicon.ico|icon|robots.txt|sitemap.xml).*)",
  ],
}
