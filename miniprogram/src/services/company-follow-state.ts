import Taro from '@tarojs/taro'
import { invalidateMiniResource } from './retained-resource-cache'
import { careerWatchStorageKey, getMiniUser } from './session'

export const COMPANY_FOLLOW_CHANGE_EVENT = 'haigoo:company-follow-change'

export interface CompanyFollowChange {
  companyId: string
  followed: boolean
  reminderEnabled: boolean
}

export function emitCompanyFollowChange(change: CompanyFollowChange) {
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
