import { promises as fs } from "fs"
import path from "path"
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"

const PROVIDER = process.env.STORAGE_PROVIDER || "local"
const ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), ".storage")

// R2 Config
const s3Client = PROVIDER === "r2" ? new S3Client({
  region: process.env.STORAGE_REGION || "auto",
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
  },
}) : null

const BUCKET = process.env.STORAGE_BUCKET || ""

function resolveKey(key: string): string {
  // Keys are server-generated; still guard against path traversal.
  const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "")
  return path.join(ROOT, safe)
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  if (PROVIDER === "r2" && s3Client) {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
    }))
    return
  }

  const full = resolveKey(key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, data)
}

export async function getObject(key: string): Promise<Buffer> {
  if (PROVIDER === "r2" && s3Client) {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }))
    if (!response.Body) throw new Error("No body returned from R2")
    const bytes = await response.Body.transformToByteArray()
    return Buffer.from(bytes)
  }

  return fs.readFile(resolveKey(key))
}

export async function deleteObject(key: string): Promise<void> {
  if (PROVIDER === "r2" && s3Client) {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }))
    } catch {
      // idempotent
    }
    return
  }

  try {
    await fs.unlink(resolveKey(key))
  } catch {
    // Already gone — deletion is idempotent.
  }
}

export async function objectExists(key: string): Promise<boolean> {
  if (PROVIDER === "r2" && s3Client) {
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }))
      return true
    } catch {
      return false
    }
  }

  try {
    await fs.access(resolveKey(key))
    return true
  } catch {
    return false
  }
}
