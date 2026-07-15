import { NextResponse } from "next/server"
import { requireApiAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const { analysisId } = await req.json().catch(() => ({}))
  if (!analysisId) return NextResponse.json({ error: "Missing analysisId" }, { status: 400 })

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Mark analysis as APPROVED
      await tx.documentAnalysis.update({
        where: { id: analysisId },
        data: { status: "APPROVED" }
      })

      // 2. Publish document with this analysis
      await tx.document.update({
        where: { id: params.id },
        data: {
          published: true,
          status: "PUBLISHED",
          publishedAnalysisId: analysisId
        }
      })

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          event: "document.analysis.approved",
          userId: guard.session.user.id,
          documentId: params.id,
          details: { analysisId }
        }
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Approve Route] Transaction failed:", error)
    return NextResponse.json({ error: "Failed to approve and publish document." }, { status: 500 })
  }
}
