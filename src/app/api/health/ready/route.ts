import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { EXPECTED_SCHEMA_VERSION } from "@/lib/report/schema-version"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Readiness for the WEB service only.
 *
 * Intentionally does NOT consult worker heartbeats: the worker is a separate
 * service, and a worker outage must not take the website down. Worker state is
 * reported at /api/ops/worker-health instead.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  const requiredEnv = ["DATABASE_URL", "AUTH_SECRET"]
  const missing = requiredEnv.filter((k) => !process.env[k])
  checks.config = { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (error) {
    checks.database = { ok: false, detail: error instanceof Error ? error.message.slice(0, 120) : "unreachable" }
  }

  // Migrations applied is the schema contract between web and worker.
  try {
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `
    const applied = Number(rows?.[0]?.c ?? 0)
    checks.migrations = { ok: applied > 0, detail: `${applied} applied` }
  } catch {
    checks.migrations = { ok: false, detail: "migration table unavailable" }
  }

  checks.storage = {
    ok: process.env.STORAGE_PROVIDER !== "r2" || Boolean(process.env.STORAGE_BUCKET && process.env.STORAGE_ENDPOINT),
    detail: process.env.STORAGE_PROVIDER ?? "local",
  }

  const ok = Object.values(checks).every((c) => c.ok)
  return NextResponse.json(
    { status: ok ? "ready" : "not_ready", schemaVersion: EXPECTED_SCHEMA_VERSION, checks, at: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  )
}
