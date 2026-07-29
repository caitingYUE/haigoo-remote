import assert from 'node:assert/strict'
import { isLeaseActive, stableJson, staleCleanupDecision, syncDecision } from './cloudrun/sync-policy.mjs'

const hour = 60 * 60 * 1000
const day = 24 * hour
const now = Date.UTC(2026, 6, 29, 12)
const readyState = {
  cacheReady: true,
  cursor: 'cursor-1',
  lastSyncAt: now - 10 * 60 * 1000,
  lastFullSyncAt: now - 12 * hour
}

assert.deepEqual(syncDecision({
  state: readyState,
  now,
  cacheRefreshMs: hour,
  fullSyncIntervalMs: day
}), { due: false, full: false }, 'fresh cache must not sync after a cold start')

assert.deepEqual(syncDecision({
  state: { ...readyState, lastSyncAt: now - hour },
  now,
  cacheRefreshMs: hour,
  fullSyncIntervalMs: day
}), { due: true, full: false }, 'hourly refresh must remain incremental')

assert.deepEqual(syncDecision({
  state: { ...readyState, lastFullSyncAt: now - day },
  now,
  cacheRefreshMs: hour,
  fullSyncIntervalMs: day
}), { due: true, full: true }, 'daily maintenance must eventually perform a full sync')

assert.equal(syncDecision({
  state: readyState,
  now,
  force: true,
  cacheRefreshMs: hour,
  fullSyncIntervalMs: day
}).full, true, 'manual force must request a full sync')

assert.equal(isLeaseActive({
  syncLeaseOwner: 'other-instance',
  syncLeaseExpiresAt: now + 60_000
}, now), true, 'another live instance must own the sync lease')

assert.equal(isLeaseActive({
  syncLeaseOwner: 'other-instance',
  syncLeaseExpiresAt: now - 1
}, now), false, 'expired leases must be recoverable')

assert.equal(
  stableJson({ b: 2, a: { d: 4, c: 3 } }),
  stableJson({ a: { c: 3, d: 4 }, b: 2 }),
  'job comparisons must not depend on object key order'
)

assert.equal(staleCleanupDecision({
  total: 414,
  stale: 2,
  maxRemovalRatio: 0.2
}).allowed, true, 'normal stale cleanup must remain enabled')

assert.deepEqual(staleCleanupDecision({
  total: 414,
  stale: 414,
  maxRemovalRatio: 0.2
}), {
  allowed: false,
  total: 414,
  stale: 414,
  active: 0,
  removalRatio: 1
}, 'an empty or truncated upstream snapshot must never erase the complete cache')

console.log('mini sync performance policy checks passed')
