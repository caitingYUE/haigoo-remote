import { getStorageSync, removeStorageSync, setStorageSync } from '@tarojs/taro'

export const MINI_SESSION_STORAGE_KEY = 'haigoo_mini_session'

interface MiniSession {
  token: string
  userId?: string | null
  username?: string
  email?: string
  avatar?: string
  isMember?: boolean
}

function getMiniSession(): MiniSession | null {
  const value = getStorageSync(MINI_SESSION_STORAGE_KEY)
  if (!value || typeof value !== 'object') return null
  const session = value as Partial<MiniSession>
  return session.token ? session as MiniSession : null
}

export function saveMiniSession(session: MiniSession) {
  setStorageSync(MINI_SESSION_STORAGE_KEY, session)
}

export function getMiniSessionToken(): string {
  return String(getMiniSession()?.token || '').trim()
}

export function getMiniSessionCacheKey(): string {
  const session = getMiniSession()
  const token = String(session?.token || '').trim()
  if (!token) return 'none'
  return `${session?.userId || 'anonymous'}:${token.slice(-16)}`
}

export function hasMiniSession(): boolean {
  return Boolean(getMiniSessionToken())
}

export function getMiniUser() {
  return getMiniSession()
}

export function clearMiniSession() {
  removeStorageSync(MINI_SESSION_STORAGE_KEY)
}

export function hasAuthenticatedSession(): boolean {
  return Boolean(getMiniSession()?.token && getMiniSession()?.userId)
}
