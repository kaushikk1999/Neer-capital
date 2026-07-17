import pdfParseImport from "pdf-parse"
// Fallback for CommonJS/ESM interop
const pdfParse = (typeof pdfParseImport === "function") 
  ? pdfParseImport 
  : (pdfParseImport as any).default || pdfParseImport
import { getObject } from "@/lib/storage"

export type PdfClassification =
  | "TEXT_EXTRACTABLE"
  | "OCR_REQUIRED"
  | "CORRUPTED"
  | "UNSUPPORTED"

export interface ExtractedPage {
  pageNumber: number
  text: string
  blocks?: string[] // Optional structured block support if available
}

export interface ExtractionResult {
  classification: PdfClassification
  pages: ExtractedPage[]
  totalTextLength: number
  pageCount: number
}

// Simple heuristic for scanned documents:
// If average text length per page is very low, it's likely a scanned image.
const MIN_TEXT_PER_PAGE_THRESHOLD = 50 

export class PdfExtractor {
  
  /**
   * Downloads the PDF from R2 and extracts text page by page.
   * @param storageKey The opaque storage key in R2
   */
  public async extractFromStorage(storageKey: string): Promise<ExtractionResult> {
    let buffer: Buffer
    try {
      buffer = await getObject(storageKey)
    } catch (error) {
      console.error(`[PdfExtractor] Failed to download ${storageKey}:`, error)
      throw new Error("Failed to retrieve document from storage")
    }

    try {
      return await this.extractFromBuffer(buffer)
    } catch (error) {
      console.error(`[PdfExtractor] Corrupted or unparseable PDF ${storageKey}:`, error)
      return {
        classification: "CORRUPTED",
        pages: [],
        totalTextLength: 0,
        pageCount: 0,
      }
    }
  }

  /**
   * Deterministically parses PDF text using pdf-parse.
   * It extracts page by page by utilizing the custom pagerender callback.
   */
  private async extractFromBuffer(buffer: Buffer): Promise<ExtractionResult> {
    const pages: ExtractedPage[] = []
    
    // pdf-parse allows a custom render callback per page
    function renderPage(pageData: any) {
      const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
      }
      return pageData.getTextContent(renderOptions).then(function(textContent: any) {
        let lastY, text = ''
        for (const item of textContent.items) {
          if (lastY == item.transform[5] || !lastY){
            text += item.str
          } else {
            text += '\n' + item.str
          }
          lastY = item.transform[5]
        }
        
        pages.push({
          pageNumber: pageData.pageIndex + 1, // pageIndex is 0-based
          text: text,
        })
        return text
      })
    }

    const options = {
      pagerender: renderPage,
    }

    let parsed
    try {
      parsed = await pdfParse(buffer, options)
    } catch (error) {
      throw error
    }

    // pdf-parse natively returns parsed.numpages, parsed.text, etc.
    // Our pages array is populated during the pagerender callback.
    
    // Ensure pages are sorted sequentially, as async rendering might finish out of order
    pages.sort((a, b) => a.pageNumber - b.pageNumber)

    let totalTextLength = 0
    pages.forEach(p => totalTextLength += p.text.trim().length)
    
    let classification: PdfClassification = "TEXT_EXTRACTABLE"
    
    // If the PDF parsed successfully but contains almost no text, it is likely a scanned image requiring OCR
    if (parsed.numpages > 0 && totalTextLength / parsed.numpages < MIN_TEXT_PER_PAGE_THRESHOLD) {
      classification = "OCR_REQUIRED"
    }

    return {
      classification,
      pages,
      totalTextLength,
      pageCount: parsed.numpages,
    }
  }
}
