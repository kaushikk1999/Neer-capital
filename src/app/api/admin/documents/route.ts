import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAdmin } from "@/lib/api-auth"

export const runtime = "nodejs"

export async function GET() {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, slug: true, fileName: true, fileSize: true,
      status: true, published: true, createdAt: true,
    },
  })
  return NextResponse.json({ documents })
}
