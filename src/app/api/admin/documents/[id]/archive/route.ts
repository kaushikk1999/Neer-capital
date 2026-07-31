import { NextResponse } from "next/server"
import { assertAdminMutation } from "@/lib/security/mutation-guard"
import { setDocStatus } from "@/lib/document-mutations"

export const runtime = "nodejs"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await assertAdminMutation(req, { methods: ["PATCH"] })
  if (!guard.ok) return guard.response
  const doc = await setDocStatus(params.id, { status: "ARCHIVED", published: false }, "document.archived", guard.userId)
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
