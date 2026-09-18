import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/db"
import type { Locale } from "@/lib/i18n/types"
import { localizeReportStrings } from "@/lib/report/translate"
import { buildReportStrings, parseRisks } from "@/lib/report/report-fields"
import { generateVideoScript } from "./script"
import { synthesizeNarration } from "./tts"
import type { SceneKey } from "./types"

const FPS = 30
const MIN_SCENE_FRAMES = 48 // ~1.6s floor per scene
const SCENE_ORDER: SceneKey[] = ["intro", "metrics", "chart", "risk", "outro"]

type ChartPoint = { label: string; value: number }

/** The report data a video needs, already localized. Produced from the DB or,
 *  for --sample, from a built-in constant so the pipeline runs with no DB. */
export interface VideoReportData {
  slug: string
  companyTitle: string
  recommendation: string
  summary: string | null
  metrics: { label: string; value: string }[]
  chart: { title: string; points: ChartPoint[] }
  risk: { title: string; text: string } | null
}

/** Built-in sample so `--sample` renders a real MP4 without any DB access. */
export const SAMPLE_REPORT_DATA: VideoReportData = {
  slug: "sample",
  companyTitle: "Balrampur Chini",
  recommendation: "BUY",
  summary: "A turnaround story betting big on ethanol, with a cleaned-up balance sheet.",
  metrics: [
    { label: "Market Cap", value: "11,977 Rs Cr" },
    { label: "Operating Income", value: "1,604 Rs Cr" },
    { label: "EBITDA", value: "285 Rs Cr" },
  ],
  chart: {
    title: "Revenue trend (Rs in Cr)",
    points: [
      { label: "FY22", value: 4826 },
      { label: "FY23", value: 5602 },
      { label: "FY24", value: 5411 },
      { label: "FY25", value: 6280 },
      { label: "FY26", value: 6890 },
      { label: "FY27", value: 8010 },
      { label: "FY28", value: 8882 },
    ],
  },
  risk: { title: "Volatility in sugar prices", text: "Cyclical sugar prices and cane costs can compress margins." },
}

function firstChartPoints(configV2: unknown): ChartPoint[] | null {
  const cfg = configV2 as { points?: { periodLabel?: string; value?: number | null }[] } | null | undefined
  if (!cfg?.points?.length) return null
  const points = cfg.points
    .filter((p) => typeof p.value === "number" && Number.isFinite(p.value))
    .map((p) => ({ label: String(p.periodLabel ?? ""), value: p.value as number }))
  return points.length >= 2 ? points : null
}

function matchRecommendation(summary: string | null): string | null {
  if (!summary) return null
  const m = summary.match(/recommendation[:\s]+([A-Za-z ]+)/i)
  return m ? m[1].trim().split(/\s/)[0] : null
}

/**
 * Core: turn already-assembled (localized) report data into Remotion inputs —
 * generate the narration, optionally synthesize the voiceover, and write
 * `video/public/<mp3>` + `video/props.<slug>.<locale>.json`.
 */
export async function buildVideoAssetsFromData(
  data: VideoReportData,
  opts: { locale: Locale; withAudio?: boolean; videoDir?: string },
): Promise<{ propsPath: string; audioPath: string | null }> {
  const { locale, withAudio = true } = opts
  const videoDir = opts.videoDir ?? path.join(process.cwd(), "video")

  const script = await generateVideoScript({
    companyTitle: data.companyTitle,
    recommendation: data.recommendation || "—",
    summary: data.summary,
    metrics: data.metrics,
    risk: data.risk,
    locale,
  })

  let audioFile: string | null = null
  let sceneDurations: Record<SceneKey, number> | undefined

  if (withAudio) {
    const tts = await synthesizeNarration(script.segments)
    audioFile = `voiceover-${data.slug}-${locale}.mp3`
    await fs.mkdir(path.join(videoDir, "public"), { recursive: true })
    await fs.writeFile(path.join(videoDir, "public", audioFile), tts.audio)

    let prevEnd = 0
    sceneDurations = {} as Record<SceneKey, number>
    for (const scene of SCENE_ORDER) {
      const end = tts.sceneEndSeconds[scene]
      sceneDurations[scene] = Math.max(MIN_SCENE_FRAMES, Math.round((end - prevEnd) * FPS))
      prevEnd = end
    }
  }

  const props = {
    companyTitle: data.companyTitle,
    recommendation: data.recommendation || "—",
    metrics: data.metrics,
    chart: data.chart,
    risk: data.risk ?? { title: "", text: "" },
    takeaway: script.takeaway,
    audioSrc: audioFile ?? undefined,
    locale,
    ...(sceneDurations ? { sceneDurations } : {}),
  }
  const propsPath = path.join(videoDir, `props.${data.slug}.${locale}.json`)
  await fs.writeFile(propsPath, JSON.stringify(props, null, 2))

  return { propsPath, audioPath: audioFile ? path.join(videoDir, "public", audioFile) : null }
}

/**
 * DB path: load a published report, localize its text, and build the video
 * assets. `withAudio: false` skips ElevenLabs (dry run, no credits).
 */
export async function buildVideoAssets(opts: {
  slug: string
  locale: Locale
  withAudio?: boolean
  videoDir?: string
}): Promise<{ propsPath: string; audioPath: string | null }> {
  const { slug, locale } = opts

  const doc = await prisma.document.findUnique({
    where: { slug },
    include: {
      publishedAnalysis: {
        include: {
          metrics: { orderBy: { order: "asc" } },
          sections: { orderBy: { order: "asc" } },
          charts: { orderBy: { order: "asc" } },
        },
      },
    },
  })
  const analysis = doc?.publishedAnalysis
  if (!doc || !analysis) throw new Error(`No published analysis for slug "${slug}"`)

  const risks = parseRisks(analysis.risks)
  const base = buildReportStrings({
    title: doc.title,
    summary: analysis.summary,
    metrics: analysis.metrics,
    sections: analysis.sections,
    charts: analysis.charts,
    risks,
  })
  const L =
    locale === "en"
      ? base
      : await localizeReportStrings(base, locale, { analysisId: analysis.id, revision: analysis.revision })
  const tr = (key: string, fallback: string) => L[key] ?? base[key] ?? fallback

  const recommendation = (analysis.recommendation || matchRecommendation(analysis.summary) || "").toUpperCase()
  const chartSource = analysis.charts.find((c) => firstChartPoints(c.configV2))
  const chartPts = chartSource ? firstChartPoints(chartSource.configV2) : null

  const data: VideoReportData = {
    slug,
    companyTitle: tr("title", doc.title),
    recommendation,
    summary: tr("summary", analysis.summary ?? ""),
    metrics: analysis.metrics.slice(0, 3).map((m) => ({
      label: tr(`metric.${m.id}.label`, m.label),
      value: `${m.value}${m.unit ? ` ${m.unit}` : ""}`,
    })),
    chart:
      chartSource && chartPts
        ? { title: tr(`chart.${chartSource.id}.title`, chartSource.title), points: chartPts }
        : { title: "", points: [] },
    risk: risks.length
      ? { title: tr("risk.0.risk", risks[0].risk ?? ""), text: tr("risk.0.explanation", risks[0].explanation ?? "") }
      : null,
  }

  return buildVideoAssetsFromData(data, opts)
}
