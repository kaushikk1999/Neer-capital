import { PrismaClient } from '@prisma/client'

// Use the production Railway database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:PggFLEtPBmwFDLINowidlGovKImlYwHP@hayabusa.proxy.rlwy.net:50331/railway"
    }
  }
})

async function main() {
  // Get all users (only safe fields)
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      accounts: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          userId: true,
        }
      }
    }
  })

  console.log("=== ALL USERS ===")
  for (const u of users) {
    console.log(`\nUser ID: ${u.id}`)
    console.log(`  Email: ${u.email}`)
    console.log(`  Name: ${u.name}`)
    console.log(`  Role: ${u.role}`)
    console.log(`  Created: ${u.createdAt}`)
    console.log(`  Accounts (${u.accounts.length}):`)
    for (const a of u.accounts) {
      console.log(`    - Account ID: ${a.id}, Provider: ${a.provider}, ProviderAccountId: ${a.providerAccountId}, UserId: ${a.userId}`)
    }
  }
}

main().finally(() => prisma.$disconnect())
