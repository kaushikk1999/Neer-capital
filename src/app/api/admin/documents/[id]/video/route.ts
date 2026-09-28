import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/api-auth"
import { assertAdminMutation } from "@/lib/security/mutation-guard"
import { normalizeVideoUrl } from "@/lib/report/video"

export const runtime = "nodejs"

// Set (https URL) or clear (null / empty string) a document's presenter video.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await assertAdminMutation(req, { methods: ["PATCH"] })
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => null)
  const raw = body?.videoUrl
  const clearing = raw === null || (typeof raw === "string" && raw.trim() === "")
  const videoUrl = clearing ? null : normalizeVideoUrl(raw)
  if (!clearing && !videoUrl) {
    return NextResponse.json({ error: "Video URL must be an https link" }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.document.update({ where: { id: doc.id }, data: { videoUrl } })
  await audit("document.video_updated", { userId: guard.userId, documentId: doc.id, details: { videoUrl } })
  return NextResponse.json({ ok: true, videoUrl })
}
