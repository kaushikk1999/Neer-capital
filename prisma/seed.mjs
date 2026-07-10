import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Initial administrators — role is stored in the DB, never hardcoded in checks.
const ADMIN_EMAILS = [
  "kaushikds1999@gmail.com",
  "comms.neercapital@gmail.com",
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
