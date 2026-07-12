import { NextResponse } from "next/server"
import { requireApiAdmin } from "@/lib/api-auth"
import { setDocStatus } from "@/lib/document-mutations"

export const runtime = "nodejs"

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error
  const doc = await setDocStatus(params.id, { status: "ARCHIVED", published: false }, "document.archived", guard.session.user.id)
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
