import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAdmin } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** A heartbeat older than this means the instance is not actually working. */
const STALE_HEARTBEAT_MS = 60_000

/**
 * Operational view of the worker fleet. Admin-only, and NOT used as a Railway
 * health check — this reports queue depth and per-instance liveness so a
 * stalled worker is visible without being able to fail the web deployment.
 */
export async function GET() {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error

  const now = Date.now()
  const [instances, queued, running, failed] = await Promise.all([
    prisma.workerInstance.findMany({ orderBy: { lastHeartbeatAt: "desc" }, take: 20 }),
    prisma.analysisJob.count({ where: { status: "QUEUED" } }),
    prisma.analysisJob.count({ where: { status: "RUNNING" } }),
    prisma.analysisJob.count({ where: { status: "FAILED" } }),
  ])

  const fleet = instances.map((i) => ({
    instanceId: i.instanceId,
    deploymentId: i.deploymentId,
    workerVersion: i.workerVersion,
    lastHeartbeatAt: i.lastHeartbeatAt,
    ageMs: now - i.lastHeartbeatAt.getTime(),
    fresh: now - i.lastHeartbeatAt.getTime() < STALE_HEARTBEAT_MS,
    queueConnected: i.queueConnected,
    stalled: i.stalled,
    lastCompletedJobId: i.lastCompletedJobId,
  }))

  const active = fleet.filter((f) => f.fresh)
  return NextResponse.json({
    status: active.length > 0 ? "workers_active" : "no_active_workers",
    activeWorkers: active.length,
    totalKnownWorkers: fleet.length,
    queue: { queued, running, failed },
    workers: fleet,
    at: new Date().toISOString(),
  })
}
