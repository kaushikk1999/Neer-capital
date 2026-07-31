import type { Role } from "@prisma/client"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
      // Frozen at sign-in; server guards compare it to the DB value to reject
      // sessions invalidated by a password reset, role change, etc.
      sessionVersion?: number
      // Per-session nonce that admin CSRF tokens are bound to.
      csrfNonce?: string
    } & DefaultSession["user"]
  }
  interface User {
    role?: Role
    sessionVersion?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role
    uid?: string
    sessionVersion?: number
    // Per-session CSRF nonce, set once at sign-in.
    csrf?: string
  }
}
