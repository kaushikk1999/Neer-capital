/**
 * Pre-parser input validation.
 *
 * Runs before any PDF library touches the bytes. An uploaded file is hostile
 * until proven otherwise: it may be mislabelled, encrypted, corrupt, enormous,
 * or crafted to exhaust memory. Everything here is cheap buffer inspection —
 * no parsing, no rendering, no network.
 */

import { createHash } from "crypto"

export type InputRejectionCode =
  | "BAD_EXTENSION"
  | "BAD_MIME"
  | "BAD_SIGNATURE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "ENCRYPTED_PDF"
  | "MALFORMED_PDF"
  | "TOO_MANY_PAGES"
  | "MALWARE_SUSPECTED"

export interface InputLimits {
  maxBytes: number
  /** Cheap pre-check; the authoritative page count comes from the parser. */
  maxPages: number
}

export const DEFAULT_INPUT_LIMITS: InputLimits = {
  maxBytes: 50 * 1024 * 1024, // 50 MB
  maxPages: 500,
}

export interface ValidationOk {
  ok: true
  docHash: string
  byteLength: number
  /** Heuristic page count from object scanning; refined later by the parser. */
  estimatedPages: number
  pdfVersion: string | null
}

export interface ValidationRejected {
  ok: false
  code: InputRejectionCode
  /** Safe for logs and admin display — never contains document content. */
  message: string
  /** Rejected files are quarantined rather than deleted, for later inspection. */
  quarantine: boolean
}

export type ValidationResult = ValidationOk | ValidationRejected

/** Optional integration point for a scanner; the default is a no-op allow. */
export type MalwareScanHook = (buffer: Buffer) => Promise<{ clean: boolean; detail?: string }>

const ALLOW_ALL: MalwareScanHook = async () => ({ clean: true })

const PDF_MAGIC = Buffer.from("%PDF-", "ascii")
const ACCEPTED_MIME = new Set(["application/pdf", "application/x-pdf", "application/octet-stream"])

function reject(
  code: InputRejectionCode,
  message: string,
  quarantine = true
): ValidationRejected {
  return { ok: false, code, message, quarantine }
}

/**
 * Detects an encryption dictionary. A password-protected PDF is rejected —
 * never brute-forced, and never silently parsed into empty text.
 */
function looksEncrypted(buffer: Buffer): boolean {
  // /Encrypt only counts inside a trailer/xref context; scanning the tail
  // avoids false hits on the literal bytes appearing inside a content stream.
  const tail = buffer.subarray(Math.max(0, buffer.length - 8192)).toString("latin1")
  if (/\/Encrypt\b/.test(tail)) return true
  // Some producers place the trailer earlier; check the whole file for the
  // trailer keyword paired with /Encrypt.
  const whole = buffer.toString("latin1")
  const trailerIdx = whole.lastIndexOf("trailer")
  if (trailerIdx >= 0 && /\/Encrypt\b/.test(whole.slice(trailerIdx))) return true
  return false
}

function estimatePageCount(buffer: Buffer): number {
  const text = buffer.toString("latin1")
  // Prefer the declared count on the page tree root.
  const counts = [...text.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g)].map((m) =>
    parseInt(m[1], 10)
  )
  if (counts.length > 0) return Math.max(...counts.filter(Number.isFinite))
  // Fall back to counting page objects.
  return (text.match(/\/Type\s*\/Page\b/g) ?? []).length
}

function readPdfVersion(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 16).toString("latin1")
  const m = head.match(/%PDF-(\d+\.\d+)/)
  return m ? m[1] : null
}

function hasEOFMarker(buffer: Buffer): boolean {
  // %%EOF is normally at the very end, but trailing whitespace/garbage is common.
  const tail = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1")
  return tail.includes("%%EOF")
}

export interface ValidateInputArgs {
  buffer: Buffer
  fileName: string
  declaredMimeType?: string | null
  limits?: Partial<InputLimits>
  malwareScan?: MalwareScanHook
}

/**
 * Validates an uploaded PDF. Returns a typed rejection rather than throwing,
 * so the caller can quarantine the object and record a sanitized error.
 */
export async function validatePdfInput(args: ValidateInputArgs): Promise<ValidationResult> {
  const limits = { ...DEFAULT_INPUT_LIMITS, ...(args.limits ?? {}) }
  const { buffer, fileName } = args

  if (!buffer || buffer.length === 0) {
    return reject("EMPTY_FILE", "The uploaded file is empty.", false)
  }

  if (buffer.length > limits.maxBytes) {
    return reject(
      "FILE_TOO_LARGE",
      `File is ${Math.round(buffer.length / 1024 / 1024)} MB, above the ${Math.round(
        limits.maxBytes / 1024 / 1024
      )} MB limit.`,
      false
    )
  }

  if (!/\.pdf$/i.test(fileName.trim())) {
    return reject("BAD_EXTENSION", "Only .pdf files are accepted.", false)
  }

  const mime = (args.declaredMimeType ?? "").toLowerCase().split(";")[0].trim()
  if (mime && !ACCEPTED_MIME.has(mime)) {
    return reject("BAD_MIME", `Declared content type "${mime}" is not a PDF.`, false)
  }

  // The signature is authoritative: a .pdf name and PDF MIME mean nothing if
  // the bytes are not a PDF.
  if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return reject("BAD_SIGNATURE", "File content is not a PDF (missing %PDF- signature).")
  }

  if (looksEncrypted(buffer)) {
    return reject(
      "ENCRYPTED_PDF",
      "The PDF is password-protected or encrypted and cannot be analysed."
    )
  }

  if (!hasEOFMarker(buffer)) {
    return reject("MALFORMED_PDF", "The PDF is truncated or malformed (no %%EOF marker).")
  }

  const estimatedPages = estimatePageCount(buffer)
  if (estimatedPages > limits.maxPages) {
    return reject(
      "TOO_MANY_PAGES",
      `Document appears to have ${estimatedPages} pages, above the ${limits.maxPages}-page limit.`,
      false
    )
  }

  const scan = await (args.malwareScan ?? ALLOW_ALL)(buffer)
  if (!scan.clean) {
    return reject("MALWARE_SUSPECTED", "The file was flagged by the malware scanner.")
  }

  return {
    ok: true,
    docHash: createHash("sha256").update(buffer).digest("hex"),
    byteLength: buffer.length,
    estimatedPages,
    pdfVersion: readPdfVersion(buffer),
  }
}

/** Storage key for a quarantined upload, kept beside the original prefix. */
export function quarantineKey(originalKey: string): string {
  return `quarantine/${originalKey}`
}
