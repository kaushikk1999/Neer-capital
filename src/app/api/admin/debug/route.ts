import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const jobs = await prisma.analysisJob.findMany({ include: { document: true } })
  return NextResponse.json({ jobs })
}
