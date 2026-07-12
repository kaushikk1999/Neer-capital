import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Initial administrators — role is stored in the DB, never hardcoded in checks.
const ADMIN_EMAILS = [
  "kaushikds1999@gmail.com",
  "comms.neercapital@gmail.com",
]

// Sample documents so admins can exercise publish/unpublish before uploads exist.
// Idempotent by slug; no files attached (upload lands in a later milestone).
const SAMPLE_DOCS = [
  { slug: "welcome-to-neer", title: "Welcome to Neer", storageKey: "seed/welcome-to-neer", fileName: "welcome.pdf" },
  { slug: "market-outlook-sample", title: "Market Outlook (Sample)", storageKey: "seed/market-outlook", fileName: "outlook.pdf" },
]

async function main() {
  for (const email of ADMIN_EMAILS) {
    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: { email, name: email.split("@")[0], role: "ADMIN" },
    })
    console.log(`seeded ADMIN: ${email}`)
  }
  for (const d of SAMPLE_DOCS) {
    await prisma.document.upsert({
      where: { slug: d.slug },
      update: {},
      create: { ...d, status: "DRAFT", published: false },
    })
    console.log(`seeded document: ${d.slug}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
