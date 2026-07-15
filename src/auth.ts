import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { authConfig } from "@/auth.config"

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
          // Link Google logins to a pre-seeded user with the same email (admins).
          allowDangerousEmailAccountLinking: true,
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
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) return null

        // Return only safe fields — never leak passwordHash into the JWT.
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Resolve the authoritative role straight from the DB. OAuth (Google)
      // adapter users don't include `role`, so we look it up by the user's id
      // or email — on sign-in, or any request where the token lacks a role.
      const id = user?.id ?? (token.uid as string | undefined) ?? token.sub
      const email = user?.email ?? (token.email as string | undefined)
      if (user || !token.role) {
        if (id || email) {
          const dbUser = await prisma.user.findFirst({
            where: { OR: [{ id: id ?? "" }, { email: email ?? "" }] },
            select: { id: true, role: true },
          })
          if (dbUser) {
            token.uid = dbUser.id
            token.role = dbUser.role
          }
        }
      }
      return token
    },
  },
})
