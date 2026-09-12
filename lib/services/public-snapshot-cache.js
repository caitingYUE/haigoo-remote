// Only cache public query results after the caller has checked current access.
export function createPublicSnapshotCache({ ttlMs, maxEntries = 128, now = Date.now }) {
  const entries = new Map()
  return async function read(key, load) {
    for (const [cacheKey, entry] of entries) {
      if (!entry.pending && entry.expiresAt <= now()) entries.delete(cacheKey)
    }
    let entry = entries.get(key)
    if (!entry) {
      entry = { pending: true, expiresAt: 0, promise: null }
      entry.promise = Promise.resolve().then(load).then(value => {
        entry.pending = false
        entry.expiresAt = now() + ttlMs
        return value
      }).catch(error => {
        if (entries.get(key) === entry) entries.delete(key)
        throw error
      })
      entries.set(key, entry)
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value)
    }
    // A caller enriching a result must not mutate the next caller's snapshot.
    return structuredClone(await entry.promise)
  }
}
