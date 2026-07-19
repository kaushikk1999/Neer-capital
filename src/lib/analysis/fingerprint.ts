/**
 * Stable identity for a validation issue.
 *
 * An acknowledgement ("I have reviewed this warning and accept it") must stay
 * valid while the underlying problem is unchanged, and must fall away the
 * moment the problem itself changes. Keying that on the analysis revision
 * would invalidate every acknowledgement whenever any unrelated field is
 * edited, so we key it on a fingerprint of the issue itself instead.
 */

import { createHash } from "crypto"

export interface FingerprintInput {
  code: string
  entityType: string
  entityId?: string | null
  /**
   * The values the issue is actually about. Only include what would make this
   * a *different* problem if it changed — not incidental context.
   */
  valueSnapshot: unknown
}

/** Deterministic JSON: object keys sorted so key order can never change the hash. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
  return `{${entries.join(",")}}`
}

export function issueFingerprint(input: FingerprintInput): string {
  const canonical = stableStringify({
    code: input.code,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    valueSnapshot: input.valueSnapshot,
  })
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32)
}

/**
 * An acknowledgement survives only while the issue it was given for is
 * literally the same problem.
 */
export function acknowledgementStillValid(
  ack: { fingerprint: string } | null | undefined,
  currentFingerprint: string
): boolean {
  return !!ack && ack.fingerprint === currentFingerprint
}
