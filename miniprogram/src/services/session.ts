import { getStorageSync, removeStorageSync, setStorageSync } from '@tarojs/taro'
import { CLOUD_ENV_ID } from '../config/api'

const LEGACY_MINI_SESSION_STORAGE_KEY = 'haigoo_mini_session'
const PRODUCTION_CLOUD_ENV_ID = 'cloud1-d8ggt7rbl273f83c7'

export const MINI_SESSION_STORAGE_KEY = `${LEGACY_MINI_SESSION_STORAGE_KEY}:${CLOUD_ENV_ID || 'default'}`

// A token renewal is not an account change. Logout/rebinding starts new page memory.
let accountGeneration = 0

interface MiniSession {
  token: string
  userId?: string | null
  username?: string
  email?: string
  avatar?: string
  isMember?: boolean
  memberType?: string
  memberExpireAt?: string | null
}

function getMiniSession(): MiniSession | null {
  let value = getStorageSync(MINI_SESSION_STORAGE_KEY)
  // Keep existing production logins after the scoped-key upgrade, while never
  // importing a production token into a development/experience environment.
  if ((!value || typeof value !== 'object') && CLOUD_ENV_ID === PRODUCTION_CLOUD_ENV_ID) {
    value = getStorageSync(LEGACY_MINI_SESSION_STORAGE_KEY)
    if (value && typeof value === 'object') {
      setStorageSync(MINI_SESSION_STORAGE_KEY, value)
      removeStorageSync(LEGACY_MINI_SESSION_STORAGE_KEY)
    }
  }
  if (!value || typeof value !== 'object') return null
  const session = value as Partial<MiniSession>
  return session.token ? session as MiniSession : null
}

export function saveMiniSession(session: MiniSession) {
  const previous = getMiniSession()
  if (!previous || previous.userId !== session.userId) accountGeneration++
  setStorageSync(MINI_SESSION_STORAGE_KEY, session)
}

export function getMiniSessionToken(): string {
  return String(getMiniSession()?.token || '').trim()
}

export function getMiniSessionCacheKey(): string {
  const session = getMiniSession()
  const token = String(session?.token || '').trim()
  if (!token) return 'none'
  return `${session?.userId || `anonymous:${token.slice(-16)}`}:${accountGeneration}`
}

export function hasMiniSession(): boolean {
  return Boolean(getMiniSessionToken())
}

export function getMiniUser() {
  return getMiniSession()
}

export function clearMiniSession() {
  const previous = getMiniSession()
  if (previous?.userId) removeStorageSync(careerWatchStorageKey(previous.userId))
  removeStorageSync('haigoo:match-intent')
  accountGeneration++
  removeStorageSync(MINI_SESSION_STORAGE_KEY)
  if (CLOUD_ENV_ID === PRODUCTION_CLOUD_ENV_ID) {
    removeStorageSync(LEGACY_MINI_SESSION_STORAGE_KEY)
  }
}

export function hasAuthenticatedSession(): boolean {
  return Boolean(getMiniSession()?.token && getMiniSession()?.userId)
}

export function careerWatchStorageKey(userId: string) {
  return `haigoo-career-watch:${CLOUD_ENV_ID || 'default'}:${userId}`
}
