import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }) }

  const email = (body.email ?? "").trim().toLowerCase()
  const token = (body.token ?? "").trim()
  const password = body.password ?? ""

  if (!email || !token) return NextResponse.json({ error: "Invalid reset link." }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 422 })

  const vt = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  })
  if (!vt || vt.expires < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({ where: { email }, data: { passwordHash } })
  await prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token } } })

  return NextResponse.json({ ok: true })
}
