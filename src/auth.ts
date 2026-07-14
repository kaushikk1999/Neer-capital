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
      if (user) {
        token.uid = user.id
        token.role = (user as { role?: "ADMIN" | "USER" }).role
      }
      // Google/OAuth adapter users don't carry `role`; resolve it from the DB
      // (by user id or email) so seeded admins get ADMIN, not the USER fallback.
      if (!token.role && (token.sub || token.email)) {
        const dbUser = await prisma.user.findFirst({
          where: { OR: [{ id: token.sub ?? "" }, { email: token.email ?? "" }] },
          select: { id: true, role: true },
        })
        if (dbUser) {
          token.uid = dbUser.id
          token.role = dbUser.role
        }
      }
      return token
    },
  },
})
