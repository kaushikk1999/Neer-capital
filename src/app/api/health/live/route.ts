import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Liveness: is this process running at all?
 * Deliberately checks nothing external — a database blip must not cause the
 * platform to kill a healthy web process.
 */
export async function GET() {
  return NextResponse.json({ status: "live", at: new Date().toISOString() })
}
