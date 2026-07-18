import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { putObject } from "@/lib/storage"
import { generateStorageKey, checksum, uniqueSlug } from "@/lib/documents"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const failedJobs = await prisma.analysisJob.findMany({ where: { status: "FAILED" } })
    for (const job of failedJobs) {
      try {
        await prisma.document.delete({ where: { id: job.documentId } })
      } catch (e) {
        console.error("Failed to delete document", job.documentId, e)
      }
    }
    
    const buffer = Buffer.from(await req.arrayBuffer())
    if (buffer.length > 0) {
      const title = "Balrampur Chini research Reports"
      const displayName = "Balrampur_Chini_research_Reports.pdf"
      const slug = await uniqueSlug(title)
      const documentId = crypto.randomUUID()
      const storageKey = generateStorageKey(documentId)

      await putObject(storageKey, buffer)
      
      const firstUser = await prisma.user.findFirst()
      if (!firstUser) throw new Error("No user found")
      
      const document = await prisma.document.create({
        data: {
          id: documentId,
          title,
          slug,
          fileName: displayName,
          fileSize: buffer.length,
          mimeType: "application/pdf",
          storageKey,
          status: "DRAFT",
          published: false,
          uploadedById: firstUser.id,
          files: {
            create: {
              storageKey,
              filename: displayName,
              mimeType: "application/pdf",
              size: buffer.length,
              checksum: checksum(buffer),
            },
          },
          jobs: {
            create: {
              status: "QUEUED",
              progress: 0,
              attempts: 0,
            },
          },
        },
        include: { files: true },
      })
      await prisma.documentVersion.create({
        data: { documentId: document.id, version: 1, fileId: document.files[0].id },
      })
      return NextResponse.json({ success: true, deleted: failedJobs.length, uploadedDocumentId: document.id })
    }
    return NextResponse.json({ success: true, deleted: failedJobs.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
