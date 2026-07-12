import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAdmin } from "@/lib/api-auth"
import { getObject } from "@/lib/storage"

export const runtime = "nodejs"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const doc = await prisma.document.findUnique({ where: { id: params.id } })
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
    return NextResponse.json({ error: "File missing from storage." }, { status: 404 })
  }
}
