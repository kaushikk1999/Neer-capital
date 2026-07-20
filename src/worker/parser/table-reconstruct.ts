/**
 * Table reconstruction from positioned text.
 *
 * A PDF has no table structure — only glyphs at coordinates. Financial reports
 * put their authoritative numbers in tables, so we rebuild rows and columns
 * geometrically: items sharing a baseline form a row, and x-positions that
 * recur down the page form columns.
 *
 * This is deliberately conservative. A block of text that does not look like a
 * grid is left alone rather than forced into a table, because a wrong cell
 * mapping would attach a number to the wrong period.
 */

import type { ParsedPage, TextItem, TextLine } from "@/worker/parser/layout-parser"
import { toBoundingBox } from "@/worker/parser/layout-parser"
import type { BoundingBox } from "@/lib/report/types"

export interface TableCell {
  row: number
  col: number
  text: string
  bbox: BoundingBox
}

export interface ReconstructedTable {
  pageNumber: number
  /** Column x-centres used to assign cells, left to right. */
  columnAnchors: number[]
  rowCount: number
  colCount: number
  cells: TableCell[]
  bbox: BoundingBox
  /** Fraction of cells that hold a parseable number — higher means more table-like. */
  numericDensity: number
}

/** A row must have at least this many items to be a table row candidate. */
const MIN_ITEMS_PER_ROW = 3
/** A table must span at least this many consecutive rows. */
const MIN_TABLE_ROWS = 3
/** Items whose x-centres are within this many points share a column. */
const COLUMN_TOLERANCE_PT = 12
/** Below this share of numeric cells we do not treat a block as a table. */
const MIN_NUMERIC_DENSITY = 0.25

function isNumericish(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return /^[(\-+]?\s*[₹$€£]?\s*[\d,]+(\.\d+)?\s*[)%x×]?$/i.test(t) || /^\(?[\d,]+(\.\d+)?\)?$/.test(t)
}

function centreX(item: TextItem): number {
  return item.x + item.width / 2
}

/**
 * Clusters x-centres into column anchors. Uses a simple sorted sweep because
 * column positions in a rendered table are highly regular; anything irregular
 * enough to defeat this is not a table we should trust.
 */
function deriveColumnAnchors(rows: TextLine[]): number[] {
  const centres: number[] = []
  for (const row of rows) for (const item of row.items) centres.push(centreX(item))
  centres.sort((a, b) => a - b)

  const anchors: number[] = []
  let bucket: number[] = []
  for (const c of centres) {
    if (bucket.length === 0 || c - bucket[bucket.length - 1] <= COLUMN_TOLERANCE_PT) {
      bucket.push(c)
    } else {
      anchors.push(bucket.reduce((s, v) => s + v, 0) / bucket.length)
      bucket = [c]
    }
  }
  if (bucket.length > 0) anchors.push(bucket.reduce((s, v) => s + v, 0) / bucket.length)
  return anchors
}

function assignColumn(item: TextItem, anchors: number[]): number {
  const c = centreX(item)
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < anchors.length; i++) {
    const d = Math.abs(anchors[i] - c)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/**
 * Finds tabular regions on a page. Returns zero tables for prose pages rather
 * than inventing structure.
 */
export function reconstructTables(page: ParsedPage): ReconstructedTable[] {
  const candidateRows = page.lines.filter((l) => l.items.length >= MIN_ITEMS_PER_ROW)
  if (candidateRows.length < MIN_TABLE_ROWS) return []

  // Group consecutive candidate rows into blocks (a gap breaks the table).
  const blocks: TextLine[][] = []
  let current: TextLine[] = []
  const sorted = [...candidateRows].sort((a, b) => a.y - b.y)

  for (let i = 0; i < sorted.length; i++) {
    if (current.length === 0) {
      current = [sorted[i]]
      continue
    }
    const prev = current[current.length - 1]
    const verticalGap = sorted[i].y - (prev.y + prev.height)
    // Allow roughly one blank line between rows before splitting the block.
    if (verticalGap <= Math.max(prev.height * 1.8, 14)) {
      current.push(sorted[i])
    } else {
      blocks.push(current)
      current = [sorted[i]]
    }
  }
  if (current.length > 0) blocks.push(current)

  const tables: ReconstructedTable[] = []

  for (const block of blocks) {
    if (block.length < MIN_TABLE_ROWS) continue

    const anchors = deriveColumnAnchors(block)
    if (anchors.length < 2) continue

    const cells: TableCell[] = []
    let numericCells = 0

    block.forEach((row, rowIndex) => {
      // Merge items that land in the same column into one cell value.
      const byCol = new Map<number, TextItem[]>()
      for (const item of row.items) {
        const col = assignColumn(item, anchors)
        byCol.set(col, [...(byCol.get(col) ?? []), item])
      }
      for (const [col, items] of byCol) {
        const ordered = items.sort((a, b) => a.x - b.x)
        const text = ordered.map((i) => i.str).join("").trim()
        if (!text) continue
        const x = Math.min(...ordered.map((i) => i.x))
        const y = Math.min(...ordered.map((i) => i.y))
        const right = Math.max(...ordered.map((i) => i.x + i.width))
        const bottom = Math.max(...ordered.map((i) => i.y + i.height))
        if (isNumericish(text)) numericCells++
        cells.push({
          row: rowIndex,
          col,
          text,
          bbox: toBoundingBox(page.pageNumber, { x, y, width: right - x, height: bottom - y }, page.rotation),
        })
      }
    })

    if (cells.length === 0) continue
    const numericDensity = numericCells / cells.length
    if (numericDensity < MIN_NUMERIC_DENSITY) continue

    const x0 = Math.min(...block.map((r) => r.x))
    const y0 = Math.min(...block.map((r) => r.y))
    const x1 = Math.max(...block.map((r) => r.x + r.width))
    const y1 = Math.max(...block.map((r) => r.y + r.height))

    tables.push({
      pageNumber: page.pageNumber,
      columnAnchors: anchors,
      rowCount: block.length,
      colCount: anchors.length,
      cells,
      bbox: toBoundingBox(page.pageNumber, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, page.rotation),
      numericDensity: Math.round(numericDensity * 100) / 100,
    })
  }

  return tables
}

/** Convenience: the cell text laid out as a row-major grid. */
export function toGrid(table: ReconstructedTable): string[][] {
  const grid: string[][] = Array.from({ length: table.rowCount }, () =>
    Array.from({ length: table.colCount }, () => "")
  )
  for (const cell of table.cells) {
    if (grid[cell.row] && cell.col < table.colCount) grid[cell.row][cell.col] = cell.text
  }
  return grid
}

/** Looks up the cell a value came from, so a metric can cite a table cell. */
export function findCell(
  tables: ReconstructedTable[],
  predicate: (text: string) => boolean
): { table: ReconstructedTable; cell: TableCell } | null {
  for (const table of tables) {
    for (const cell of table.cells) {
      if (predicate(cell.text)) return { table, cell }
    }
  }
  return null
}
