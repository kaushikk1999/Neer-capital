import { Ollama } from "ollama"
import type { Locale } from "@/lib/i18n/types"
import type { ScriptSegment, VideoReportInput, VideoScript, SceneKey } from "./types"

// Reuses the same Ollama cloud endpoint/model the analysis pipeline uses — no
// new provider or secret.
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_API_URL || "https://api.ollama.com"
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || ""
const MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud"

const ollama = new Ollama({
  host: OLLAMA_URL,
  fetch: (input, init) =>
    fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${OLLAMA_KEY}` } }),
})

const LANGUAGE_NAME: Record<Locale, string> = { en: "English", hi: "Hindi", ta: "Tamil" }
const SCENE_ORDER: SceneKey[] = ["intro", "metrics", "chart", "risk", "outro"]

function parseJsonObject(content: string): Record<string, unknown> | null {
  const s = content.indexOf("{")
  const e = content.lastIndexOf("}")
  if (s === -1 || e <= s) return null
  try {
    const v = JSON.parse(content.slice(s, e + 1))
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Deterministic fallback script from the report data, so a video can always be
 *  produced even if the model call fails. Numbers come straight from the data. */
function templateScript(input: VideoReportInput): VideoScript {
  const m = input.metrics
  const metricLine = m.length
    ? m.slice(0, 3).map((x) => `${x.label}: ${x.value}`).join(", ")
    : "the key numbers"
  return {
    segments: [
      { scene: "intro", text: `${input.companyTitle} — here's what the numbers say.` },
      { scene: "metrics", text: `Here's what stands out — ${metricLine}.` },
      { scene: "chart", text: `And the trend? Take a look at where it's heading.` },
      { scene: "risk", text: input.risk ? `One risk to watch: ${input.risk.title}.` : `Every call carries risk.` },
      { scene: "outro", text: `That's the story in under a minute. More at Neer Capital.` },
    ],
    takeaway: (input.summary || input.companyTitle).split(/[.\n]/)[0].slice(0, 90),
  }
}

/**
 * Write a short, punchy narration (one line per scene) from the report data,
 * in the target language, for a young retail audience. Numbers/tickers must not
 * be invented — the model only phrases the data it is given. Falls back to a
 * deterministic template on any failure.
 */
export async function generateVideoScript(input: VideoReportInput): Promise<VideoScript> {
  if (!OLLAMA_KEY) return templateScript(input)

  const language = LANGUAGE_NAME[input.locale] ?? "English"
  const facts = {
    company: input.companyTitle,
    summary: input.summary ?? "",
    metrics: input.metrics.slice(0, 3),
    risk: input.risk,
  }
  const system = `You write short, energetic voiceover scripts for vertical finance videos aimed at a young retail audience (think Reels/Shorts). Tone: confident, plain-spoken, a little punchy — NOT hype, NOT clickbait.
This is analysis ONLY, never advice. Do NOT tell viewers to buy, sell, hold, accumulate or exit, and do NOT state or imply a recommendation, rating or price target. Describe the business and the numbers; let viewers draw their own conclusion.
Return ONE JSON object:
{"segments":[{"scene":"intro","text":"..."},{"scene":"metrics","text":"..."},{"scene":"chart","text":"..."},{"scene":"risk","text":"..."},{"scene":"outro","text":"..."}],"takeaway":"..."}
RULES:
1. Exactly these five scenes in this order. Each "text" is ONE spoken sentence, ~12-22 words.
2. Write everything in ${language}. Keep company names, tickers and currency figures exactly as given (do not translate or invent numbers).
3. "takeaway" is a single ${language} line, <= 90 characters, and must NOT contain a buy/sell/hold call or recommendation.
4. Output JSON only — no code fences, no commentary.`

  try {
    const res = await ollama.chat({
      model: MODEL,
      format: "json",
      stream: false,
      options: { temperature: 0.6 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(facts) },
      ],
    })
    const parsed = parseJsonObject(res.message.content)
    const rawSegments = parsed?.segments
    if (!Array.isArray(rawSegments)) return templateScript(input)

    // Keep only well-formed segments, in canonical scene order.
    const byScene = new Map<SceneKey, string>()
    for (const seg of rawSegments) {
      const scene = (seg as ScriptSegment)?.scene
      const text = (seg as ScriptSegment)?.text
      if (SCENE_ORDER.includes(scene) && typeof text === "string" && text.trim()) {
        byScene.set(scene, text.trim())
      }
    }
    const fallback = templateScript(input)
    const segments: ScriptSegment[] = SCENE_ORDER.map((scene) => ({
      scene,
      text: byScene.get(scene) ?? fallback.segments.find((s) => s.scene === scene)!.text,
    }))
    const takeaway =
      typeof parsed?.takeaway === "string" && parsed.takeaway.trim()
        ? (parsed.takeaway as string).trim().slice(0, 90)
        : fallback.takeaway
    return { segments, takeaway }
  } catch {
    return templateScript(input)
  }
}
