import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { audit, requireApiAdmin } from "@/lib/api-auth"
import { assertAdminMutation } from "@/lib/security/mutation-guard"
import { putObject } from "@/lib/storage"
import { storedVideoPath, videoStorageKey } from "@/lib/report/video"
import { normalizeForSpeech } from "@/lib/video/tts"
import { createAvatarVideo, getAvatarVideo, heygenConfigured } from "@/lib/video/heygen"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_SCRIPT = 1500

// Start a HeyGen avatar render for this document from an admin-written script.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await assertAdminMutation(req, { methods: ["POST"] })
  if (!guard.ok) return guard.response
  if (!heygenConfigured()) return NextResponse.json({ error: "HEYGEN_API_KEY is not set" }, { status: 503 })

  const body = await req.json().catch(() => null)
  const script = typeof body?.script === "string" ? body.script.trim() : ""
  if (!script || script.length > MAX_SCRIPT) {
    return NextResponse.json({ error: `Script must be 1–${MAX_SCRIPT} characters` }, { status: 400 })
  }

  const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { id: true, title: true } })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const videoJobId = await createAvatarVideo({ script: normalizeForSpeech(script), title: doc.title, callbackId: doc.id })
    await prisma.document.update({ where: { id: doc.id }, data: { videoJobId } })
    await audit("document.video_generation_started", { userId: guard.userId, documentId: doc.id, details: { videoJobId } })
    return NextResponse.json({ ok: true, status: "pending" })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "HeyGen request failed" }, { status: 502 })
  }
}

// Poll the in-flight render. When it completes, copy the MP4 into our bucket
// (HeyGen links are short-lived presigned URLs) and attach it to the report.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, videoJobId: true, videoUrl: true },
  })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!doc.videoJobId) return NextResponse.json({ status: "idle", videoUrl: doc.videoUrl })

  try {
    const v = await getAvatarVideo(doc.videoJobId)
    if (v.status === "failed") {
      await prisma.document.update({ where: { id: doc.id }, data: { videoJobId: null } })
      return NextResponse.json({ status: "failed", error: v.failureMessage || "HeyGen render failed" })
    }
    if (v.status !== "completed" || !v.videoUrl) return NextResponse.json({ status: v.status })

    const file = await fetch(v.videoUrl, { cache: "no-store" })
    if (!file.ok) throw new Error(`Download failed (HTTP ${file.status})`)
    await putObject(videoStorageKey(doc.id), Buffer.from(await file.arrayBuffer()))

    const videoUrl = storedVideoPath(doc.slug, doc.videoJobId)
    // Only clear the job we stored, in case a newer render was started meanwhile.
    await prisma.document.updateMany({ where: { id: doc.id, videoJobId: doc.videoJobId }, data: { videoUrl, videoJobId: null } })
    await audit("document.video_updated", { userId: guard.user.id, documentId: doc.id, details: { videoUrl, source: "heygen" } })
    return NextResponse.json({ status: "completed", videoUrl })
  } catch (err: any) {
    return NextResponse.json({ status: "error", error: err?.message || "HeyGen status check failed" }, { status: 502 })
  }
}
