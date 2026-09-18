import type { Alignment, ScriptSegment, SceneKey } from "./types"

const API = "https://api.elevenlabs.io/v1"
// A default ElevenLabs voice ("Rachel"); override per brand via env.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"

// Financial abbreviations expanded to their spoken full form so the TTS voice
// pronounces them correctly (e.g. "EPS" -> "earnings per share", "FY25" ->
// "financial year 2025"). Applies to the spoken narration only — the on-screen
// text and website keep the short forms. Order matters: FY/quarter patterns run
// before plain acronyms. Acronym rules are case-sensitive (uppercase) to avoid
// mangling ordinary words.
const FY_RULES: [RegExp, string][] = [
  [/\bQ([1-4])\s?FY\s?(\d{4})\b/gi, "quarter $1 of financial year $2"],
  [/\bQ([1-4])\s?FY\s?(\d{2})\b/gi, "quarter $1 of financial year 20$2"],
  [/\bFY\s?(\d{4})(?:[-/]\d{2,4})?\b/gi, "financial year $1"],
  [/\bFY\s?(\d{2})(?:[-/]\d{2})?\b/gi, "financial year 20$1"],
]
const ACRONYM_RULES: [RegExp, string][] = [
  [/\bEPS\b/g, "earnings per share"],
  [/\bPAT\b/g, "profit after tax"],
  [/\bPBT\b/g, "profit before tax"],
  [/\bCMP\b/g, "current market price"],
  [/\bYoY\b/gi, "year on year"],
  [/\bQoQ\b/gi, "quarter on quarter"],
  [/\bROE\b/g, "return on equity"],
  [/\bROCE\b/g, "return on capital employed"],
  [/\bROA\b/g, "return on assets"],
  [/\bNIM\b/g, "net interest margin"],
  [/\bCASA\b/g, "current and savings account"],
  [/\bEV\b/g, "enterprise value"],
  [/\bP\/?E\b/g, "price to earnings"],
  [/\bYTD\b/g, "year to date"],
  [/\bbps\b/g, "basis points"],
  [/\bCr\b/g, "crore"],
  [/\bRs\.?\b/g, "rupees"],
  [/\bLakhs?\b/gi, "lakh"],
]

/** Expand financial abbreviations so ElevenLabs pronounces them correctly. */
export function normalizeForSpeech(text: string): string {
  let out = text
  for (const [re, to] of FY_RULES) out = out.replace(re, to)
  for (const [re, to] of ACRONYM_RULES) out = out.replace(re, to)
  return out
}

export interface TtsResult {
  /** MP3 bytes of the full narration. */
  audio: Buffer
  /** Character-level timing, or null if the API didn't return it. */
  alignment: Alignment | null
  /** Total spoken length in seconds. */
  durationSeconds: number
  /** End time (seconds) of each scene's narration within the full clip. */
  sceneEndSeconds: Record<SceneKey, number>
  /** The joined narration text that was spoken. */
  text: string
}

/** Join scene lines into one narration, tracking where each scene ends (by
 *  character offset) so we can later map scene boundaries to audio time. */
function joinSegments(segments: ScriptSegment[]): { text: string; endOffset: Record<SceneKey, number> } {
  let text = ""
  const endOffset = {} as Record<SceneKey, number>
  segments.forEach((seg, i) => {
    text += seg.text
    if (i < segments.length - 1 && !/[.!?]$/.test(seg.text.trim())) text += "."
    if (i < segments.length - 1) text += " "
    endOffset[seg.scene] = text.length
  })
  return { text: text.trimEnd(), endOffset }
}

/** Time (seconds) at a character offset, from the alignment end-times. */
function timeAtOffset(alignment: Alignment | null, offset: number, fallback: number): number {
  if (!alignment || alignment.character_end_times_seconds.length === 0) return fallback
  const idx = Math.min(Math.max(offset - 1, 0), alignment.character_end_times_seconds.length - 1)
  return alignment.character_end_times_seconds[idx]
}

/**
 * Synthesize a full narration from the per-scene script via ElevenLabs
 * "with-timestamps", returning the MP3 plus each scene's end time so the video
 * can size its scenes to the spoken audio. Throws if the API key is missing or
 * the request fails (the caller decides whether to proceed without audio).
 */
export async function synthesizeNarration(
  segments: ScriptSegment[],
  opts: { voiceId?: string; modelId?: string } = {},
): Promise<TtsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set")

  const voiceId = opts.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE
  const modelId = opts.modelId || process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2"
  // Expand financial abbreviations in the spoken text (per segment, so the
  // scene-boundary offsets stay aligned to what is actually spoken).
  const spoken = segments.map((s) => ({ ...s, text: normalizeForSpeech(s.text) }))
  const { text, endOffset } = joinSegments(spoken)

  const res = await fetch(`${API}/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as { audio_base64: string; alignment: Alignment | null }
  const audio = Buffer.from(json.audio_base64, "base64")
  const alignment = json.alignment ?? null
  const durationSeconds =
    alignment && alignment.character_end_times_seconds.length
      ? alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1]
      : Math.max(4, text.length / 14) // ~14 chars/sec rough fallback

  // Map each scene's end char-offset to a time; ensure monotonic increase.
  const sceneEndSeconds = {} as Record<SceneKey, number>
  let prev = 0
  for (const seg of segments) {
    const t = timeAtOffset(alignment, endOffset[seg.scene], durationSeconds)
    sceneEndSeconds[seg.scene] = Math.max(prev + 0.8, t)
    prev = sceneEndSeconds[seg.scene]
  }

  return { audio, alignment, durationSeconds, sceneEndSeconds, text }
}
