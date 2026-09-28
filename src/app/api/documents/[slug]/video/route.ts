import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getObject } from "@/lib/storage"
import { videoStorageKey } from "@/lib/report/video"

export const runtime = "nodejs"

// Public stream of a report's stored video — PUBLISHED documents only. Honours
// single byte-range requests, which Safari/iOS require for <video> playback.
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const doc = await prisma.document.findFirst({
    where: { slug: params.slug, published: true, status: "PUBLISHED" },
    select: { id: true },
  })
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let buf: Buffer
  try {
    buf = await getObject(videoStorageKey(doc.id))
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const size = buf.length
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "")
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    }
    return new NextResponse(new Uint8Array(buf.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    })
  }
  return new NextResponse(new Uint8Array(buf), { headers: { ...headers, "Content-Length": String(size) } })
}
