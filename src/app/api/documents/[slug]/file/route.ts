import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getObject } from "@/lib/storage"

export const runtime = "nodejs"

// Public download — only serves PUBLISHED documents. Unpublished/archived/draft
// docs return 404 so they are never discoverable publicly.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const doc = await prisma.document.findFirst({
    where: { slug: params.slug, published: true, status: "PUBLISHED" },
  })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const buf = await getObject(doc.storageKey)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
