import type { DocumentStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/api-auth"

// Shared lifecycle transition — used by publish / unpublish / archive routes.
export async function setDocStatus(
  id: string,
  patch: { status: DocumentStatus; published: boolean },
  event: string,
  userId: string,
) {
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return null
  const updated = await prisma.document.update({ where: { id }, data: patch })
  await audit(event, { userId, documentId: id, details: { status: patch.status, published: patch.published } })
  return updated
}
