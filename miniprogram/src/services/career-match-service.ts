import type {
  CareerCompleteness,
  CareerIntake,
  CareerMatchResult,
  CareerMatchState,
  CareerRetentionPolicy
} from '../types'
import { createRequestKey, requestJson } from './api-client'

export const CAREER_PRIVACY_VERSION = '2026-08-14-match-v1'

export function fetchCareerMatchState() {
  return requestJson<CareerMatchState>('/mini/match', { authenticated: true })
}

export function fetchMatchFeed() {
  return requestJson<MatchFeedResponse>('/mini/match/feed', { authenticated: true })
}

export function createMatchApplyTicket(companyId: string) {
  return requestJson<{ success: true; url: string; expiresInSeconds: number }>('/mini/match/apply-ticket', {
    method: 'POST', authenticated: true, data: { companyId }
  })
}

export function followCompany(companyId: string) {
  return requestJson<{ success: true; companyId: string; followed: boolean }>('/mini/match/follows', {
    method: 'POST', authenticated: true, data: { companyId, followed: true }
  })
}

export function unfollowCompany(companyId: string) {
  return requestJson<{ success: true; companyId: string; followed: boolean }>(`/mini/match/follows/${encodeURIComponent(companyId)}`, {
    method: 'DELETE', authenticated: true
  })
}

export function sendMatchFeedback(companyId: string, action: 'opened' | 'dismissed' | 'seen') {
  return requestJson<{ success: true }>('/mini/match/feedback', {
    method: 'POST', authenticated: true, data: { companyId, action }
  })
}

export function setMatchNotifications(companyId: string, enabled: boolean, templateStatus: string) {
  return requestJson<{ success: true; enabled: boolean; templateStatus: string }>(`/mini/match/follows/${encodeURIComponent(companyId)}/notifications`, {
    method: 'POST', authenticated: true, data: { enabled, templateStatus }
  })
}

export function parseCareerResume(filename: string, fileBase64: string) {
  return requestJson<{
    success: true
    sourceType: 'resume'
    careerText: string
    structured: Record<string, unknown>
    completeness: CareerCompleteness
    rawFileStored: false
    message: string
  }>('/mini/match/resume/parse', {
    method: 'POST',
    authenticated: true,
    data: { filename, fileBase64 }
  })
}

export function saveCareerProfile(data: {
  sourceType: 'manual' | 'resume'
  careerText: string
  intake: CareerIntake
  retentionPolicy: CareerRetentionPolicy
  consentedAt: string
}) {
  return requestJson<{
    success: true
    stored: boolean
    profile: Record<string, unknown>
    completeness: CareerCompleteness
  }>('/mini/match/profile', {
    method: 'PUT',
    authenticated: true,
    data: { ...data, privacyVersion: CAREER_PRIVACY_VERSION }
  })
}

export function analyzeCareerProfile(data: {
  retentionPolicy: CareerRetentionPolicy
  careerText?: string
  intake?: CareerIntake
  answers?: Array<{ question: string; answer: string }>
}) {
  return requestJson<{
    success: true
    status: 'needs_clarification' | 'ready'
    result: CareerMatchResult
    rawFileStored: false
    stored: boolean
  }>('/mini/match/analyze', {
    method: 'POST',
    authenticated: true,
    timeout: 120000,
    data: { ...data, idempotencyKey: createRequestKey('career-match') }
  })
}

export function deleteCareerData() {
  return requestJson<{ success: true; deleted: boolean; message: string }>('/mini/match/data', {
    method: 'DELETE',
    authenticated: true
  })
}

export interface MatchRecommendation {
  companyId: string
  name: string
  industry: string
  description: string
  logoFileId?: string
  logoUrl?: string
  fitBand: 'high' | 'notable' | 'explore'
  reasons: string[]
  evidenceSummary: string
  hasPublicOpportunity: boolean
  isFollowed: boolean
  hasUpdate: boolean
}

export interface MatchFeedResponse {
  success: true
  profile: {
    exists: boolean
    completeness: number
    retentionPolicy?: CareerRetentionPolicy
    expiresAt?: string | null
    updatedAt?: string | null
  }
  recommendations: MatchRecommendation[]
  followedUpdates: Array<Record<string, unknown>>
  meta: {
    source: 'cached' | 'recomputed'
    hasNewData: boolean
    poolExhausted: boolean
    generatedAt: string
    algorithmVersion: string
  }
  capabilities: {
    isMember: boolean
    maxRecommendations: number
    maxFollows: number | null
    wechatTemplateId: string
  }
}
