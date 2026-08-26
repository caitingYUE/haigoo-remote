import Taro from '@tarojs/taro'
import { CLOUD_ENV_ID, CLOUD_SERVICE_NAME } from '../config/api'
import { clearMiniSession, getMiniSessionToken } from './session'

// Pages can issue requests before React effects run. Initialise CloudBase as
// soon as the shared transport is loaded so the first callContainer is valid.
if (process.env.TARO_ENV === 'weapp' && CLOUD_ENV_ID) {
  Taro.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  authenticated?: boolean
  timeout?: number
}

interface TaroRequestFailure {
  errMsg?: string
  errno?: number
}

export class ApiRequestError extends Error {
  statusCode: number
  payload: Record<string, unknown>

  constructor(message: string, statusCode = 0, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.payload = payload
  }
}

export function createRequestKey(scope: string) {
  const safeScope = String(scope || 'request').replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 48)
  return `${safeScope}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function getRequestFailureMessage(error: unknown): string {
  const failure = error && typeof error === 'object'
    ? error as TaroRequestFailure
    : {}
  const detail = String(failure.errMsg || (error instanceof Error ? error.message : '')).trim()
  const normalized = detail.toLowerCase()

  if (normalized.includes('url not in domain list') || normalized.includes('合法域名')) {
    return '当前服务暂时不可用，请稍后再试'
  }
  if (normalized.includes('timeout')) {
    return '加载时间有点久，请检查网络后重试'
  }
  if (
    normalized.includes('ssl') ||
    normalized.includes('certificate') ||
    normalized.includes('tls')
  ) {
    return '当前无法安全连接服务，请稍后再试'
  }
  if (normalized.includes('network') || normalized.includes('request:fail')) {
    return '网络连接失败，请检查网络后重试'
  }
  return '网络请求失败，请稍后重试'
}

function getResponseFailureMessage(statusCode: number, upstreamMessage: string) {
  const safeChineseMessage = /[\u3400-\u9fff]/.test(upstreamMessage) &&
    !/(?:sql|database|gateway|cloud|token|stack|internal|not found|接口|服务端|上游)/i.test(upstreamMessage)
      ? upstreamMessage
      : ''
  if (statusCode === 400 && safeChineseMessage) return safeChineseMessage
  if (statusCode === 401) return safeChineseMessage || '登录状态已过期，请重新登录'
  if (statusCode === 403) return safeChineseMessage || '当前账号暂时无法使用这项服务'
  if (statusCode === 404) return '内容暂时无法打开，请稍后重试'
  if (statusCode === 409) return safeChineseMessage || '内容已经更新，请重新加载'
  if (statusCode === 429) return '操作有些频繁，请稍后再试'
  if (statusCode >= 500) return '服务繁忙，请稍后重试'
  return safeChineseMessage || '请求没有完成，请稍后重试'
}

function parseJsonResponse<T>(data: T | string): T {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data) as T
  } catch {
    throw new ApiRequestError('返回内容有误，请稍后重试')
  }
}

export async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  if (!CLOUD_ENV_ID) {
    throw new ApiRequestError('当前服务尚未开放')
  }
  let response
  try {
    response = await Taro.cloud.callContainer<T | string>({
      config: { env: CLOUD_ENV_ID },
      path,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 30000,
      header: {
        Accept: 'application/json',
        // Cloud Hosting can contain multiple services. This is required by
        // callContainer to route the Mini Program request to haigoo-mini.
        'X-WX-SERVICE': CLOUD_SERVICE_NAME,
        ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        ...(options.authenticated && getMiniSessionToken()
          ? { Authorization: `Bearer ${getMiniSessionToken()}` }
          : {})
      }
    })
  } catch (error) {
    const message = getRequestFailureMessage(error)
    console.error('[Haigoo API] request failed', {
      path,
      env: CLOUD_ENV_ID,
      service: CLOUD_SERVICE_NAME,
      message,
      detail: error
    })
    throw new ApiRequestError(message, 0, {
      path,
      errMsg: String(
        error && typeof error === 'object' && 'errMsg' in error
          ? (error as TaroRequestFailure).errMsg || ''
          : ''
      )
    })
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const payload = response.data && typeof response.data === 'object'
      ? response.data as Record<string, unknown>
      : {}
    const upstreamMessage = String(payload.error || payload.message || '')
    const message = getResponseFailureMessage(response.statusCode, upstreamMessage)
    console.error('[Haigoo API] response failed', {
      path,
      env: CLOUD_ENV_ID,
      service: CLOUD_SERVICE_NAME,
      statusCode: response.statusCode,
      code: String(payload.code || '')
    })
    if (response.statusCode === 401) clearMiniSession()
    throw new ApiRequestError(message, response.statusCode, payload)
  }

  return parseJsonResponse(response.data)
}

export { CLOUD_SERVICE_NAME }
