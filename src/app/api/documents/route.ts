import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
// Queries the DB per request — never statically pre-render (build has no DB).
export const dynamic = "force-dynamic"

// Public — published documents only. Never exposes drafts or archived docs.
export async function GET() {
  const documents = await prisma.document.findMany({
    where: { published: true, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: { title: true, slug: true, fileName: true, fileSize: true, createdAt: true },
  })
  return NextResponse.json({ documents })
}
