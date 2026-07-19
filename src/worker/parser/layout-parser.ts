/**
 * Layout-aware PDF text extraction.
 *
 * Uses pdfjs-dist directly (pinned) rather than a text-only wrapper, because
 * evidence needs coordinates: a reviewer must be able to see the exact region
 * of the page a number came from. pdf-parse remains in the codebase for the V1
 * path only — its pagerender hook is not a stable geometry contract.
 *
 * Coordinates are emitted in *viewport* space: origin top-left, PDF points,
 * with page rotation and CropBox offset already applied by pdf.js. That means
 * a bounding box can be overlaid on a rendered page without further maths.
 *
 * The parser never fetches anything external — no remote fonts, no streamed
 * ranges, no eval.
 */

import { createRequire } from "module"
import { dirname, join } from "path"
import type { BoundingBox } from "@/lib/report/types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TextItem {
  str: string
  /** Viewport-space box, origin top-left, unit "pt". */
  x: number
  y: number
  width: number
  height: number
  /** Font size in viewport units, useful for heading/table heuristics. */
  fontHeight: number
  hasEOL: boolean
}

export interface ParsedPage {
  /** 1-indexed, matching how humans cite pages. */
  pageNumber: number
  width: number
  height: number
  rotation: number
  /** True when the page has no extractable text layer (candidate for OCR). */
  isImageOnly: boolean
  text: string
  items: TextItem[]
  lines: TextLine[]
}

export interface TextLine {
  text: string
  x: number
  y: number
  width: number
  height: number
  items: TextItem[]
}

export interface ParsedDocument {
  pageCount: number
  pages: ParsedPage[]
}

/** Text below this many characters on a page suggests a scanned image. */
const IMAGE_ONLY_CHAR_THRESHOLD = 25

/** Items whose baselines are within this many points belong to one line. */
const LINE_TOLERANCE_PT = 2.5

let pdfjsPromise: Promise<any> | null = null

/**
 * Loads the legacy (Node-compatible) build once. The legacy build runs the
 * parser in-process, which is what we want inside the worker.
 */
async function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod: any) => {
      // pdf.js still requires a workerSrc even when it runs the "fake worker"
      // in-process, so point it at the legacy worker bundle on disk. Resolving
      // from package.json keeps this correct under both tsx and next start.
      if (mod.GlobalWorkerOptions && !mod.GlobalWorkerOptions.workerSrc) {
        const req = createRequire(join(process.cwd(), "package.json"))
        mod.GlobalWorkerOptions.workerSrc = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
      }
      return mod
    })
  }
  return pdfjsPromise
}

function groupIntoLines(items: TextItem[]): TextLine[] {
  if (items.length === 0) return []

  // Sort top-to-bottom, then left-to-right.
  const sorted = [...items].sort((a, b) => (Math.abs(a.y - b.y) <= LINE_TOLERANCE_PT ? a.x - b.x : a.y - b.y))

  const lines: TextLine[] = []
  let current: TextItem[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1]
    const item = sorted[i]
    if (Math.abs(item.y - prev.y) <= LINE_TOLERANCE_PT) {
      current.push(item)
    } else {
      lines.push(makeLine(current))
      current = [item]
    }
  }
  lines.push(makeLine(current))
  return lines
}

function makeLine(items: TextItem[]): TextLine {
  const ordered = [...items].sort((a, b) => a.x - b.x)
  const x = Math.min(...ordered.map((i) => i.x))
  const y = Math.min(...ordered.map((i) => i.y))
  const right = Math.max(...ordered.map((i) => i.x + i.width))
  const bottom = Math.max(...ordered.map((i) => i.y + i.height))
  // Join with a space only when there is a visible gap, so "1,234" is not split.
  let text = ""
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i]
    if (i > 0) {
      const prev = ordered[i - 1]
      const gap = item.x - (prev.x + prev.width)
      if (gap > 0.6) text += " "
    }
    text += item.str
  }
  return { text: text.trim(), x, y, width: right - x, height: bottom - y, items: ordered }
}

export interface ParseOptions {
  /** Hard cap; pages beyond this are not parsed. */
  maxPages?: number
  /** Wall-clock budget for the whole document. */
  timeoutMs?: number
}

/**
 * Parses a PDF into pages with per-item geometry.
 * Throws only on unusable input; page-level failures degrade to an empty page
 * so one bad page cannot lose the whole document.
 */
export async function parsePdfLayout(
  buffer: Buffer,
  options: ParseOptions = {}
): Promise<ParsedDocument> {
  const pdfjs = await loadPdfjs()
  const deadline = options.timeoutMs ? Date.now() + options.timeoutMs : null

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Security: no network, no eval, no system font probing.
    disableAutoFetch: true,
    disableStream: true,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    // Point at the fonts shipped inside pdfjs-dist so metrics resolve locally
    // instead of warning on every page. This is a local directory, not a URL.
    standardFontDataUrl: standardFontsDir(),
    // Password-protected files are rejected earlier by validate-input; if one
    // reaches here, fail rather than prompt.
    password: undefined,
  })

  const doc = await loadingTask.promise
  try {
    const limit = Math.min(doc.numPages, options.maxPages ?? doc.numPages)
    const pages: ParsedPage[] = []

    for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
      if (deadline && Date.now() > deadline) {
        throw new Error(`PDF parsing exceeded its time budget after page ${pageNumber - 1}`)
      }
      pages.push(await parseSinglePage(doc, pageNumber))
    }

    return { pageCount: doc.numPages, pages }
  } finally {
    // Release worker/document resources deterministically.
    await doc.destroy?.()
  }
}

async function parseSinglePage(doc: any, pageNumber: number): Promise<ParsedPage> {
  const page = await doc.getPage(pageNumber)
  try {
    // getViewport applies the CropBox (page.view) and the page's own /Rotate.
    const rotation = typeof page.rotate === "number" ? page.rotate : 0
    const viewport = page.getViewport({ scale: 1, rotation })
    const content = await page.getTextContent({ includeMarkedContent: false })

    const items: TextItem[] = []
    for (const raw of content.items as any[]) {
      if (typeof raw.str !== "string" || raw.str.length === 0) continue

      // Compose the item's text matrix with the viewport transform so the
      // result already accounts for rotation and crop offset.
      const m = pdfjsUtilTransform(viewport.transform, raw.transform)
      const fontHeight = Math.hypot(m[2], m[3])
      const width = typeof raw.width === "number" ? raw.width : 0
      const height = typeof raw.height === "number" && raw.height > 0 ? raw.height : fontHeight

      // m[4], m[5] is the baseline origin in viewport space (top-left origin).
      const x = m[4]
      const y = m[5] - height

      items.push({
        str: raw.str,
        x: round(x),
        y: round(y),
        width: round(width),
        height: round(height),
        fontHeight: round(fontHeight),
        hasEOL: raw.hasEOL === true,
      })
    }

    const lines = groupIntoLines(items)
    const text = lines.map((l) => l.text).join("\n")

    return {
      pageNumber,
      width: round(viewport.width),
      height: round(viewport.height),
      rotation,
      isImageOnly: text.replace(/\s/g, "").length < IMAGE_ONLY_CHAR_THRESHOLD,
      text,
      items,
      lines,
    }
  } catch {
    // A single unreadable page must not fail the document; mark it for OCR.
    const viewport = { width: 0, height: 0 }
    return {
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
      isImageOnly: true,
      text: "",
      items: [],
      lines: [],
    }
  } finally {
    page.cleanup?.()
  }
}

/** Local directory of the standard font metrics bundled with pdfjs-dist. */
function standardFontsDir(): string {
  const req = createRequire(join(process.cwd(), "package.json"))
  // entry = <pkg>/legacy/build/pdf.mjs, so walk up three levels to <pkg>.
  const entry = req.resolve("pdfjs-dist/legacy/build/pdf.mjs")
  const pkgRoot = dirname(dirname(dirname(entry)))
  return join(pkgRoot, "standard_fonts") + "/"
}

/** pdf.js Util.transform, inlined to avoid depending on an internal export. */
function pdfjsUtilTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Builds the persisted evidence bounding box for a text region. */
export function toBoundingBox(
  pageNumber: number,
  box: { x: number; y: number; width: number; height: number },
  rotation = 0
): BoundingBox {
  return {
    page: pageNumber,
    x0: round(box.x),
    y0: round(box.y),
    x1: round(box.x + box.width),
    y1: round(box.y + box.height),
    unit: "pt",
    origin: "top-left",
    rotation,
  }
}
