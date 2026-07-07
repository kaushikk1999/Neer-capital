import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — survives Next.js dev hot-reload without exhausting
// MySQL connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
