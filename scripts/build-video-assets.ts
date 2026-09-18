/**
 * Build Remotion inputs (narration + ElevenLabs voiceover + props.json) for a
 * report, from the repo root:
 *
 *   npx tsx scripts/build-video-assets.ts <slug> [locale] [--no-audio]
 *
 * Examples:
 *   npx tsx scripts/build-video-assets.ts balrampur-chini-research-reports ta
 *   npx tsx scripts/build-video-assets.ts balrampur-chini-research-reports en --no-audio
 *
 * Then render:  cd video && npm run render:props   (point it at the printed props file)
 *
 * Env required: DATABASE_URL, OLLAMA_API_KEY (script), ELEVENLABS_API_KEY (+ optional
 * ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL_ID) for audio.
 */
import { readFileSync } from "fs"
import { buildVideoAssets, buildVideoAssetsFromData, SAMPLE_REPORT_DATA } from "@/lib/video/assets"
import type { Locale } from "@/lib/i18n/types"

// tsx does not auto-load .env files. Load .env then .env.local (local overrides)
// so DATABASE_URL / OLLAMA_* / ELEVENLABS_* are available exactly as documented.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    /* file may not exist */
  }
}

async function main() {
  const sample = process.argv.includes("--sample")
  const positionals = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  const withAudio = !process.argv.includes("--no-audio")

  // --sample: skip the DB entirely and use the built-in report. Slug is
  // optional in that mode. Otherwise the first positional is the report slug.
  const slug = sample ? "sample" : positionals[0]
  const localeArg = sample ? positionals[0] : positionals[1]
  if (!slug) {
    console.error("Usage: tsx scripts/build-video-assets.ts <slug> [en|hi|ta] [--no-audio]")
    console.error("   or: tsx scripts/build-video-assets.ts --sample [en|hi|ta] [--no-audio]")
    process.exit(1)
  }
  const locale: Locale = localeArg === "hi" || localeArg === "ta" ? localeArg : "en"

  console.log(`Building video assets for "${slug}" (${locale})${withAudio ? "" : " [no audio]"}${sample ? " [sample, no DB]" : ""}…`)
  const { propsPath, audioPath } = sample
    ? await buildVideoAssetsFromData(SAMPLE_REPORT_DATA, { locale, withAudio })
    : await buildVideoAssets({ slug, locale, withAudio })
  console.log(`✓ props: ${propsPath}`)
  if (audioPath) console.log(`✓ audio: ${audioPath}`)
  console.log(`Render with:\n  cd video && npx remotion render src/index.ts ReportVideo out/${slug}-${locale}.mp4 --props="${propsPath}"`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
