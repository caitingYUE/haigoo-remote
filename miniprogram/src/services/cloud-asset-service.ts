import Taro from '@tarojs/taro'

const STORAGE_KEY = 'haigoo.cloud-assets.v1'
const DEFAULT_TTL_MS = 60 * 60 * 1000
const urlCache = new Map<string, { url: string; expiresAt: number }>()
let cacheLoaded = false

function loadCache() {
  if (cacheLoaded) return
  cacheLoaded = true
  const stored = Taro.getStorageSync(STORAGE_KEY)
  if (!stored || typeof stored !== 'object') return
  for (const [fileId, value] of Object.entries(stored as Record<string, { url?: string; expiresAt?: number }>)) {
    if (value?.url && Number(value.expiresAt) > Date.now()) {
      urlCache.set(fileId, { url: value.url, expiresAt: Number(value.expiresAt) })
    }
  }
}

function persistCache() {
  const active = [...urlCache.entries()]
    .filter(([, value]) => value.expiresAt > Date.now())
    .slice(-400)
  Taro.setStorageSync(STORAGE_KEY, Object.fromEntries(active))
}

export async function resolveCloudFileUrls(fileIds: Array<string | undefined>) {
  loadCache()
  const values = [...new Set(fileIds.map((value) => String(value || '').trim()).filter(Boolean))]
  const resolved = new Map<string, string>()
  const pending: string[] = []

  for (const value of values) {
    if (/^https?:\/\//i.test(value)) {
      resolved.set(value, value)
      continue
    }
    if (!value.startsWith('cloud://')) continue
    const cached = urlCache.get(value)
    if (cached && cached.expiresAt > Date.now()) resolved.set(value, cached.url)
    else pending.push(value)
  }

  for (let index = 0; index < pending.length; index += 50) {
    const fileList = pending.slice(index, index + 50)
    try {
      const response = await Taro.cloud.getTempFileURL({ fileList })
      for (const item of response.fileList || []) {
        if (item.status !== 0 || !item.tempFileURL) continue
        const ttl = Number(item.maxAge) > 0 ? Math.min(Number(item.maxAge), DEFAULT_TTL_MS) : DEFAULT_TTL_MS
        const cached = { url: item.tempFileURL, expiresAt: Date.now() + ttl }
        urlCache.set(item.fileID, cached)
        resolved.set(item.fileID, cached.url)
      }
    } catch (error) {
      console.warn('[mini-assets] temporary URL resolution failed', error)
    }
  }

  if (pending.length) persistCache()
  return resolved
}
