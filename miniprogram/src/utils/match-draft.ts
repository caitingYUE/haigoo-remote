import Taro from '@tarojs/taro'
import type { CareerIntake, CareerRetentionPolicy } from '../types'

const MATCH_DRAFT_KEY = 'haigoo.match.draft.v2'
const LEGACY_MATCH_DRAFT_KEY = 'haigoo.match.draft.v1'
const MATCH_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export interface LocalMatchDraft {
  sourceType: 'manual' | 'resume'
  careerText: string
  intake: CareerIntake
  retention: CareerRetentionPolicy
  consented: boolean
  updatedAt: string
}

function redactLocalCareerText(value: string) {
  const lines = String(value || '').split('\n')
  const withoutName = lines.map((line, index) => {
    if (index > 2) return line
    const nearby = lines.slice(index + 1, index + 4).join(' ')
    const looksLikeName = /^[\u3400-\u9fff·]{2,5}$/.test(line.trim()) || /^[A-Za-z]+(?:[ '-][A-Za-z]+){1,3}$/.test(line.trim())
    const hasContactNearby = /@|(?:电话|手机|邮箱|微信|wechat|phone|mobile|email)|\+?\d[\d\s().-]{7,}/i.test(nearby)
    return looksLikeName && hasContactNearby ? '[已移除姓名]' : line
  }).join('\n')
  return withoutName
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[已移除邮箱]')
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, '[已移除电话]')
    .replace(/(?:电话|手机|邮箱|微信|wechat|phone|mobile|email)\s*[:：]?\s*\S+/gi, '[已移除联系方式]')
    .replace(/(?:QQ|钉钉|telegram)\s*[:：]?\s*\S+/gi, '[已移除联系方式]')
    .trim()
}

export function clearLocalMatchDraft() {
  Taro.removeStorageSync(MATCH_DRAFT_KEY)
  Taro.removeStorageSync(LEGACY_MATCH_DRAFT_KEY)
}

export function readLocalMatchDraft(): LocalMatchDraft | null {
  Taro.removeStorageSync(LEGACY_MATCH_DRAFT_KEY)
  const value = Taro.getStorageSync(MATCH_DRAFT_KEY) as Partial<LocalMatchDraft> | undefined
  const updatedAt = new Date(String(value?.updatedAt || '')).getTime()
  if (!value || !Number.isFinite(updatedAt) || Date.now() - updatedAt > MATCH_DRAFT_TTL_MS || value.retention === 'session') {
    clearLocalMatchDraft()
    return null
  }
  return value as LocalMatchDraft
}

export function saveLocalMatchDraft(draft: Omit<LocalMatchDraft, 'updatedAt'>) {
  if (draft.retention === 'session') {
    clearLocalMatchDraft()
    return false
  }
  Taro.setStorageSync(MATCH_DRAFT_KEY, {
    ...draft,
    careerText: redactLocalCareerText(draft.careerText),
    updatedAt: new Date().toISOString()
  })
  return true
}
