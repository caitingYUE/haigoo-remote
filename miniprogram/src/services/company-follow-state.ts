import Taro from '@tarojs/taro'
import { invalidateMiniResource } from './retained-resource-cache'
import { careerWatchStorageKey, getMiniUser, getMiniSessionCacheKey, hasAuthenticatedSession } from './session'
import { requestJson } from './api-client'

export const COMPANY_FOLLOW_CHANGE_EVENT = 'haigoo:company-follow-change'

export interface CompanyFollowChange {
  companyId: string
  followed: boolean
  reminderEnabled: boolean
}

type ReminderSnapshot = { follows: Array<{ company_id: string; wechat_enabled?: boolean; wechat_template_status?: string }> }
let reminderRevision = 0
let reminderSnapshot: { scope: string; at: number; value: ReminderSnapshot } | null = null
let reminderRequest: { scope: string; revision: number; promise: Promise<ReminderSnapshot | null> } | null = null

export function invalidateReminderSnapshot() {
  reminderRevision++
  reminderSnapshot = null
}

// One quiet, shared status read per minute on page return; never refresh cards or scroll.
export function refreshCompanyReminderSnapshot(): Promise<ReminderSnapshot | null> {
  if (!hasAuthenticatedSession()) return Promise.resolve(null)
  const scope = getMiniSessionCacheKey()
  if (reminderSnapshot?.scope === scope && Date.now() - reminderSnapshot.at < 60_000) return Promise.resolve(reminderSnapshot.value)
  if (reminderRequest?.scope === scope && reminderRequest.revision === reminderRevision) return reminderRequest.promise
  const revision = reminderRevision
  const promise = requestJson<ReminderSnapshot>('/mini/match/follows', { authenticated: true }).then(value => {
    if (scope !== getMiniSessionCacheKey() || revision !== reminderRevision) return null
    reminderSnapshot = { scope, at: Date.now(), value }
    return value
  }).catch(() => null).finally(() => {
    if (reminderRequest?.promise === promise) reminderRequest = null
  })
  reminderRequest = { scope, revision, promise }
  return promise
}

export function emitCompanyFollowChange(change: CompanyFollowChange) {
  invalidateReminderSnapshot()
  invalidateMiniResource('profile-dashboard')
  const userId = getMiniUser()?.userId
  if (userId) {
    const key = careerWatchStorageKey(userId)
    try {
      const cached = Taro.getStorageSync(key)
      if (cached && Array.isArray(cached.recommendations)) {
        Taro.setStorageSync(key, {
          ...cached,
          recommendations: cached.recommendations.map((item: { companyId?: string }) => String(item.companyId) === change.companyId
            ? { ...item, isFollowed: change.followed, isSubscribed: change.followed && change.reminderEnabled }
            : item)
        })
      }
    } catch { /* The server remains authoritative when local storage is unavailable. */ }
  }
  Taro.eventCenter.trigger(COMPANY_FOLLOW_CHANGE_EVENT, change)
}

export function onCompanyFollowChange(listener: (change: CompanyFollowChange) => void) {
  Taro.eventCenter.on(COMPANY_FOLLOW_CHANGE_EVENT, listener)
  return () => { Taro.eventCenter.off(COMPANY_FOLLOW_CHANGE_EVENT, listener) }
}
