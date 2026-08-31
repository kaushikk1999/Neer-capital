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
async function translateStrings(strings: Record<string, string>, locale: Locale): Promise<Record<string, string>> {
  if (locale === "en") return strings
  const entries = Object.entries(strings).filter(([, v]) => typeof v === "string" && v.trim().length > 0)
  if (entries.length === 0 || !OLLAMA_KEY) return strings

  const language = LANGUAGE_NAME[locale]
  const payload = Object.fromEntries(entries)

  const system = `You are a professional financial translator. Translate the string VALUES of the given JSON object into ${language}.
CRITICAL RULES:
1. Keep the JSON keys EXACTLY as given; return ONE JSON object with the same keys.
2. Translate only natural-language prose. Do NOT alter numbers, percentages, currency symbols/codes, dates, financial units, tickers, or formulas.
3. Keep company names, ticker symbols, and proper nouns in their original form (do not transliterate or invent).
4. Do not add, remove, summarise, or explain. Output JSON only, no prose or code fences.`

  try {
    const res = await ollama.chat({
      model: MODEL,
      format: "json",
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
    })
    const parsed = parseJsonObject(res.message.content)
    if (!parsed) return strings
    // Merge defensively: keep the English original for any key the model dropped
    // or returned as a non-string, so a partial response never blanks a field.
    const out: Record<string, string> = { ...strings }
    for (const [k, v] of entries) {
      const t = parsed[k]
      out[k] = typeof t === "string" && t.trim().length > 0 ? t : v
    }
    return out
  } catch {
    return strings // Fail closed to the canonical English text.
  }
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
    ["report-translation", version.analysisId, String(version.revision), locale, scope],
    { revalidate: false, tags: [`report-translation:${version.analysisId}`] },
  )
  return cached()
}
