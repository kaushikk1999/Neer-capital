import crypto from "crypto"
import { prisma } from "@/lib/db"

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
export const ALLOWED_MIME = "application/pdf"

// Validate a PDF by BOTH declared mime and magic bytes (never trust the client).
export function validatePdf(file: { type: string; size: number }, head: Buffer): string | null {
  if (file.size <= 0) return "The file is empty."
  if (file.size > MAX_FILE_SIZE) return `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`
  if (file.type !== ALLOWED_MIME) return "Only PDF files are allowed."
  if (head.subarray(0, 5).toString("latin1") !== "%PDF-") return "The file is not a valid PDF."
  return null
}

// Strip path and unsafe characters — used only for display, never for storage.
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "document.pdf"
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "document.pdf"
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  )
}

// Server-generated, opaque storage key — client filename is never used as a key.
export function generateStorageKey(documentId?: string): string {
  const docId = documentId || crypto.randomUUID()
  return `documents/${docId}/${crypto.randomUUID()}.pdf`
}

export function checksum(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

// Ensure slug uniqueness by suffixing -2, -3, … when needed.
export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title)
  let slug = base
  let n = 1
  while (await prisma.document.findUnique({ where: { slug } })) {
    n += 1
    slug = `${base}-${n}`
  }
  return slug
}
