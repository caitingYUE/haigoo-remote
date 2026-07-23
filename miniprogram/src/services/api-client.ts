import Taro from '@tarojs/taro'
import { CLOUD_ENV_ID, CLOUD_SERVICE_NAME } from '../config/api'
import { getMiniSessionToken } from './session'

interface ApiRequestOptions {
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
  authenticated?: boolean
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
    return '请求域名尚未生效，请在开发者工具刷新域名配置后重试'
  }
  if (normalized.includes('timeout')) {
    return '岗位接口响应超时，请检查网络后重试'
  }
  if (
    normalized.includes('ssl') ||
    normalized.includes('certificate') ||
    normalized.includes('tls')
  ) {
    return '岗位接口 HTTPS 校验失败，请检查服务器证书'
  }
  if (normalized.includes('network') || normalized.includes('request:fail')) {
    return detail ? `网络请求失败：${detail}` : '网络请求失败，请检查当前网络'
  }
  return detail || '网络请求失败，请稍后重试'
}

function parseJsonResponse<T>(data: T | string): T {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data) as T
  } catch {
    throw new ApiRequestError('接口返回了无法解析的数据')
  }
}

export async function requestJson<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  if (!CLOUD_ENV_ID) {
    throw new ApiRequestError('云开发环境未配置，请联系管理员完成小程序发布配置')
  }
  let response
  try {
    response = await Taro.cloud.callContainer<T | string>({
      config: { env: CLOUD_ENV_ID },
      path,
      method: options.method || 'GET',
      data: options.data,
      timeout: 15000,
      header: {
        Accept: 'application/json',
        // Cloud Hosting can contain multiple services. This is required by
        // callContainer to route the Mini Program request to haigoo-mini.
        'X-WX-SERVICE': CLOUD_SERVICE_NAME,
        ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...(options.authenticated && getMiniSessionToken()
          ? { Authorization: `Bearer ${getMiniSessionToken()}` }
          : {})
      }
    })
  } catch (error) {
    const message = getRequestFailureMessage(error)
    console.error('[Haigoo API] request failed', {
      path,
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
    const message = String(payload.error || payload.message || `请求失败（${response.statusCode}）`)
    throw new ApiRequestError(message, response.statusCode, payload)
  }

  return parseJsonResponse(response.data)
}

export { CLOUD_SERVICE_NAME }
