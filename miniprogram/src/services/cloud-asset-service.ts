import Taro from '@tarojs/taro'

const STORAGE_KEY = 'haigoo.cloud-assets.v2'
const DEFAULT_TTL_MS = 60 * 60 * 1000
const CACHE_LIMIT = 400
const urlCache = new Map<string, { url: string; expiresAt: number }>()
const inFlight = new Map<string, Promise<void>>()
let cacheLoaded = false

export function isRenderableImageSource(value: unknown): value is string {
  const source = String(value || '').trim()
  return /^https?:\/\//i.test(source) || /^cloud:\/\//i.test(source)
}

function pruneCache() {
  for (const [fileId, value] of urlCache) {
    if (value.expiresAt <= Date.now()) urlCache.delete(fileId)
  }
  while (urlCache.size > CACHE_LIMIT) urlCache.delete(urlCache.keys().next().value!)
}

function loadCache() {
  if (cacheLoaded) return
  cacheLoaded = true
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return
    for (const [fileId, value] of Object.entries(stored as Record<string, { url?: string; expiresAt?: number }>)) {
      if (fileId.startsWith('cloud://') && typeof value?.url === 'string' && /^https?:\/\//i.test(value.url)
        && Number.isFinite(value.expiresAt) && Number(value.expiresAt) > Date.now()) {
        urlCache.set(fileId, { url: value.url, expiresAt: Number(value.expiresAt) })
      }
    }
    pruneCache()
  } catch { /* Storage is optional; image resolution must still work. */ }
}

function persistCache() {
  pruneCache()
  try { Taro.setStorageSync(STORAGE_KEY, Object.fromEntries(urlCache)) }
  catch { /* Full or unavailable storage must not fail the content request. */ }
}

export function invalidateCloudFileUrl(fileId: string) {
  loadCache()
  if (urlCache.delete(fileId)) persistCache()
}

export async function resolveCloudFileUrls(fileIds: Array<string | undefined>) {
  loadCache()
  pruneCache()
  const values = [...new Set(fileIds.map((value) => String(value || '').trim()).filter(isRenderableImageSource))]
  const resolved = new Map<string, string>()
  const pending: string[] = []
  const waiting = new Set<Promise<void>>()

  for (const value of values) {
    const cached = urlCache.get(value)
    resolved.set(value, cached?.url || value)
    if (!value.startsWith('cloud://') || cached) continue
    const existing = inFlight.get(value)
    if (existing) waiting.add(existing)
    else pending.push(value)
  }

  let previousBatch = Promise.resolve()
  for (let index = 0; index < pending.length; index += 50) {
    const fileList = pending.slice(index, index + 50)
    // Register before starting the batch, so concurrent pages share one lookup.
    const request = previousBatch.then(async () => {
      try {
        const response = await Taro.cloud.getTempFileURL({ fileList })
        for (const item of response.fileList || []) {
          if (!fileList.includes(item.fileID) || item.status !== 0 || !/^https?:\/\//i.test(item.tempFileURL || '')) continue
          const maxAgeSeconds = Number(item.maxAge)
          const ttl = Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0
            ? Math.min(maxAgeSeconds * 1000, DEFAULT_TTL_MS) : DEFAULT_TTL_MS
          // Refresh before expiry; never extend the server-provided lifetime.
          const cached = { url: item.tempFileURL, expiresAt: Date.now() + ttl * 0.9 }
          urlCache.set(item.fileID, cached)
          resolved.set(item.fileID, cached.url)
        }
        persistCache()
      } catch (error) {
        console.warn('[mini-assets] temporary URL resolution failed', error)
      } finally {
        for (const fileId of fileList) inFlight.delete(fileId)
      }
    })
    for (const fileId of fileList) inFlight.set(fileId, request)
    waiting.add(request)
    // Bound native cloud concurrency as well as the size of each batch.
    previousBatch = request
  }

  await Promise.all(waiting)
  for (const value of values) {
    const cached = urlCache.get(value)
    if (cached && cached.expiresAt > Date.now()) resolved.set(value, cached.url)
  }
  return resolved
}
