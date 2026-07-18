import { z } from "zod"

// LLM output is stochastic: the same model emits a number where a string is
// expected (e.g. a price of 550.5 vs "550.5"), null where an array is expected,
// or occasionally omits a field. These coercion helpers absorb that variance so
// structurally-correct output still validates. The verbatim model response is
// persisted separately as rawData, so nothing is lost by coercing here.

/** Required text — tolerates number/null/missing, coercing to "" when absent. */
const softStr = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? "" : String(v)))

/** Nullable text — tolerates number, preserves null/missing as null. */
const softNullableStr = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? null : String(v)))

/** Nullable number — tolerates numeric strings, preserves null/missing as null. */
const softNullableNum = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v == null) return null
    const n = typeof v === "number" ? v : parseFloat(v)
    return Number.isFinite(n) ? n : null
  })

const softNumArr = z
  .array(z.unknown())
  .nullish()
  .transform((v) => {
    if (!v) return []
    return v.map(val => {
      if (val == null) return 0
      const n = typeof val === "number" ? val : parseFloat(String(val))
      return Number.isFinite(n) ? n : 0
    })
  })

const softStrArr = z
  .array(z.unknown())
  .nullish()
  .transform((v) => {
    if (!v) return []
    return v.map(val => val == null ? "" : String(val))
  })

const softBool = z
  .union([z.boolean(), z.string()])
  .nullish()
  .transform((v) => v === true || v === "true")

/**
 * A resilient array: non-array input becomes [], and each element is validated
 * independently — malformed items are dropped rather than failing the whole
 * document. The verbatim model output is still persisted as rawData, so this
 * only affects the structured view, never loses the source.
 */
function resilientArray<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(z.unknown()).transform((items) => {
      const out: z.infer<T>[] = []
      for (const i of items) {
        const r = item.safeParse(i)
        if (r.success) out.push(r.data)
      }
      return out
    })
  )
}

export const MetricSchema = z.object({
  name: softStr.describe("The name of the metric (e.g., Revenue, EBITDA)"),
  value: softStr.describe("The exact value extracted from the text"),
  unit: softNullableStr.describe("Unit of measurement (e.g., Millions, Billions, %)"),
  currency: softNullableStr.describe("Currency code if applicable (e.g., USD, INR)"),
  period: softNullableStr.describe("Financial period (e.g., FY24, Q3 2023)"),
  isHistorical: softBool.describe("True if historical, false if it is a forecast/estimate"),
  category: softStr.describe("Category (e.g., Financial, Operational, Valuation)"),
  sourceExcerpt: softStr.describe("Exact quote from the document proving this metric"),
  page: softNullableNum.describe("Page number where this was found"),
})

export const SectionSchema = z.object({
  title: softStr.describe("Section title"),
  summary: softStr.describe("Detailed summary of the section"),
  evidence: softStr.describe("Key evidence or quotes supporting the summary"),
  pageReferences: softNumArr.describe("Array of page numbers this section covers"),
})

export const RiskSchema = z.object({
  risk: softStr.describe("Name of the risk factor"),
  explanation: softStr.describe("Detailed explanation of how this risk impacts the company"),
  evidence: softStr.describe("Source excerpt or evidence from the document"),
})

export const ChartSchema = z.object({
  type: z.enum(["line", "bar", "comparison"]).catch("bar").describe("The type of chart to render"),
  title: softStr.describe("Chart title"),
  labels: softStrArr.describe("X-axis labels (e.g., years or periods)"),
  series: resilientArray(
    z.object({
      name: softStr.describe("Series name (e.g., Revenue, Margin)"),
      data: softNumArr.describe("Numeric data points matching the labels array length"),
    })
  ).describe("Data series for the chart"),
})

export const AnalysisContractSchema = z.object({
  title: softNullableStr.describe("Title of the research report"),
  company: softNullableStr.describe("Target company name"),
  reportDate: softNullableStr.describe("Date of the report if available"),
  recommendation: softNullableStr.describe("Overall analyst recommendation (e.g., BUY, SELL, HOLD)"),
  cmp: softNullableStr.describe("Current Market Price at time of report"),
  baseCaseTarget: softNullableStr.describe("Base case target price"),
  bullCaseTarget: softNullableStr.describe("Bull case target price"),
  valuationMethodology: softNullableStr.describe("Methodology used for valuation (e.g., DCF, P/E multiple)"),
  metrics: resilientArray(MetricSchema).describe("List of all critical financial and operational metrics"),
  sections: resilientArray(SectionSchema).describe("Logical sections of the document"),
  risks: resilientArray(RiskSchema).describe("Key risks mentioned"),
  charts: resilientArray(ChartSchema).describe("Data structured for charting"),
})

export type AnalysisContract = z.infer<typeof AnalysisContractSchema>
