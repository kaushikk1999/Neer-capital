// Centralized rate-limit policy. These are INITIAL PRODUCTION DEFAULTS chosen to
// be conservative and NAT-friendly (schools/offices/mobile carriers share IPs),
// not universal constants. Tune here without touching endpoint logic.
//
// `limit` is the number of requests ALLOWED within `windowMs`; the next request
// is blocked until the window resets (bounded auto-recovery — never a permanent
// lockout). Progressive enforcement for login is expressed as two stacked
// windows (short burst + longer observation) rather than long request sleeps.

export type Limit = { limit: number; windowMs: number }

const MIN = 60_000
const HOUR = 60 * MIN

export const POLICY = {
  login: {
    // Broad per-IP burst, enforced BEFORE any DB lookup or bcrypt.
    ip: { limit: 30, windowMs: 5 * MIN } as Limit,
    // Failed-attempt counters per normalized account and per IP+account.
    // Two windows give escalating protection with automatic recovery.
    accountShort: { limit: 5, windowMs: 5 * MIN } as Limit,
    accountLong: { limit: 20, windowMs: HOUR } as Limit,
    ipAccount: { limit: 8, windowMs: 15 * MIN } as Limit,
    // Stricter thresholds for administrator accounts (never disclosed publicly).
    adminAccountShort: { limit: 3, windowMs: 5 * MIN } as Limit,
    adminAccountLong: { limit: 8, windowMs: HOUR } as Limit,
  },
  register: {
    ip: { limit: 5, windowMs: HOUR } as Limit,
    ipEmail: { limit: 3, windowMs: HOUR } as Limit,
    // Supplemental, spoofable device/browser signal scoped to the IP.
    deviceIp: { limit: 8, windowMs: HOUR } as Limit,
  },
  forgot: {
    ip: { limit: 5, windowMs: HOUR } as Limit,
    account: { limit: 3, windowMs: HOUR } as Limit,
    ipAccount: { limit: 3, windowMs: HOUR } as Limit,
    // Short email-send cooldown so one address cannot be flooded.
    cooldown: { limit: 1, windowMs: 60_000 } as Limit,
  },
  reset: {
    ip: { limit: 20, windowMs: 15 * MIN } as Limit,
    account: { limit: 10, windowMs: 15 * MIN } as Limit,
    ipAccount: { limit: 10, windowMs: 15 * MIN } as Limit,
    // Opaque fingerprint of the submitted token — caps invalid-token brute force
    // without ever storing the raw token.
    tokenFp: { limit: 10, windowMs: 15 * MIN } as Limit,
  },
} as const

/** Short timeout for any single limiter store operation (fail-closed on exceed). */
export const LIMITER_TIMEOUT_MS = 1500
