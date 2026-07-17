import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

export const MetricSchema = z.object({
  name: z.string().describe("The name of the metric (e.g., Revenue, EBITDA)"),
  value: z.string().describe("The exact value extracted from the text"),
  unit: z.string().nullable().describe("Unit of measurement (e.g., Millions, Billions, %)"),
  currency: z.string().nullable().describe("Currency code if applicable (e.g., USD, INR)"),
  period: z.string().nullable().describe("Financial period (e.g., FY24, Q3 2023)"),
  isHistorical: z.boolean().describe("True if historical, false if it is a forecast/estimate"),
  category: z.string().describe("Category (e.g., Financial, Operational, Valuation)"),
  sourceExcerpt: z.string().describe("Exact quote from the document proving this metric"),
  page: z.number().nullable().describe("Page number where this was found"),
})

export const SectionSchema = z.object({
  title: z.string().describe("Section title"),
  summary: z.string().describe("Detailed summary of the section"),
  evidence: z.string().describe("Key evidence or quotes supporting the summary"),
  pageReferences: z.array(z.number()).describe("Array of page numbers this section covers"),
})

export const RiskSchema = z.object({
  risk: z.string().describe("Name of the risk factor"),
  explanation: z.string().describe("Detailed explanation of how this risk impacts the company"),
  evidence: z.string().describe("Source excerpt or evidence from the document"),
})

export const ChartSchema = z.object({
  type: z.enum(["line", "bar", "comparison"]).describe("The type of chart to render"),
  title: z.string().describe("Chart title"),
  labels: z.array(z.string()).describe("X-axis labels (e.g., years or periods)"),
  series: z.array(z.object({
    name: z.string().describe("Series name (e.g., Revenue, Margin)"),
    data: z.array(z.number()).describe("Numeric data points matching the labels array length")
  })).describe("Data series for the chart")
})

export const AnalysisContractSchema = z.object({
  title: z.string().nullable().describe("Title of the research report"),
  company: z.string().nullable().describe("Target company name"),
  reportDate: z.string().nullable().describe("Date of the report if available"),
  recommendation: z.string().nullable().describe("Overall analyst recommendation (e.g., BUY, SELL, HOLD)"),
  cmp: z.string().nullable().describe("Current Market Price at time of report"),
  baseCaseTarget: z.string().nullable().describe("Base case target price"),
  bullCaseTarget: z.string().nullable().describe("Bull case target price"),
  valuationMethodology: z.string().nullable().describe("Methodology used for valuation (e.g., DCF, P/E multiple)"),
  metrics: z.array(MetricSchema).describe("List of all critical financial and operational metrics"),
  sections: z.array(SectionSchema).describe("Logical sections of the document"),
  risks: z.array(RiskSchema).describe("Key risks mentioned"),
  charts: z.array(ChartSchema).describe("Data structured for charting")
})

export type AnalysisContract = z.infer<typeof AnalysisContractSchema>

export const analysisJsonSchema = zodToJsonSchema(AnalysisContractSchema as any, "AnalysisContract")
