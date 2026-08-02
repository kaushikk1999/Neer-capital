import { test } from "node:test"
import assert from "node:assert/strict"

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-secret-for-rate-limit"

import {
  consume, peek, record, reset, deriveKey,
  __setRateLimitStoreForTests, RateLimiterUnavailable, type RateLimitStore,
} from "./rate-limit"

// Serialized in-memory fake (TEST-ONLY). Mirrors the fixed-window contract and
// serializes hits so concurrency behaves like the production row lock.
function fakeStore(): RateLimitStore {
  const rows = new Map<string, { count: number; resetAt: Date }>()
  let chain: Promise<unknown> = Promise.resolve()
  const serialize = <T>(fn: () => T): Promise<T> => {
    const run = chain.then(fn)
    chain = run.catch(() => {})
    return run as Promise<T>
  }
  return {
    hit: (key, windowMs) => serialize(() => {
      const now = Date.now()
      const cur = rows.get(key)
      if (!cur || cur.resetAt.getTime() <= now) {
        const r = { count: 1, resetAt: new Date(now + windowMs) }
        rows.set(key, r); return { ...r }
      }
      cur.count += 1; return { ...cur }
    }),
    peek: (key) => serialize(() => {
      const cur = rows.get(key)
      if (!cur || cur.resetAt.getTime() <= Date.now()) return null
      return { ...cur }
    }),
    reset: (keys) => serialize(() => { for (const k of keys) rows.delete(k) }),
  }
}

const R = (id: string, limit = 3, windowMs = 60_000) => ({ namespace: "t:x", id, limit, windowMs })

test("allows up to the limit then blocks", async () => {
  __setRateLimitStoreForTests(fakeStore())
  const rule = [R("a", 3)]
  assert.equal((await consume(rule)).ok, true) // 1
  assert.equal((await consume(rule)).ok, true) // 2
  assert.equal((await consume(rule)).ok, true) // 3
  const d = await consume(rule)                // 4 -> blocked
  assert.equal(d.ok, false)
  if (!d.ok) assert.ok(d.retryAfterSec > 0 && d.retryAfterSec <= 60)
})

test("namespaces do not collide", async () => {
  __setRateLimitStoreForTests(fakeStore())
  for (let i = 0; i < 4; i++) await consume([{ namespace: "ns:a", id: "x", limit: 3, windowMs: 60_000 }])
  // Same id, different namespace — unaffected.
  assert.equal((await consume([{ namespace: "ns:b", id: "x", limit: 3, windowMs: 60_000 }])).ok, true)
})

test("derived keys expose no raw PII", () => {
  const k = deriveKey("login:account", "victim@example.com")
  assert.ok(k.startsWith("login:account:"))
  assert.ok(!k.includes("victim@example.com"))
  assert.ok(!k.includes("victim"))
})

test("peek does not increment; record does; reset clears", async () => {
  __setRateLimitStoreForTests(fakeStore())
  const rule = [R("acct", 2)]
  assert.equal((await peek(rule)).ok, true)       // nothing recorded yet
  await record(rule); await record(rule)           // count = 2 (at limit)
  assert.equal((await peek(rule)).ok, false)       // at/over limit -> blocked
  await reset([{ namespace: "t:x", id: "acct" }])  // cleared
  assert.equal((await peek(rule)).ok, true)
})

test("concurrent hits cannot exceed the limit", async () => {
  __setRateLimitStoreForTests(fakeStore())
  const rule = [R("race", 5)]
  const results = await Promise.all(Array.from({ length: 20 }, () => consume(rule)))
  const allowed = results.filter((r) => r.ok).length
  assert.equal(allowed, 5) // exactly the limit, never more
})

test("store failure => RateLimiterUnavailable (fail closed)", async () => {
  __setRateLimitStoreForTests({
    hit: async () => { throw new Error("db down") },
    peek: async () => { throw new Error("db down") },
    reset: async () => {},
  })
  await assert.rejects(() => consume([R("x")]), RateLimiterUnavailable)
  await assert.rejects(() => peek([R("x")]), RateLimiterUnavailable)
})

test("expired window resets the counter", async () => {
  __setRateLimitStoreForTests(fakeStore())
  const rule = [R("exp", 1, 1)] // 1ms window
  assert.equal((await consume(rule)).ok, true)
  await new Promise((r) => setTimeout(r, 5))
  assert.equal((await consume(rule)).ok, true) // window elapsed -> allowed again
})

__setRateLimitStoreForTests(null)
