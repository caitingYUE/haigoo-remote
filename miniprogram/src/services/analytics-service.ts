import Taro from '@tarojs/taro'
import { MINI_RELEASE_VERSION } from '../config/api'
import { createRequestKey, requestJson } from './api-client'
import { hasMiniSession } from './session'

interface MiniEventProperties {
  [key: string]: string | number | boolean | string[] | undefined
}

interface QueuedMiniEvent {
  eventId: string
  eventName: string
  path: string
  sentAt: string
  properties: MiniEventProperties
}

const eventQueue: QueuedMiniEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false

function currentPath() {
  const pages = Taro.getCurrentPages()
  const route = pages[pages.length - 1]?.route
  return route ? `/${route}` : '/mini'
}

export async function flushPendingMiniEvents() {
  if (flushing || !eventQueue.length || !hasMiniSession()) return
  flushing = true
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  const events = eventQueue.splice(0, 20)
  try {
    await requestJson('/mini/events', {
      method: 'POST',
      authenticated: true,
      data: { events, releaseVersion: MINI_RELEASE_VERSION }
    })
  } catch (error) {
    eventQueue.unshift(...events)
    if (eventQueue.length > 100) eventQueue.splice(0, eventQueue.length - 100)
    console.warn('[mini-analytics] batched delivery failed', events.map((event) => event.eventName), error)
  } finally {
    flushing = false
    if (eventQueue.length && hasMiniSession()) flushTimer = setTimeout(() => { void flushPendingMiniEvents() }, 5000)
  }
}

export function trackMiniEvent(eventName: string, properties: MiniEventProperties = {}) {
  eventQueue.push({
    eventId: createRequestKey('mini-event'),
    eventName,
    path: currentPath(),
    sentAt: new Date().toISOString(),
    properties: {
      ...properties,
      source_key: 'wechat_mini_program'
    }
  })
  if (eventQueue.length > 100) eventQueue.splice(0, eventQueue.length - 100)
  if (!hasMiniSession()) return Promise.resolve()
  if (eventQueue.length >= 10) void flushPendingMiniEvents()
  else if (!flushTimer) flushTimer = setTimeout(() => { void flushPendingMiniEvents() }, 1500)
  return Promise.resolve()
}

export function reportMiniError(error: unknown, component = 'app') {
  const message = error instanceof Error ? error.message : String(error || 'unknown')
  return trackMiniEvent('mini_client_error', {
    component,
    error_class: error instanceof Error ? error.name : 'UnhandledError',
    client_error: true,
    reason: message.slice(0, 120),
    severity: 'error'
  })
}
