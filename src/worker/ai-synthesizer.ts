/**
 * Stage 6: constrained narrative synthesis.
 *
 * The model writes the readable analysis, but it may only speak about facts we
 * already extracted, and every number it uses must be traceable to a cited
 * metric. Checking that a cited ID *exists* is not enough — a model can cite a
 * real metric and still state a number that metric does not support. So each
 * claim is verified two ways, recorded separately:
 *
 *   DETERMINISTIC_NUMERIC — every number in the claim matches a cited metric
 *                           (or a value derived from them by calc.ts)
 *   MODEL_SEMANTIC        — the model's own assertion, never called deterministic
 *
 * A numeric claim that fails deterministic verification is rejected outright.
 * We would rather publish less than publish a confident wrong number.
 */

import { Ollama } from "ollama"
import { z } from "zod"
import type { MergedExtraction, MergedMetric } from "@/worker/merge"
import { growthYoY, marginPct, impliedUpside, agreesWithin } from "@/lib/analysis/calc"

const OLLAMA_URL =
  process.env.OLLAMA_BASE_URL || process.env.OLLAMA_API_URL || "https://api.ollama.com"
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || ""
export const SYNTHESIS_MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-cloud"
export const SYNTHESIS_PROMPT_VERSION = "synth-v2.0"

const ollama = new Ollama({
  host: OLLAMA_URL,
  fetch: (input, init) =>
    fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${OLLAMA_KEY}` } }),
})

export type ClaimType =
  | "VERDICT"
  | "WHY_RATED"
  | "OUTLOOK"
  | "VALUATION"
  | "MAIN_CONCERN"
  | "DATA_QUALITY"

export type VerificationMethodT =
  | "DETERMINISTIC_NUMERIC"
  | "STRING_MATCH"
  | "MODEL_SEMANTIC"
  | "NONE"

const softStr = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? "" : String(v).trim()))

const RawClaimSchema = z.object({
  claimType: softStr,
  text: softStr,
  citedMetricIds: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.union([z.string(), z.number()]).transform(String))
  ),
})

const SynthesisResponseSchema = z.object({
  claims: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.unknown()).transform((items) => {
      const out: z.infer<typeof RawClaimSchema>[] = []
      for (const i of items) {
        const r = RawClaimSchema.safeParse(i)
        if (r.success) out.push(r.data)
      }
      return out
    })
  ),
})

export interface VerifiedClaim {
  claimType: ClaimType
  text: string
  citedMetricIds: string[]
  verificationMethod: VerificationMethodT
  numericVerification: {
    status: "PASS" | "FAIL" | "NOT_APPLICABLE"
    checkedNumbers: { literal: string; matchedMetricId: string | null; derivation?: string }[]
  }
  semanticVerification: {
    status: "MODEL_ASSERTED"
    modelId: string
    promptVersion: string
  }
}

export interface RejectedClaim {
  text: string
  reason: string
  unsupportedNumbers: string[]
}

export interface SynthesisResult {
  claims: VerifiedClaim[]
  rejected: RejectedClaim[]
  model: string
  promptVersion: string
  durationMs: number
}

const VALID_CLAIM_TYPES: ClaimType[] = [
  "VERDICT",
  "WHY_RATED",
  "OUTLOOK",
  "VALUATION",
  "MAIN_CONCERN",
  "DATA_QUALITY",
]

/**
 * Fiscal period labels (FY26, Q3FY26, H1FY25-26, 9MFY24) carry digits that are
 * not financial assertions. They must be removed before number extraction, or
 * every correctly-cited claim would be rejected for its own period label.
 */
const PERIOD_TOKEN =
  /\b(?:\d{1,2}[QHM]|Q\d|H\d)?FY\s?\d{2,4}(?:\s?[-/]\s?\d{2,4})?[AEPGCS]?\b|\bQ\d\s?\d{2,4}\b|\bTTM\b/gi

/** Numbers a claim asserts. Percentages and plain figures both count. */
function extractNumbers(text: string): string[] {
  const withoutPeriods = text.replace(PERIOD_TOKEN, " ")
  const matches = withoutPeriods.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []
  return matches
    .map((m) => m.replace(/,/g, ""))
    .filter((m) => {
      const n = Number(m)
      if (!Number.isFinite(n)) return false
      // A bare calendar year is context, not a financial assertion.
      if (/^(19|20)\d{2}$/.test(m)) return false
      return true
    })
}

/**
 * A number is supported if it matches a cited metric's value, or a value we can
 * derive from cited metrics (growth, margin, upside). Derivations are computed
 * by calc.ts, never by the model.
 */
function findSupport(
  literal: string,
  cited: MergedMetric[],
  valuation: MergedExtraction["valuation"]
): { metricId: string | null; derivation?: string } | null {
  const target = literal

  for (const m of cited) {
    if (m.decimalValue && agreesWithin(m.decimalValue, target, 0.01).agrees) {
      return { metricId: metricId(m) }
    }
  }

  // Year-on-year growth between two cited periods of the same metric.
  const byKey = new Map<string, MergedMetric[]>()
  for (const m of cited) {
    const list = byKey.get(m.taxonomyKey) ?? []
    list.push(m)
    byKey.set(m.taxonomyKey, list)
  }
  for (const [, list] of byKey) {
    const sorted = [...list].sort((a, b) => (a.periodSortKey ?? 0) - (b.periodSortKey ?? 0))
    for (let i = 1; i < sorted.length; i++) {
      const g = growthYoY(sorted[i].decimalValue, sorted[i - 1].decimalValue)
      if (g.value && agreesWithin(g.value, target, 0.02).agrees) {
        return {
          metricId: metricId(sorted[i]),
          derivation: `${g.formula} using ${sorted[i - 1].period} and ${sorted[i].period}`,
        }
      }
    }
  }

  // Margin of any cited metric against cited revenue.
  const revenue = cited.find((m) => m.taxonomyKey === "revenue")
  if (revenue) {
    for (const m of cited) {
      if (m === revenue) continue
      const mg = marginPct(m.decimalValue, revenue.decimalValue, m.taxonomyKey)
      if (mg.value && agreesWithin(mg.value, target, 0.02).agrees) {
        return { metricId: metricId(m), derivation: mg.formula }
      }
    }
  }

  // Implied upside from the report's own CMP and target.
  const cmp = valuation.cmp == null ? null : String(valuation.cmp).replace(/[^\d.-]/g, "")
  const tgt = valuation.baseTarget == null ? null : String(valuation.baseTarget).replace(/[^\d.-]/g, "")
  if (cmp && tgt) {
    const up = impliedUpside(tgt, cmp)
    if (up.value && agreesWithin(up.value, target, 0.02).agrees) {
      return { metricId: null, derivation: up.formula }
    }
  }

  return null
}

/** Stable within one synthesis pass; replaced by DB ids at persistence time. */
export function metricId(m: MergedMetric): string {
  return `${m.taxonomyKey}:${m.period ?? "?"}:${m.classificationCode}`
}

function buildSystemPrompt(): string {
  return `You are a financial writer summarising a research report that has already been extracted into verified facts.

CRITICAL RULES:
1. You may ONLY use the facts listed below. Do not add information from your own knowledge.
2. Every claim you write MUST cite the metric ids it relies on, in citedMetricIds.
3. Any number you write MUST come from a cited metric. If you cannot cite it, do not write it.
4. Attribute views to the report's analyst, never to us. Write "The report's analyst expects..." not "We expect...".
5. Do not invent ratings, targets, dates or probabilities.
6. Respond with ONE JSON object and no other keys:
{"claims": [{"claimType": "VERDICT"|"WHY_RATED"|"OUTLOOK"|"VALUATION"|"MAIN_CONCERN"|"DATA_QUALITY", "text": string, "citedMetricIds": string[]}]}`
}

function buildUserPrompt(merged: MergedExtraction): string {
  const facts = merged.metrics
    .slice(0, 60)
    .map((m) => `- id=${metricId(m)} | ${m.label} = ${m.rawValue} | period=${m.period ?? "n/a"} | type=${m.classificationCode}`)
    .join("\n")

  const v = merged.valuation
  const valuationLines = [
    v.rating ? `rating (as printed): ${v.rating}` : null,
    v.cmp ? `CMP: ${v.cmp}` : null,
    v.baseTarget ? `base target: ${v.baseTarget}` : null,
    v.horizon ? `horizon: ${v.horizon}` : null,
    v.valuationBasis ? `valuation basis: ${v.valuationBasis}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const risks = merged.risks.slice(0, 8).map((r) => `- ${r.title}: ${r.body}`).join("\n")

  return `COMPANY: ${merged.identity.companyName ?? "unknown"}
RESEARCH HOUSE: ${merged.identity.researchHouse ?? "unknown"}

VALUATION AS PRINTED IN THE REPORT:
${valuationLines || "(none stated)"}

VERIFIED METRICS:
${facts || "(none)"}

RISKS STATED IN THE REPORT:
${risks || "(none)"}

Write the investment summary claims. Cite metric ids for every claim.`
}

function stripFence(content: string): string {
  const t = content.trim()
  if (!t.startsWith("```")) return t
  return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
}

/**
 * Generates and verifies narrative claims. Claims whose numbers cannot be
 * traced to cited metrics are dropped and reported, not published.
 */
export async function synthesize(merged: MergedExtraction): Promise<SynthesisResult> {
  const started = Date.now()
  const metricsById = new Map(merged.metrics.map((m) => [metricId(m), m]))

  const response = await ollama.chat({
    model: SYNTHESIS_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(merged) },
    ],
    format: "json",
    options: { temperature: 0.1 },
  })

  const parsed = SynthesisResponseSchema.parse(JSON.parse(stripFence(response.message.content)))

  const claims: VerifiedClaim[] = []
  const rejected: RejectedClaim[] = []

  for (const raw of parsed.claims) {
    const text = raw.text.trim()
    if (!text) continue

    const claimType = (VALID_CLAIM_TYPES as string[]).includes(raw.claimType.toUpperCase())
      ? (raw.claimType.toUpperCase() as ClaimType)
      : "OUTLOOK"

    // Only ids that actually exist may be cited.
    const citedIds = raw.citedMetricIds.filter((id) => metricsById.has(id))
    const cited = citedIds.map((id) => metricsById.get(id)!) as MergedMetric[]

    const numbers = extractNumbers(text)
    const checked: VerifiedClaim["numericVerification"]["checkedNumbers"] = []
    const unsupported: string[] = []

    for (const literal of numbers) {
      const support = findSupport(literal, cited, merged.valuation)
      if (support) {
        checked.push({ literal, matchedMetricId: support.metricId, derivation: support.derivation })
      } else {
        unsupported.push(literal)
      }
    }

    if (unsupported.length > 0) {
      rejected.push({
        text,
        reason:
          citedIds.length === 0
            ? "Claim states figures but cites no valid metric."
            : "Claim states figures that the cited metrics do not support.",
        unsupportedNumbers: unsupported,
      })
      continue
    }

    claims.push({
      claimType,
      text,
      citedMetricIds: citedIds,
      verificationMethod: numbers.length > 0 ? "DETERMINISTIC_NUMERIC" : "MODEL_SEMANTIC",
      numericVerification: {
        status: numbers.length > 0 ? "PASS" : "NOT_APPLICABLE",
        checkedNumbers: checked,
      },
      semanticVerification: {
        status: "MODEL_ASSERTED",
        modelId: SYNTHESIS_MODEL,
        promptVersion: SYNTHESIS_PROMPT_VERSION,
      },
    })
  }

  return {
    claims,
    rejected,
    model: SYNTHESIS_MODEL,
    promptVersion: SYNTHESIS_PROMPT_VERSION,
    durationMs: Date.now() - started,
  }
}
