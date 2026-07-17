const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const jobs = await prisma.analysisJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2
    })
    console.log("RECENT JOBS:", JSON.stringify(jobs, null, 2))
  } catch (error) {
    console.error("DB Error:", error)
  }
}

main().finally(() => prisma.$disconnect())
