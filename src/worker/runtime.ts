/**
 * Worker runtime concerns: schema agreement and liveness reporting.
 *
 * The worker is deployed as its own Railway service and does NOT run
 * migrations — the web service owns them. That creates a window during a
 * rollout where the worker is new but the schema is not yet migrated. Crash
 * looping through that window is noisy and can exhaust restart budgets, so the
 * worker waits, bounded, and only then gives up.
 */

import { hostname } from "os"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"

export { EXPECTED_SCHEMA_VERSION } from "@/lib/report/schema-version"
import { EXPECTED_SCHEMA_VERSION } from "@/lib/report/schema-version"

export const WORKER_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev"

export const INSTANCE_ID = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`

const DEPLOYMENT_ID = process.env.RAILWAY_DEPLOYMENT_ID ?? null

export interface SchemaWaitOptions {
  /** Total time to keep waiting before giving up. */
  maxWaitMs?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

/**
 * Confirms the database carries the tables this worker build needs.
 *
 * We probe a V2 table rather than reading a version column: the question we
 * actually care about is "can I write what I am about to write?".
 */
async function schemaIsReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM extraction_runs LIMIT 1`
    await prisma.$queryRaw`SELECT 1 FROM analysis_evidence LIMIT 1`
    return true
  } catch {
    return false
  }
}

/**
 * Waits for the expected schema with exponential backoff.
 * Returns true when ready; false when the budget expired — the caller should
 * then exit non-zero ONCE rather than spinning.
 */
export async function waitForSchema(options: SchemaWaitOptions = {}): Promise<boolean> {
  const maxWaitMs = options.maxWaitMs ?? 5 * 60 * 1000
  const maxDelayMs = options.maxDelayMs ?? 15_000
  let delay = options.initialDelayMs ?? 1_000

  const deadline = Date.now() + maxWaitMs
  let attempt = 0

  for (;;) {
    attempt++
    if (await schemaIsReady()) {
      if (attempt > 1) {
        console.log(`[Worker] Schema v${EXPECTED_SCHEMA_VERSION} available after ${attempt} attempts.`)
      }
      return true
    }

    if (Date.now() + delay >= deadline) {
      console.error(
        `[Worker] Schema v${EXPECTED_SCHEMA_VERSION} not available after ${Math.round(
          maxWaitMs / 1000
        )}s (${attempt} attempts). The web service owns migrations; is its deploy finished?`
      )
      return false
    }

    console.log(
      `[Worker] Waiting for schema v${EXPECTED_SCHEMA_VERSION} (attempt ${attempt}); retrying in ${delay}ms.`
    )
    await sleep(delay)
    delay = Math.min(delay * 2, maxDelayMs)
  }
}

/**
 * Records this instance's liveness. One row per instance — never a singleton,
 * so several workers can run and be observed independently.
 */
export async function recordHeartbeat(
  update: { queueConnected?: boolean; lastCompletedJobId?: string | null; stalled?: boolean } = {}
): Promise<void> {
  const data = {
    workerVersion: WORKER_VERSION,
    deploymentId: DEPLOYMENT_ID,
    lastHeartbeatAt: new Date(),
    queueConnected: update.queueConnected ?? true,
    stalled: update.stalled ?? false,
    ...(update.lastCompletedJobId !== undefined ? { lastCompletedJobId: update.lastCompletedJobId } : {}),
  }

  try {
    await prisma.workerInstance.upsert({
      where: { instanceId: INSTANCE_ID },
      create: { instanceId: INSTANCE_ID, ...data },
      update: data,
    })
  } catch (error) {
    // Heartbeat failure must never take down the worker loop.
    console.error("[Worker] Heartbeat write failed:", error instanceof Error ? error.message : error)
  }
}

/** Drops this instance's row on graceful shutdown so the fleet view stays honest. */
export async function clearHeartbeat(): Promise<void> {
  try {
    await prisma.workerInstance.deleteMany({ where: { instanceId: INSTANCE_ID } })
  } catch {
    // Nothing useful to do during shutdown.
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
