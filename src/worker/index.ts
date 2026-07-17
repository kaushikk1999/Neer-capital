import { JobManager } from "./job-manager"
import { PdfExtractor } from "./pdf-extractor"
import { AiAnalyzer } from "./ai-analyzer"
import { DbPersister } from "./db-persister"
import { prisma } from "@/lib/db"

const POLL_INTERVAL_MS = 5000
const RECOVERY_INTERVAL_MS = 60000

async function processJob(job: any, manager: JobManager) {
  console.log(`[Worker] Starting job ${job.id} for document ${job.documentId}`)
  
  // Heartbeat loop
  const heartbeatInterval = setInterval(() => {
    manager.updateHeartbeat(job.id).catch(console.error)
  }, 30000)

  try {
    // ----------------------------------------------------
    // PHASE 4: Deterministic PDF Extraction
    // ----------------------------------------------------
    const extractor = new PdfExtractor()
    const extraction = await extractor.extractFromStorage(job.document.storageKey)
    
    console.log(`[Worker] Extraction complete. Classification: ${extraction.classification}, Pages: ${extraction.pageCount}, Text Length: ${extraction.totalTextLength}`)
    
    if (extraction.classification === "CORRUPTED" || extraction.classification === "UNSUPPORTED") {
      throw new Error(`Terminal extraction failure: ${extraction.classification}`)
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
  console.log("[Worker] Starting background worker...")
  
  const manager = new JobManager()
  let isRunning = true

  const shutdown = async (signal: string) => {
    console.log(`\n[Worker] Received ${signal}, shutting down gracefully...`)
    isRunning = false
    manager.shutdown()
    
    // Wait briefly for current polling iteration to exit before disconnecting Prisma
    setTimeout(async () => {
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
      const job = await manager.claimNextJob()
      
      if (job) {
        await processJob(job, manager)
      } else {
        // Idle
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    } catch (error) {
      console.error("[Worker] Polling error:", error)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err)
  process.exit(1)
})
