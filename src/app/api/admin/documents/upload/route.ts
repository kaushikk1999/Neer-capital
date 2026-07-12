import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAdmin, audit } from "@/lib/api-auth"
import { putObject } from "@/lib/storage"
import {
  validatePdf, sanitizeFilename, generateStorageKey, checksum, uniqueSlug, MAX_FILE_SIZE,
} from "@/lib/documents"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const guard = await requireApiAdmin()
  if ("error" in guard) return guard.error
  const { session } = guard

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: "Invalid upload." }, { status: 400 }) }

  const file = form.get("file")
  const titleRaw = String(form.get("title") ?? "").trim()
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File is too large." }, { status: 413 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const err = validatePdf({ type: file.type, size: file.size }, buffer)
  if (err) return NextResponse.json({ error: err }, { status: 422 })

  const displayName = sanitizeFilename(file.name)
  const title = titleRaw || displayName.replace(/\.pdf$/i, "")
  const slug = await uniqueSlug(title)
  const storageKey = generateStorageKey()

  try {
    await putObject(storageKey, buffer)
  } catch {
    return NextResponse.json({ error: "Failed to store the file." }, { status: 500 })
  }

  try {
    const document = await prisma.document.create({
      data: {
        title,
        slug,
        fileName: displayName,
        fileSize: file.size,
        mimeType: "application/pdf",
        storageKey,
        status: "DRAFT",
        published: false,
        uploadedById: session.user.id,
        files: {
          create: {
            storageKey,
            filename: displayName,
            mimeType: "application/pdf",
            size: file.size,
            checksum: checksum(buffer),
          },
        },
      },
      include: { files: true },
    })
    await prisma.documentVersion.create({
      data: { documentId: document.id, version: 1, fileId: document.files[0].id },
    })
    await audit("document.uploaded", { userId: session.user.id, documentId: document.id, details: { title, size: file.size } })
    return NextResponse.json({ ok: true, id: document.id, slug: document.slug })
  } catch {
    return NextResponse.json({ error: "Failed to save document metadata." }, { status: 500 })
  }
}
