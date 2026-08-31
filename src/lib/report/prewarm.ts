import { prisma } from "@/lib/db"
import { localizeReportStrings } from "./translate"
import { buildReportStrings, buildCardStrings, parseRisks } from "./report-fields"
import type { Locale } from "@/lib/i18n/types"

// Non-English locales to pre-translate. English is canonical (never translated).
const LOCALES: Locale[] = ["hi", "ta"]

/**
 * Warm the translation cache for a document's published analysis in every
 * supported language, for both the full report page and the index card, so the
 * first visitor in any language gets an instant, already-translated page.
 *
 * Best-effort and safe to call fire-and-forget: it reuses the same cached
 * translator as the render path (identical cache keys), so a viewer that races
 * ahead simply populates the same entry. NOTE: the underlying cache is the Next
 * data cache, which is per-deployment on Railway — a redeploy clears it and the
 * first post-deploy view re-warms lazily. Durable cross-deploy warming would
 * require persisting translations in the database.
 */
export async function prewarmReportTranslations(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
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
  const a = doc?.publishedAnalysis
  if (!doc || !a) return

  const version = { analysisId: a.id, revision: a.revision }
  const full = buildReportStrings({
    title: doc.title,
    summary: a.summary,
    metrics: a.metrics,
    sections: a.sections,
    charts: a.charts,
    risks: parseRisks(a.risks),
  })
  const card = buildCardStrings(doc.title, a.summary)

  await Promise.all(
    LOCALES.flatMap((loc) => [
      localizeReportStrings(full, loc, version, "full"),
      localizeReportStrings(card, loc, version, "card"),
    ]),
  ).catch(() => {
    /* best-effort: lazy translation still covers any miss */
  })
}
