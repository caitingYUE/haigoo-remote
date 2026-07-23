export const CLOUD_ENV_ID = String(process.env.TARO_APP_CLOUD_ENV || '').trim()
export const CLOUD_SERVICE_NAME = String(process.env.TARO_APP_CLOUD_SERVICE || 'haigoo-mini').trim()
export const MINI_RELEASE_VERSION = String(process.env.TARO_APP_RELEASE_VERSION || 'development').trim()

export function resolvePublicUrl(value?: string): string | undefined {
  const url = String(value || '').trim()
  if (!url) return undefined
  if (url.startsWith('cloud://')) return url
  if (/^https?:\/\//i.test(url)) return url
  // All remote assets returned to the Mini Program should already be CloudBase
  // files. Returning undefined makes an unsafe/unconfigured image fall back to
  // the in-app company icon rather than a non-whitelisted web origin.
  return undefined
}
