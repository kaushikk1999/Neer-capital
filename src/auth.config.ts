import type { NextAuthConfig } from "next-auth"

// Edge-safe config (no Prisma/bcrypt) — shared by the full auth.ts and the
// middleware. `authorized` gates every matched route behind a session.
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
  },
} satisfies NextAuthConfig
