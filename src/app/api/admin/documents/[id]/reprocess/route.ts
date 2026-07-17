import { NextResponse } from "next/server"
import { requireApiAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

// Re-queues a document's analysis job. Without this a FAILED job is terminal:
// the worker only claims QUEUED jobs and never resets a failed one, so a
// document that failed once could never be analysed again.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existing = await prisma.analysisJob.findFirst({
    where: { documentId: document.id },
    orderBy: { createdAt: "desc" },
  })

  // Never queue a second job while one is still in flight — that would let two
  // workers analyse the same document and persist duplicate results.
  if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING")) {
    return NextResponse.json(
      { error: "Analysis is already queued or running for this document." },
      { status: 409 }
    )
  }

  const job = existing
    ? await prisma.analysisJob.update({
        where: { id: existing.id },
        data: {
          status: "QUEUED",
          attempts: 0,
          error: null,
          progress: 0,
          startedAt: null,
          finishedAt: null,
          heartbeatAt: null,
        },
      })
    : await prisma.analysisJob.create({
        data: { documentId: document.id, status: "QUEUED" },
      })

  await prisma.document.update({
    where: { id: document.id },
    data: { status: "PROCESSING" },
  })

  console.log(`[Reprocess] Re-queued job ${job.id} for document ${document.id}`)
  return NextResponse.json({ ok: true, jobId: job.id })
}
