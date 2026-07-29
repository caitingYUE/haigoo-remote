function finiteTimestamp(value) {
  const timestamp = Number(value || 0)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function syncDecision({
  state = {},
  now = Date.now(),
  force = false,
  sourceChanged = false,
  cacheRefreshMs,
  fullSyncIntervalMs
} = {}) {
  const lastSyncAt = finiteTimestamp(state.lastSyncAt)
  const lastFullSyncAt = finiteTimestamp(state.lastFullSyncAt)
  const full = Boolean(
    force ||
    sourceChanged ||
    state.fullSyncInProgress ||
    !state.cacheReady ||
    !lastFullSyncAt ||
    now - lastFullSyncAt >= fullSyncIntervalMs
  )
  return {
    due: full || !lastSyncAt || now - lastSyncAt >= cacheRefreshMs,
    full
  }
}

export function isLeaseActive(state = {}, now = Date.now()) {
  return Boolean(
    state.syncLeaseOwner &&
    finiteTimestamp(state.syncLeaseExpiresAt) > now
  )
}

export function staleCleanupDecision({
  total = 0,
  stale = 0,
  maxRemovalRatio = 0.5
} = {}) {
  const safeTotal = Math.max(0, Number(total) || 0)
  const safeStale = Math.max(0, Math.min(safeTotal, Number(stale) || 0))
  const removalRatio = safeTotal > 0 ? safeStale / safeTotal : 0
  return {
    allowed: safeTotal === 0 || safeStale === 0 || removalRatio <= maxRemovalRatio,
    total: safeTotal,
    stale: safeStale,
    active: safeTotal - safeStale,
    removalRatio
  }
}
