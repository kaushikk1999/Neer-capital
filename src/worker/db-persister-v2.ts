/**
 * Stage 7: persistence.
 *
 * Everything expensive (PDF parsing, model calls, OCR) has already happened by
 * the time we get here. This module does nothing but write, inside one short
 * transaction, so a slow model can never hold a database transaction open.
 *
 * Two invariants:
 *  - V1 columns are always written, so existing readers keep working and a code
 *    rollback stays safe.
 *  - Reprocessing creates a NEW analysis version; prior versions are superseded,
 *    never deleted.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { MergedExtraction } from "@/worker/merge"
import { metricId as synthMetricId, type SynthesisResult } from "@/worker/ai-synthesizer"
import { normalizeChartSeries } from "@/lib/analysis/chart-normalize"
import {
  arithmeticChecks,
  contradictionChecks,
  computeCoverage,
  missingCriticalFieldIssues,
  confidenceFromVerification,
  CRITICAL_FIELDS,
  QUALITY_FORMULA_VERSION,
  type CriticalField,
  type MetricInput,
  type ValidationIssue,
} from "@/lib/analysis/validation"
import type { RawChartPoint } from "@/lib/analysis/chart-normalize"
import type { ClassificationCodeT, EvidenceLinkRef } from "@/lib/report/types"

/** Metrics we chart when the report provides a series. */
const CHARTED_METRICS: { key: string; title: string }[] = [
  { key: "revenue", title: "Revenue" },
  { key: "ebitda", title: "EBITDA" },
  { key: "pat_reported", title: "Reported PAT" },
]

export interface PersistInput {
  documentId: string
  jobId: string
  runId: string
  merged: MergedExtraction
  synthesis: SynthesisResult | null
  /** True when chunking or parsing did not cover the whole document. */
  isPartial: boolean
  model: string
  promptVersion: string
  schemaVersion?: number
}

export interface PersistResult {
  analysisId: string
  version: number
  status: "REVIEW_REQUIRED" | "PARTIAL"
  metricCount: number
  evidenceCount: number
  chartCount: number
  claimCount: number
  issueCount: number
  blockerCount: number
}

/** Which critical fields the report did not yield. */
function findMissingCriticalFields(merged: MergedExtraction): CriticalField[] {
  const present: Record<CriticalField, unknown> = {
    company: merged.identity.companyName,
    recommendation: merged.valuation.rating,
    cmp: merged.valuation.cmp,
    baseTarget: merged.valuation.baseTarget,
    horizon: merged.valuation.horizon,
    researchHouse: merged.identity.researchHouse,
    analyst: merged.identity.analystName,
    publishedAt: merged.identity.publishedDate,
  }
  return CRITICAL_FIELDS.filter((f) => {
    const v = present[f]
    return v == null || String(v).trim() === ""
  })
}

/**
 * Persists one extraction run. Returns the new analysis version.
 *
 * Version allocation happens inside the transaction and retries on a unique
 * violation, because two workers may finish for the same document at once.
 */
export async function persistAnalysisV2(input: PersistInput): Promise<PersistResult> {
  const { documentId, jobId, runId, merged, synthesis } = input

  // ---- Everything below is pure computation; no IO, no model calls. --------
  const missingCritical = findMissingCriticalFields(merged)

  const metricInputs: MetricInput[] = merged.metrics.map((m, i) => ({
    id: `idx:${i}`,
    label: m.label,
    taxonomyKey: m.taxonomyKey,
    decimalValue: m.decimalValue,
    period: m.period,
    classificationCode: m.classificationCode as ClassificationCodeT,
    sourcePage: m.evidence.page,
    evidenceVerification: m.evidence.verification,
    currency: m.currency,
    scale: m.scale,
  }))

  const valuationForChecks = {
    cmp: numeric(merged.valuation.cmp),
    baseTarget: numeric(merged.valuation.baseTarget),
    appliedMultiple: numeric(merged.valuation.appliedMultiple),
    eps: merged.metrics.find((m) => m.taxonomyKey === "eps_diluted")?.decimalValue ?? null,
    pe: null,
  }

  const issues: ValidationIssue[] = [
    ...missingCriticalFieldIssues(missingCritical),
    ...arithmeticChecks(metricInputs, valuationForChecks),
    ...contradictionChecks(metricInputs),
  ]

  // Conflicts detected during merge are first-class issues too.
  merged.metrics.forEach((m, i) => {
    for (const c of m.conflicts) {
      issues.push({
        code: "CONTRADICTORY_METRIC_VALUE",
        severity: "BLOCKER",
        entityType: "DocumentMetric",
        entityId: `idx:${i}`,
        message: `${m.label} for ${m.period ?? "unknown period"} appears with conflicting values in the source report.`,
        details: {
          kept: { value: m.decimalValue, page: m.evidence.page },
          conflicting: { value: c.decimalValue, page: c.evidence.page },
        },
        fingerprint: `conflict:${m.taxonomyKey}:${m.period}:${m.decimalValue}:${c.decimalValue}`,
      })
    }
  })

  const sectionInputs = merged.sections.map((s, i) => ({
    id: `sec:${i}`,
    heading: s.title,
    evidenceVerification: s.evidence.verification,
  }))

  const coverage = computeCoverage(metricInputs, sectionInputs, missingCritical, issues)

  // Charts: build from real series; missing periods become explicit gaps.
  const charts = CHARTED_METRICS.map(({ key, title }) => {
    const points: RawChartPoint[] = merged.metrics
      .filter((m) => m.taxonomyKey === key && m.period)
      .sort((a, b) => (a.periodSortKey ?? 0) - (b.periodSortKey ?? 0))
      .map((m) => ({
        period: m.period as string,
        value: m.decimalValue == null ? null : Number(m.decimalValue),
        classificationCode: m.classificationCode as ClassificationCodeT,
        confidenceLevel: confidenceFromVerification(m.evidence.verification, m.conflicts.length > 0),
        evidenceLinks: [] as EvidenceLinkRef[],
      }))
    if (points.length === 0) return null
    const sample = merged.metrics.find((m) => m.taxonomyKey === key)
    const normalized = normalizeChartSeries(title, points, {
      currency: sample?.currency ?? null,
      scale: sample?.scale ?? null,
      unit: sample?.scale ?? null,
    })
    return { key, title, normalized }
  }).filter(Boolean) as { key: string; title: string; normalized: ReturnType<typeof normalizeChartSeries> }[]

  for (const c of charts) {
    for (const ci of c.normalized.issues) {
      issues.push({
        code: ci.code,
        severity: ci.code === "CHART_LABEL_VALUE_MISMATCH" ? "BLOCKER" : "WARNING",
        entityType: "DocumentChart",
        entityId: c.key,
        message: ci.message,
        details: ci.details,
        fingerprint: `chart:${c.key}:${ci.code}`,
      })
    }
  }

  const status: "REVIEW_REQUIRED" | "PARTIAL" = input.isPartial ? "PARTIAL" : "REVIEW_REQUIRED"
  const blockerCount = issues.filter((i) => i.severity === "BLOCKER").length

  // V1 payloads, still written so existing readers are unaffected.
  const v1Summary = [
    merged.identity.companyName ? `Target: ${merged.identity.companyName}` : null,
    merged.valuation.rating ? `Recommendation: ${merged.valuation.rating}` : null,
  ]
    .filter(Boolean)
    .join("\n")
  const v1Risks = merged.risks.length
    ? JSON.stringify(
        merged.risks.map((r) => ({ risk: r.title, explanation: r.body, evidence: r.evidence.quote }))
      )
    : null

  // ---- Short, DB-only transaction. ----------------------------------------
  return await withVersionRetry(async () =>
    prisma.$transaction(
      async (tx) => {
        const agg = await tx.documentAnalysis.aggregate({
          where: { documentId },
          _max: { version: true },
        })
        const version = (agg._max.version ?? 0) + 1

        const prior = await tx.documentAnalysis.findFirst({
          where: { documentId, status: { notIn: ["SUPERSEDED"] } },
          orderBy: { version: "desc" },
          select: { id: true },
        })

        await tx.documentAnalysis.updateMany({
          where: { documentId, status: { notIn: ["SUPERSEDED"] } },
          data: { status: "SUPERSEDED" },
        })

        const analysis = await tx.documentAnalysis.create({
          data: {
            documentId,
            status,
            version,
            revision: 0,
            schemaVersion: input.schemaVersion ?? 2,
            supersedesAnalysisId: prior?.id ?? null,
            model: input.model,
            // V1 fields (dual-write)
            summary: v1Summary || null,
            recommendation: str(merged.valuation.rating),
            valuation: str(merged.valuation.valuationBasis),
            risks: v1Risks,
            confidence: null,
            rawData: { merged: serializeMerged(merged) } as Prisma.InputJsonValue,
            // V2 fields
            identity: merged.identity as Prisma.InputJsonValue,
            valuationDetail: merged.valuation as Prisma.InputJsonValue,
            attribution: {
              analystRating: str(merged.valuation.rating),
              analystRatingSource: "ANALYST_STATED",
              neerAssessment: null,
              disclosuresPresent: false,
              disclaimer: null,
            } as Prisma.InputJsonValue,
            qualityCoverage: coverage as unknown as Prisma.InputJsonValue,
            qualityFormulaVersion: QUALITY_FORMULA_VERSION,
          },
          select: { id: true, version: true },
        })

        // Evidence first: metrics and narrative rows link to it.
        const evidenceRows = buildEvidenceRows(analysis.id, merged)
        if (evidenceRows.length > 0) {
          await tx.analysisEvidence.createMany({ data: evidenceRows })
        }
        if (merged.metrics.length > 0) {
          await tx.documentMetric.createMany({
            data: merged.metrics.map((m, i) => ({
              analysisId: analysis.id,
              label: m.label,
              value: m.rawValue,
              numericValue: m.decimalValue == null ? null : Number(m.decimalValue),
              decimalValue: m.decimalValue == null ? null : new Prisma.Decimal(m.decimalValue),
              rawValue: m.rawValue,
              unit: m.scale,
              scale: m.scale,
              currency: m.currency,
              period: m.period,
              category: m.category,
              taxonomyKey: m.taxonomyKey,
              classificationCode: normalizeCode(m.classificationCode),
              sourcePage: m.evidence.page,
              confidenceLevel: confidenceFromVerification(m.evidence.verification, m.conflicts.length > 0),
              validationStatus: m.conflicts.length > 0 ? "CONFLICTING" : "UNVERIFIED",
              reviewStatus: "NOT_REVIEWED" as const,
              provenance: "ANALYST_STATED" as const,
              order: i,
            })),
          })
        }

        if (merged.sections.length > 0) {
          await tx.documentSection.createMany({
            data: merged.sections.map((s, i) => ({
              analysisId: analysis.id,
              heading: s.title,
              content: s.body,
              sourceExcerpt: s.evidence.quote || null,
              sourcePage: s.evidence.page,
              reviewStatus: "NOT_REVIEWED" as const,
              order: i,
            })),
          })
        }

        if (merged.risks.length > 0) {
          await tx.riskItem.createMany({
            data: merged.risks.map((r, i) => ({
              analysisId: analysis.id,
              name: r.title,
              explanation: r.body,
              provenance: "ANALYST_STATED" as const,
              confidenceLevel: confidenceFromVerification(r.evidence.verification, false),
              reviewStatus: "NOT_REVIEWED" as const,
              order: i,
            })),
          })
        }

        if (merged.catalysts.length > 0) {
          await tx.catalyst.createMany({
            data: merged.catalysts.map((c, i) => ({
              analysisId: analysis.id,
              name: c.title,
              explanation: c.body,
              provenance: "ANALYST_STATED" as const,
              confidenceLevel: confidenceFromVerification(c.evidence.verification, false),
              reviewStatus: "NOT_REVIEWED" as const,
              order: i,
            })),
          })
        }

        if (merged.thesisPoints.length > 0) {
          await tx.thesisDriver.createMany({
            data: merged.thesisPoints.map((t, i) => ({
              analysisId: analysis.id,
              title: t.title,
              explanation: t.body,
              provenance: "ANALYST_STATED" as const,
              confidenceLevel: confidenceFromVerification(t.evidence.verification, false),
              reviewStatus: "NOT_REVIEWED" as const,
              order: i,
            })),
          })
        }

        if (charts.length > 0) {
          await tx.documentChart.createMany({
            data: charts.map((c, i) => ({
              analysisId: analysis.id,
              type: "line",
              title: c.title,
              // V1 shape preserved for legacy readers.
              config: c.normalized.configV1 as unknown as Prisma.InputJsonValue,
              configV2: c.normalized.configV2 as unknown as Prisma.InputJsonValue,
              schemaVersion: 2,
              order: i,
            })),
          })
        }

        if (synthesis && synthesis.claims.length > 0) {
          await tx.synthesizedClaim.createMany({
            data: synthesis.claims.map((c) => ({
              analysisId: analysis.id,
              claimType: c.claimType,
              text: c.text,
              supportingMetricIds: c.citedMetricIds as unknown as Prisma.InputJsonValue,
              derivation: c.numericVerification as unknown as Prisma.InputJsonValue,
              numericVerification: c.numericVerification as unknown as Prisma.InputJsonValue,
              semanticVerification: c.semanticVerification as unknown as Prisma.InputJsonValue,
              verificationMethod: c.verificationMethod,
              confidenceLevel: c.verificationMethod === "DETERMINISTIC_NUMERIC" ? "HIGH" : "MEDIUM",
              reviewStatus: "NOT_REVIEWED" as const,
            })),
          })
        }

        if (issues.length > 0) {
          await tx.analysisIssue.createMany({
            data: issues.map((i) => ({
              analysisId: analysis.id,
              revision: 0,
              severity: i.severity,
              status: "OPEN" as const,
              code: i.code,
              fingerprint: i.fingerprint,
              entityType: i.entityType,
              entityId: i.entityId,
              message: i.message,
              details: i.details as Prisma.InputJsonValue,
            })),
            skipDuplicates: true,
          })
        }

        await tx.extractionRun.updateMany({
          where: { runId },
          data: {
            analysisId: analysis.id,
            status: input.isPartial ? "PARTIAL" : "COMPLETED",
            stage: "PERSISTING",
            finishedAt: new Date(),
            validationResult: { issueCount: issues.length, blockerCount, coverage } as unknown as Prisma.InputJsonValue,
          },
        })

        await tx.analysisJob.update({
          where: { id: jobId },
          data: { status: "DONE", progress: 100, finishedAt: new Date() },
        })

        await tx.document.update({
          where: { id: documentId },
          data: { status: "DRAFT" },
        })

        return {
          analysisId: analysis.id,
          version: analysis.version,
          status,
          metricCount: merged.metrics.length,
          evidenceCount: evidenceRows.length,
          chartCount: charts.length,
          claimCount: synthesis?.claims.length ?? 0,
          issueCount: issues.length,
          blockerCount,
        }
      },
      { timeout: 20_000 }
    )
  )
}

/** Retries once on a version uniqueness collision from a concurrent worker. */
async function withVersionRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      if (!isUniqueViolation) throw error
      lastError = error
      await new Promise((r) => setTimeout(r, 50 * (i + 1)))
    }
  }
  throw lastError
}

function buildEvidenceRows(analysisId: string, merged: MergedExtraction) {
  const rows: {
    analysisId: string
    page: number | null
    sourceType: "NARRATIVE_QUOTE" | "TABLE_CELL"
    originalQuote: string
    normalizedQuote: string
    extractionMethod: "TEXT_LAYER"
    verificationStatus: "EXACT_MATCH" | "NORMALIZED_MATCH" | "APPROXIMATE_MATCH" | "UNVERIFIED" | "CONFLICTING"
    verificationMethod: "STRING_MATCH"
  }[] = []
  const seen = new Set<string>()

  const push = (quote: string, normalized: string, page: number | null, verification: string) => {
    if (!quote.trim()) return
    const key = `${page ?? "n"}::${normalized.slice(0, 80)}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      analysisId,
      page,
      sourceType: "NARRATIVE_QUOTE",
      originalQuote: quote,
      normalizedQuote: normalized,
      extractionMethod: "TEXT_LAYER",
      verificationStatus: verification as (typeof rows)[number]["verificationStatus"],
      verificationMethod: "STRING_MATCH",
    })
  }

  for (const m of merged.metrics) push(m.evidence.quote, m.evidence.normalizedQuote, m.evidence.page, m.evidence.verification)
  for (const group of [merged.risks, merged.catalysts, merged.thesisPoints, merged.sections]) {
    for (const item of group) {
      push(item.evidence.quote, item.evidence.normalizedQuote, item.evidence.page, item.evidence.verification)
    }
  }
  return rows
}

function serializeMerged(merged: MergedExtraction) {
  return {
    identity: merged.identity,
    valuation: merged.valuation,
    stats: merged.stats,
    metrics: merged.metrics.map((m) => ({
      label: m.label,
      taxonomyKey: m.taxonomyKey,
      rawValue: m.rawValue,
      period: m.period,
      classificationCode: m.classificationCode,
      page: m.evidence.page,
      verification: m.evidence.verification,
      conflicts: m.conflicts.map((c) => ({ rawValue: c.rawValue, page: c.evidence.page })),
    })),
  }
}

function str(v: unknown): string | null {
  return v == null || String(v).trim() === "" ? null : String(v)
}

function numeric(v: unknown): string | null {
  if (v == null) return null
  const cleaned = String(v).replace(/[^\d.-]/g, "")
  return cleaned === "" || !Number.isFinite(Number(cleaned)) ? null : cleaned
}

const VALID_CODES = new Set(["A", "R", "P", "G", "E", "C", "S", "AI", "U"])
function normalizeCode(code: string): ClassificationCodeT {
  const c = (code ?? "U").toUpperCase()
  return (VALID_CODES.has(c) ? c : "U") as ClassificationCodeT
}

export { synthMetricId }
