import type { Locale } from "@/lib/i18n/types"

export type SceneKey = "intro" | "metrics" | "chart" | "risk" | "outro"

export interface ScriptSegment {
  scene: SceneKey
  /** Spoken narration for this scene, in the target language. */
  text: string
}

export interface VideoScript {
  segments: ScriptSegment[]
  /** One-line closing takeaway shown on the outro. */
  takeaway: string
}

/** Minimal report shape the script generator needs. */
export interface VideoReportInput {
  companyTitle: string
  summary: string | null
  metrics: { label: string; value: string }[]
  risk: { title: string; text: string } | null
  locale: Locale
}

/** Character-level alignment returned by ElevenLabs "with-timestamps". */
export interface Alignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}
