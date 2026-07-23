import Taro from '@tarojs/taro'
import { MINI_RELEASE_VERSION } from '../config/api'
import { createRequestKey, requestJson } from './api-client'
import { hasMiniSession } from './session'

interface MiniEventProperties {
  [key: string]: string | number | boolean | string[] | undefined
}

function currentPath() {
  const pages = Taro.getCurrentPages()
  const route = pages[pages.length - 1]?.route
  return route ? `/${route}` : '/mini'
}

export function trackMiniEvent(eventName: string, properties: MiniEventProperties = {}) {
  if (!hasMiniSession()) return Promise.resolve()
  const event = {
    eventId: createRequestKey('mini-event'),
    eventName,
    path: currentPath(),
    sentAt: new Date().toISOString(),
    properties: {
      ...properties,
      source_key: 'wechat_mini_program'
    }
  }
  return requestJson('/mini/events', {
    method: 'POST',
    authenticated: true,
    data: { events: [event], releaseVersion: MINI_RELEASE_VERSION }
  }).then(() => undefined).catch((error) => {
    console.warn('[mini-analytics] event delivery failed', eventName, error)
  })
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
