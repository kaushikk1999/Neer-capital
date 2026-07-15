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
      // On initial sign-in, persist the user's id into the token.
      if (user) {
        token.uid = user.id
        token.sub = user.id
      }

      // Resolve the authoritative role from the DB using only the trusted
      // user ID. Never use findFirst or OR — that can return the wrong user.
      const uid = (token.uid as string | undefined) ?? token.sub
      if (uid && (user || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { id: true, role: true, email: true },
        })
        if (dbUser) {
          token.uid = dbUser.id
          token.role = dbUser.role
          token.email = dbUser.email
        }
      }
      return token
    },
  },
})
