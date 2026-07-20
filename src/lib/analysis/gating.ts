/**
 * Publication gating.
 *
 * Decides whether a specific analysis *revision* may be published. Every rule
 * is derived from persisted state — nothing is hard-coded for a particular
 * document. Blockers cannot be waived. Warnings can, but only with a recorded
 * acknowledgement whose fingerprint still matches the live issue.
 */

import { acknowledgementStillValid } from "@/lib/analysis/fingerprint"
import type { IssueSeverityT } from "@/lib/analysis/validation"

export type AnalysisStatusT =
  | "PROCESSING"
  | "PARTIAL"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "SUPERSEDED"
  | "FAILED"

export interface GateIssue {
  id: string
  code: string
  severity: IssueSeverityT
  message: string
  fingerprint: string
  entityType: string
  entityId: string | null
}

export interface GateAcknowledgement {
  issueId: string
  fingerprint: string
  reviewerId: string
  reason: string
}

export interface GateInput {
  analysisStatus: AnalysisStatusT
  /** The revision the caller intends to publish. */
  requestedRevision: number
  /** The analysis's current revision — a mismatch means the draft moved on. */
  currentRevision: number
  issues: GateIssue[]
  acknowledgements: GateAcknowledgement[]
  /** True when the extraction run finished PARTIAL (see partialOverride). */
  isPartialExtraction: boolean
  /**
   * A PARTIAL analysis may only be published when every critical field has
   * been reviewed and an audited justification plus a public limitation notice
   * are supplied.
   */
  partialOverride?: {
    allCriticalFieldsReviewed: boolean
    justification: string
    limitationNotice: string
  } | null
}

export interface GateResult {
  publishable: boolean
  blockers: GateIssue[]
  /** Warnings still awaiting a valid acknowledgement. */
  unacknowledgedWarnings: GateIssue[]
  /** Human-readable reasons the publish button is disabled. */
  reasons: string[]
}

const PUBLISHABLE_STATUS: AnalysisStatusT = "APPROVED"

export function getPublicationGate(input: GateInput): GateResult {
  const reasons: string[] = []

  // 1. Optimistic lock: never publish a revision that has been superseded.
  if (input.requestedRevision !== input.currentRevision) {
    reasons.push(
      `This draft changed while you were reviewing it (revision ${input.requestedRevision} → ${input.currentRevision}). Reload before publishing.`
    )
  }

  // 2. Only an approved analysis may be published.
  if (input.analysisStatus !== PUBLISHABLE_STATUS) {
    reasons.push(`Analysis status is ${input.analysisStatus}; only APPROVED analyses can be published.`)
  }

  // 3. PARTIAL extraction blocks by default; an override must be complete.
  if (input.isPartialExtraction) {
    const o = input.partialOverride
    if (!o) {
      reasons.push(
        "Extraction completed only partially. Publishing requires reviewing all critical fields and supplying a justification and a public limitation notice."
      )
    } else {
      if (!o.allCriticalFieldsReviewed) {
        reasons.push("Partial extraction override requires every critical field to be reviewed.")
      }
      if (!o.justification.trim()) {
        reasons.push("Partial extraction override requires a recorded justification.")
      }
      if (!o.limitationNotice.trim()) {
        reasons.push("Partial extraction override requires a public limitation notice.")
      }
    }
  }

  // 4. Blockers can never be waived.
  const blockers = input.issues.filter((i) => i.severity === "BLOCKER")
  for (const b of blockers) reasons.push(b.message)

  // 5. Warnings need an acknowledgement whose fingerprint still matches.
  const ackByIssue = new Map(input.acknowledgements.map((a) => [a.issueId, a]))
  const unacknowledgedWarnings = input.issues.filter((i) => {
    if (i.severity !== "WARNING") return false
    return !acknowledgementStillValid(ackByIssue.get(i.id), i.fingerprint)
  })
  for (const w of unacknowledgedWarnings) {
    reasons.push(`Unacknowledged warning: ${w.message}`)
  }

  return {
    publishable: reasons.length === 0,
    blockers,
    unacknowledgedWarnings,
    reasons,
  }
}

/** Legal analysis status transitions. Anything else is rejected and audited. */
const ALLOWED_TRANSITIONS: Record<AnalysisStatusT, AnalysisStatusT[]> = {
  PROCESSING: ["REVIEW_REQUIRED", "PARTIAL", "FAILED"],
  PARTIAL: ["REVIEW_REQUIRED", "FAILED", "SUPERSEDED"],
  REVIEW_REQUIRED: ["APPROVED", "FAILED", "SUPERSEDED"],
  APPROVED: ["SUPERSEDED"],
  FAILED: ["SUPERSEDED"],
  SUPERSEDED: [],
}

export function isLegalTransition(from: AnalysisStatusT, to: AnalysisStatusT): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function assertLegalTransition(from: AnalysisStatusT, to: AnalysisStatusT): void {
  if (!isLegalTransition(from, to)) {
    throw new Error(`Illegal analysis status transition: ${from} -> ${to}`)
  }
}
