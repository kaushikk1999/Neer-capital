import { NextResponse } from "next/server"
import { assertAdminMutation } from "@/lib/security/mutation-guard"
import { setDocStatus } from "@/lib/document-mutations"
import { prewarmReportTranslations } from "@/lib/report/prewarm"

export const runtime = "nodejs"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await assertAdminMutation(req, { methods: ["PATCH"] })
  if (!guard.ok) return guard.response
  const doc = await setDocStatus(params.id, { status: "PUBLISHED", published: true }, "document.published", guard.userId)
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // Pre-translate the report into every language so the first visitor gets an
  // already-translated page. Fire-and-forget: never delay the publish response
  // or fail it on a translation hiccup.
  void prewarmReportTranslations(params.id).catch(() => {})
  return NextResponse.json({ ok: true })
}
