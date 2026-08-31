import { unstable_cache } from "next/cache"
import { Ollama } from "ollama"
import type { Locale } from "@/lib/i18n/types"

/**
 * Read-time localisation of AI-generated report prose.
 *
 * Why this exists: reports are generated ONCE by the worker from an English
 * source PDF and persisted as the canonical English analysis. Opening a report
 * never re-runs generation, so the language selector cannot make the stored
 * prose Tamil/Hindi on its own. Rather than storing per-locale variants (a
 * schema change) or regenerating per view (no trigger, minutes of latency),
 * we translate the natural-language fields at render time, reusing the SAME
 * Ollama client/model the pipeline already uses — no new provider or secret.
 *
 * Guarantees:
 *  - English is the canonical stored text and is served verbatim (no model call).
 *  - Only natural-language strings are translated; numbers, tickers, currencies,
 *    dates and units are preserved by instruction and never fabricated.
 *  - Any failure falls back to the English canonical text — a report always renders.
 *  - Results are memoised via Next.js's own data cache, keyed by analysis
 *    revision + locale, so only the first view of a report version per language
 *    pays the model round-trip.
 */

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_API_URL || "https://api.ollama.com"
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || ""
const MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud"

const ollama = new Ollama({
  host: OLLAMA_URL,
  fetch: (input, init) =>
    fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${OLLAMA_KEY}` } }),
})

const LANGUAGE_NAME: Record<Exclude<Locale, "en">, string> = {
  hi: "Hindi",
  ta: "Tamil",
}

/**
 * Parse a JSON object from a model reply, tolerating ```json code fences and
 * surrounding prose (gemma returns fenced JSON even when asked for raw JSON).
 * Returns null if no JSON object can be recovered.
 */
function parseJsonObject(content: string): Record<string, unknown> | null {
  const start = content.indexOf("{")
  const end = content.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    const v = JSON.parse(content.slice(start, end + 1))
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Translate a flat map of label→English string into `locale`, preserving keys.
 * Returns the input unchanged for English, on empty input, or on any failure.
 */
const TRANSLATE_TIMEOUT_MS = 30_000
// Small batches: one big call can non-deterministically drop a subset of fields
// (a frozen partial). Chunking bounds each call so a hiccup loses at most one
// batch (which falls back to English), never scattered fields across the report.
const TRANSLATE_BATCH = 8

// Bump when the translation logic/prompt changes so previously cached results
// (which may have been produced by older, less reliable logic) are invalidated.
const TRANSLATOR_VERSION = "4"

// A value the model legitimately keeps as-is: pure acronym / ticker / numeric /
// symbol token (e.g. "EBITDA", "EPS", "GRSE"). Such a field being unchanged is
// correct, so it must NOT trigger a retry. Anything with a lowercase letter is
// treated as prose that should have been translated.
const looksTranslatable = (v: string): boolean => /[a-z]/.test(v)

/** Translate one batch of [key, englishValue] pairs; returns key→translated.
 *  Any failure/omission leaves that key's English original in place. */
async function translateBatch(batch: [string, string][], language: string): Promise<Record<string, string>> {
  // Opaque numeric ids: the real field keys are long compound ids
  // (e.g. "section.<cuid>.content") the model tends to mangle or drop; "0","1",…
  // survive intact and we map back by position.
  const payload: Record<string, string> = {}
  batch.forEach(([, v], i) => { payload[String(i)] = v })

  const system = `You are a professional financial translator. The user sends a JSON object whose values are English UI text and prose from an equity research report. Translate EVERY value into ${language}, INCLUDING short field labels such as "Market Cap", "Book Value", "Operating Income", "Profit After Tax".
CRITICAL RULES:
1. Return ONE JSON object with the EXACT same keys ("0", "1", …). Include every key.
2. Keep unchanged ONLY: numbers, percentages, currency symbols/codes, dates, financial units, formulas, pure acronyms (e.g. EBITDA, EPS, CAGR, PAT), ticker symbols, and company/product proper names.
3. Do not add, remove, summarise, or explain. Output JSON only, no prose or code fences.`

  const out: Record<string, string> = {}
  batch.forEach(([k, v]) => { out[k] = v }) // default to English
  try {
    const res = await Promise.race([
      ollama.chat({
        model: MODEL,
        format: "json",
        stream: false,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("translate timeout")), TRANSLATE_TIMEOUT_MS)),
    ])
    const parsed = parseJsonObject(res.message.content)
    if (!parsed) return out
    batch.forEach(([k, v], i) => {
      const t = parsed[String(i)]
      out[k] = typeof t === "string" && t.trim().length > 0 ? t : v
    })
  } catch {
    /* keep English defaults */
  }
  return out
}

async function translateStrings(strings: Record<string, string>, locale: Locale): Promise<Record<string, string>> {
  if (locale === "en") return strings
  const entries = Object.entries(strings).filter(([, v]) => typeof v === "string" && v.trim().length > 0)
  if (entries.length === 0 || !OLLAMA_KEY) return strings

  const language = LANGUAGE_NAME[locale]
  const batches: [string, string][][] = []
  for (let i = 0; i < entries.length; i += TRANSLATE_BATCH) batches.push(entries.slice(i, i + TRANSLATE_BATCH))

  const merged: Record<string, string> = Object.assign({ ...strings }, ...(await Promise.all(batches.map((b) => translateBatch(b, language)))))

  // One retry pass for prose fields still equal to their English original — a
  // batch may non-deterministically skip a few. Pure acronyms/tickers are left
  // alone (looksTranslatable is false), so this never loops on those.
  const missed = entries.filter(([k, v]) => merged[k] === v && looksTranslatable(v))
  if (missed.length > 0) {
    const retry: [string, string][][] = []
    for (let i = 0; i < missed.length; i += TRANSLATE_BATCH) retry.push(missed.slice(i, i + TRANSLATE_BATCH))
    Object.assign(merged, ...(await Promise.all(retry.map((b) => translateBatch(b, language)))))
  }
  return merged
}

/** Cache key ingredients that change whenever the underlying prose changes. */
export interface TranslateVersion {
  analysisId: string
  revision: number
}

/**
 * Localise a report's natural-language fields. Cached per (analysis revision,
 * locale) via the framework data cache; English bypasses translation entirely.
 */
export function localizeReportStrings(
  strings: Record<string, string>,
  locale: Locale,
  version: TranslateVersion,
  // Distinguishes different string sets for the same analysis (e.g. the full
  // report page vs a compact index card) so their caches never collide.
  scope: string = "full",
): Promise<Record<string, string>> {
  if (locale === "en") return Promise.resolve(strings)
  const cached = unstable_cache(
    () => translateStrings(strings, locale),
    ["report-translation", TRANSLATOR_VERSION, version.analysisId, String(version.revision), locale, scope],
    { revalidate: false, tags: [`report-translation:${version.analysisId}`] },
  )
  return cached()
}
