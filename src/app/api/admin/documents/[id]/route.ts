import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAdmin, audit } from "@/lib/api-auth"
import { deleteObject } from "@/lib/storage"

export const runtime = "nodejs"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { files: true, versions: true, uploadedBy: { select: { email: true, name: true } } },
  })
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ document })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error
  const { session } = guard

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { files: true },
  })
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Remove stored blobs first, then the metadata (cascade drops files/versions).
  for (const f of document.files) await deleteObject(f.storageKey)
  await deleteObject(document.storageKey)
  await prisma.document.delete({ where: { id: document.id } })
  await audit("document.deleted", { userId: session.user.id, documentId: document.id, details: { title: document.title } })

  return NextResponse.json({ ok: true })
}
