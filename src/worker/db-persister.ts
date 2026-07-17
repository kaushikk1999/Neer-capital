import { prisma } from "@/lib/db"
import { AnalysisContract } from "./ai-schema"

export class DbPersister {
  /**
   * Generates a synthetic confidence score (Phase 9)
   */
  private calculateConfidence(data: AnalysisContract): number {
    let score = 1.0

    // Penalize sections missing evidence
    for (const section of data.sections) {
      if (!section.evidence || section.evidence.trim() === "") {
        score -= 0.1
      }
    }

    // Penalize metrics missing source excerpt
    for (const metric of data.metrics) {
      if (!metric.sourceExcerpt || metric.sourceExcerpt.trim() === "") {
        score -= 0.05
      }
    }

    return Math.max(0.1, Math.min(1.0, score))
  }

  private tryParseNumeric(value: string): number | null {
    if (!value) return null
    // Strip everything except numbers, dots, and minus signs
    const cleaned = value.replace(/[^0-9.-]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }

  public async persistAnalysis(jobId: string, documentId: string, data: AnalysisContract, rawResponse: any, modelName: string) {
    console.log(`[DbPersister] Persisting analysis for document ${documentId}`)
    
    const confidence = this.calculateConfidence(data)
    
    // Create a basic summary out of the title and recommendation if nothing else
    const summaryParts: string[] = []
    if (data.title) summaryParts.push(`Title: ${data.title}`)
    if (data.company) summaryParts.push(`Target: ${data.company}`)
    if (data.recommendation) summaryParts.push(`Recommendation: ${data.recommendation}`)
    
    // Phase 10: Transactional Persistence
    await prisma.$transaction(async (tx) => {

      // 0. Retire any previous analysis for this document so a reprocess
      // leaves exactly one active result instead of duplicates.
      await tx.documentAnalysis.updateMany({
        where: { documentId, status: { not: "SUPERSEDED" } },
        data: { status: "SUPERSEDED" },
      })

      // 1. Create the DocumentAnalysis record
      const analysis = await tx.documentAnalysis.create({
        data: {
          documentId,
          status: "REVIEW_REQUIRED", // It requires human review before publishing
          summary: summaryParts.join("\n"),
          recommendation: data.recommendation,
          valuation: data.valuationMethodology,
          risks: data.risks ? JSON.stringify(data.risks) : null,
          confidence,
          rawData: rawResponse,
          model: modelName,
        }
      })

      // 2. Create Sections
      if (data.sections && data.sections.length > 0) {
        await tx.documentSection.createMany({
          data: data.sections.map((sec, index) => ({
            analysisId: analysis.id,
            heading: sec.title,
            content: sec.summary,
            sourceExcerpt: sec.evidence,
            order: index
          }))
        })
      }

      // 3. Create Metrics
      if (data.metrics && data.metrics.length > 0) {
        await tx.documentMetric.createMany({
          data: data.metrics.map((m, index) => ({
            analysisId: analysis.id,
            label: m.name,
            value: m.value,
            numericValue: this.tryParseNumeric(m.value),
            unit: m.unit,
            period: m.period,
            category: m.category,
            order: index
          }))
        })
      }

      // 4. Create Charts
      if (data.charts && data.charts.length > 0) {
        await tx.documentChart.createMany({
          data: data.charts.map((c, index) => ({
            analysisId: analysis.id,
            type: c.type,
            title: c.title,
            config: {
              labels: c.labels,
              series: c.series
            },
            order: index
          }))
        })
      }

      // 5. Update the Job Status
      await tx.analysisJob.update({
        where: { id: jobId },
        data: {
          status: "DONE",
          progress: 100,
          finishedAt: new Date()
        }
      })
    })

    console.log(`[DbPersister] Successfully persisted analysis for document ${documentId}`)
  }
}
