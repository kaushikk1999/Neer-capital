import { promises as fs } from "fs"
import path from "path"

// File storage abstraction. Default = local filesystem under STORAGE_DIR (mount
// a Railway volume there in production). The interface is intentionally minimal
// so it can be swapped for S3/R2/GCS without touching callers.
const ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), ".storage")

function resolveKey(key: string): string {
  // Keys are server-generated; still guard against path traversal.
  const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "")
  return path.join(ROOT, safe)
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, data)
}

export async function getObject(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key))
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key))
  } catch {
    // Already gone — deletion is idempotent.
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveKey(key))
    return true
  } catch {
    return false
  }
}
