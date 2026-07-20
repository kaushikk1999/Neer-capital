import { prisma } from "@/lib/db"

export const MAX_ATTEMPTS = 3
export const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export class JobManager {
  private isShuttingDown = false

  public shutdown() {
    this.isShuttingDown = true
  }

  // Atomic claim
  public async claimNextJob() {
    // We want to claim one QUEUED job
    // To prevent race conditions, we first find a candidate, then do a conditional update
    const candidate = await prisma.analysisJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    })

    if (!candidate) return null

    // Atomic update
    const result = await prisma.analysisJob.updateMany({
      where: {
        id: candidate.id,
        status: "QUEUED",
      },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        heartbeatAt: new Date(),
        attempts: { increment: 1 },
      },
    })

    if (result.count === 0) {
      // Someone else claimed it
      return null
    }

    return prisma.analysisJob.findUnique({ 
      where: { id: candidate.id },
      include: { document: true }
    })
  }

  // Stale recovery
  public async recoverStaleJobs() {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS)

    const staleJobs = await prisma.analysisJob.findMany({
      where: {
        status: "RUNNING",
        heartbeatAt: { lt: staleThreshold },
      },
    })

    let recovered = 0
    let failed = 0

    for (const job of staleJobs) {
      if (job.attempts < MAX_ATTEMPTS) {
        await prisma.analysisJob.update({
          where: { id: job.id },
          data: { status: "QUEUED" },
        })
        recovered++
      } else {
        await prisma.analysisJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            error: "Max attempts reached due to repeated stale timeouts.",
            finishedAt: new Date(),
          },
        })
        failed++
      }
    }

    if (recovered > 0 || failed > 0) {
      console.log(`[JobManager] Recovered ${recovered} stale jobs, marked ${failed} as FAILED.`)
    }
  }

  public async updateHeartbeat(jobId: string) {
    if (this.isShuttingDown) return
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { heartbeatAt: new Date() },
    })
  }

  public async markJobFailed(jobId: string, error: string) {
    const job = await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error,
        finishedAt: new Date(),
      },
      select: { documentId: true },
    })

    // A failed run must also release the document from PROCESSING, otherwise a
    // reprocess that errors leaves it showing "processing" indefinitely with no
    // job running. Scoped to PROCESSING so a PUBLISHED or ARCHIVED document is
    // never downgraded by a failed re-analysis.
    await prisma.document.updateMany({
      where: { id: job.documentId, status: "PROCESSING" },
      data: { status: "DRAFT" },
    })
  }
}
