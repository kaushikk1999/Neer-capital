const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const docCount = await prisma.document.count()
  const publishedDocCount = await prisma.document.count({ where: { published: true } })
  const analysisCount = await prisma.documentAnalysis.count()
  const jobCount = await prisma.analysisJob.count()
  
  console.log(JSON.stringify({
    documents: docCount,
    publishedDocuments: publishedDocCount,
    analyses: analysisCount,
    jobs: jobCount
  }))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
