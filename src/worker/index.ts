import { JobManager } from "./job-manager"
import { PdfExtractor } from "./pdf-extractor"
import { AiAnalyzer } from "./ai-analyzer"
import { DbPersister } from "./db-persister"
import { runExtractionPipeline } from "./pipeline"
import { recordHeartbeat, clearHeartbeat, waitForSchema, INSTANCE_ID, WORKER_VERSION } from "./runtime"
import { prisma } from "@/lib/db"

const POLL_INTERVAL_MS = 5000
const RECOVERY_INTERVAL_MS = 60000

/**
 * V2 writes are gated. With the flag off the worker behaves exactly as before,
 * so deploying this build changes nothing until the flag is turned on.
 */
function v2WriteEnabled(): boolean {
  return process.env.REPORT_V2_WRITE === "true"
}

/**
 * V2 path: staged pipeline with evidence, validation and versioned analyses.
 * Falls back to the V1 path on failure so enabling the flag cannot strand a
 * document that the old pipeline could have processed.
 */
async function processJobV2(job: any, manager: JobManager): Promise<boolean> {
  const outcome = await runExtractionPipeline({
    documentId: job.documentId,
    jobId: job.id,
    storageKey: job.document.storageKey,
    fileName: job.document.fileName ?? "document.pdf",
    mimeType: job.document.mimeType ?? null,
  })

  if (outcome.ok && outcome.result) {
    const r = outcome.result
    console.log(
      `[Worker] V2 run ${outcome.runId} -> analysis v${r.version} (${r.status}) ` +
        `metrics=${r.metricCount} evidence=${r.evidenceCount} charts=${r.chartCount} ` +
        `claims=${r.claimCount} issues=${r.issueCount} blockers=${r.blockerCount}`
    )
    await recordHeartbeat({ lastCompletedJobId: job.id })
    return true
  }

  console.error(`[Worker] V2 run ${outcome.runId} failed: ${outcome.error ?? "unknown"}`)
  // A rejected input (bad signature, encrypted, malformed) is terminal — the
  // V1 path cannot do better with the same bytes.
  if (outcome.rejectedCode) return true
  return false
}

async function processJob(job: any, manager: JobManager) {
  console.log(`[Worker] Starting job ${job.id} for document ${job.documentId}`)

  // Heartbeat loop
  const heartbeatInterval = setInterval(() => {
    manager.updateHeartbeat(job.id).catch(console.error)
  }, 30000)

  try {
    if (v2WriteEnabled()) {
      const handled = await processJobV2(job, manager)
      if (handled) return
      console.warn(`[Worker] Falling back to V1 pipeline for job ${job.id}`)
    }

    // ----------------------------------------------------
    // PHASE 4: Deterministic PDF Extraction
    // ----------------------------------------------------
    const extractor = new PdfExtractor()
    const extraction = await extractor.extractFromStorage(job.document.storageKey)
    
    console.log(`[Worker] Extraction complete. Classification: ${extraction.classification}, Pages: ${extraction.pageCount}, Text Length: ${extraction.totalTextLength}`)
    
    if (extraction.classification === "CORRUPTED" || extraction.classification === "UNSUPPORTED") {
      const detail = extraction.failureReason ? `: ${extraction.failureReason}` : ""
      throw new Error(`Terminal extraction failure: ${extraction.classification}${detail}`)
    }
    
    if (extraction.classification === "OCR_REQUIRED") {
      // For now, mark failed since we don't have OCR integration
      throw new Error("OCR_REQUIRED: This document appears to be a scanned image and OCR is not yet implemented.")
    }

    // ----------------------------------------------------
    // PHASE 7: Ollama Integration
    // ----------------------------------------------------
    const analyzer = new AiAnalyzer()
    const { validatedData, rawResponse, modelName } = await analyzer.analyzeDocument(extraction)
    console.log(`[Worker] AI Analysis successful for job ${job.id}`)
    
    // ----------------------------------------------------
    // PHASE 8-10: Database Persister
    // ----------------------------------------------------
    const persister = new DbPersister()
    await persister.persistAnalysis(job.id, job.documentId, validatedData, rawResponse, modelName)
    
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error)
    await manager.markJobFailed(job.id, String(error))
  } finally {
    clearInterval(heartbeatInterval)
  }
}

async function main() {
  console.log(`[Worker] Starting background worker ${INSTANCE_ID} (build ${WORKER_VERSION})...`)

  // The web service owns migrations. During a rollout the worker can start
  // before the schema is in place, so wait instead of crash-looping.
  const schemaReady = await waitForSchema()
  if (!schemaReady) {
    await prisma.$disconnect()
    // Exit once, non-zero, so the platform restarts us on its own schedule.
    process.exit(1)
  }

  const manager = new JobManager()
  let isRunning = true

  const shutdown = async (signal: string) => {
    console.log(`\n[Worker] Received ${signal}, shutting down gracefully...`)
    isRunning = false
    manager.shutdown()

    // Wait briefly for current polling iteration to exit before disconnecting Prisma
    setTimeout(async () => {
      await clearHeartbeat()
      await prisma.$disconnect()
      console.log("[Worker] Graceful shutdown complete.")
      process.exit(0)
    }, 1500)
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))

  let lastRecovery = 0

  while (isRunning) {
    const now = Date.now()
    if (now - lastRecovery > RECOVERY_INTERVAL_MS) {
      await manager.recoverStaleJobs().catch(console.error)
      lastRecovery = now
    }

    try {
      await recordHeartbeat({ queueConnected: true })
      const job = await manager.claimNextJob()
      
      if (job) {
        await processJob(job, manager)
      } else {
        // Idle
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    } catch (error) {
      console.error("[Worker] Polling error:", error)
      await recordHeartbeat({ queueConnected: false, stalled: true })
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err)
  process.exit(1)
})
