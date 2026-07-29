import type { MiniJob } from '../types'
import { mapApiJob, type RawApiJob } from '../utils/job-format'
import { createRequestKey, requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'

export interface MiniSubscription {
  subscription_id?: string
  topic?: string
  preferences?: {
    topics?: string[]
    customTopic?: string | null
    customTopics?: string[]
  } | string | null
  status?: string
  updated_at?: string
}

interface SubscriptionResponse {
  subscriptions?: MiniSubscription[]
  jobs?: RawApiJob[]
  subscription?: MiniSubscription
  options?: SubscriptionOption[]
  limits?: SubscriptionLimits
}

export interface SubscriptionOption {
  value: string
  label: string
  count: number
}

export interface SubscriptionLimits {
  recommended: number
  maximum: number
}

export interface SubscriptionFeed {
  subscriptions: MiniSubscription[]
  jobs: MiniJob[]
  options: SubscriptionOption[]
  limits: SubscriptionLimits
}

export function getSubscriptionTopics(subscription?: MiniSubscription): string[] {
  if (!subscription) return []
  const preferences = typeof subscription.preferences === 'string'
    ? (() => {
        try { return JSON.parse(subscription.preferences) } catch { return null }
      })()
    : subscription.preferences
  const topics = Array.isArray(preferences?.topics)
    ? preferences.topics
    : String(subscription.topic || '').split(',')
  const customTopics = Array.isArray(preferences?.customTopics)
    ? preferences.customTopics
    : preferences?.customTopic
      ? [preferences.customTopic]
      : []
  return [...new Set([...topics, ...customTopics]
    .map((topic) => String(topic || '').trim())
    .filter(Boolean))]
}

export async function fetchSubscriptionFeed(): Promise<SubscriptionFeed> {
  const data = await requestJson<SubscriptionResponse>('/mini/subscriptions', { authenticated: true })
  return {
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    jobs: Array.isArray(data.jobs) ? data.jobs.map(mapApiJob).filter((job) => Boolean(job.id)) : [],
    options: Array.isArray(data.options)
      ? data.options
        .map((option) => ({
          value: String(option.value || '').trim(),
          label: String(option.label || option.value || '').trim(),
          count: Math.max(0, Number(option.count || 0))
        }))
        .filter((option) => Boolean(option.value))
      : [],
    limits: {
      recommended: Math.max(1, Number(data.limits?.recommended || 5)),
      maximum: Math.max(1, Number(data.limits?.maximum || 8))
    }
  }
}

export async function saveSubscriptionTopics(topics: string[]) {
  const data = await requestJson<SubscriptionResponse>('/mini/subscriptions', {
    method: 'POST',
    authenticated: true,
    data: { topics, idempotencyKey: createRequestKey('subscription-save') }
  })
  void trackMiniEvent('mini_subscription_saved', { result_count: topics.length, status: 'succeeded' })
  return data.subscription
}
