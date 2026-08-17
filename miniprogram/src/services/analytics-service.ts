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

async function flushMiniEvents() {
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
    console.warn('[mini-analytics] batched delivery failed', events.map((event) => event.eventName), error)
  } finally {
    flushing = false
    if (eventQueue.length) flushTimer = setTimeout(() => { void flushMiniEvents() }, 1500)
  }
}

export function trackMiniEvent(eventName: string, properties: MiniEventProperties = {}) {
  if (!hasMiniSession()) return Promise.resolve()
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
  if (eventQueue.length >= 10) void flushMiniEvents()
  else if (!flushTimer) flushTimer = setTimeout(() => { void flushMiniEvents() }, 1500)
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
