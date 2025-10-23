/**
 * HTTP客户端封装
 * 提供统一的API请求处理
 */

import { API_CONFIG, getHeaders, validateConfig } from './config'
import type { ApiResponse, ApiError, RequestConfig } from './types'

// HTTP方法类型
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// 请求选项
interface RequestOptions extends RequestConfig {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: any
}

// HTTP客户端类
export class HttpClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    
    // 验证配置
    if (!validateConfig()) {
      throw new Error('API配置验证失败')
    }
  }

  /**
   * 发送HTTP请求
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = API_CONFIG.timeout,
      retries = API_CONFIG.retryAttempts,
      retryDelay = API_CONFIG.retryDelay
    } = options

    const url = `${this.baseUrl}${endpoint}`
    const requestHeaders = {
      ...getHeaders(),
      ...headers
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    }

    // 带重试的请求执行
    return this.executeWithRetry(url, requestOptions, timeout, retries, retryDelay)
  }

  /**
   * 带重试机制的请求执行
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit,
    timeout: number,
    retries: number,
    retryDelay: number
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.executeRequest<T>(url, options, timeout)
        return response
      } catch (error) {
        lastError = error as Error
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === retries) {
          break
        }

        // 等待后重试
        await this.delay(retryDelay * Math.pow(2, attempt)) // 指数退避
        console.warn(`请求失败，正在进行第 ${attempt + 1} 次重试...`, error)
      }
    }

    // 所有重试都失败了
    return {
      success: false,
      error: lastError?.message || '请求失败',
      message: `请求失败，已重试 ${retries} 次`
    }
  }

  /**
   * 执行单次请求
   */
  private async executeRequest<T>(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<ApiResponse<T>> {
    // 创建超时控制器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text()
        let errorData: ApiError

        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = {
            type: 'NETWORK_ERROR',
            code: response.status.toString(),
            message: response.statusText || '请求失败',
            timestamp: new Date().toISOString()
          }
        }

        return {
          success: false,
          error: errorData.message,
          message: `HTTP ${response.status}: ${errorData.message}`
        }
      }

      // 解析响应数据
      const data = await response.json()
      
      return {
        success: true,
        data: data as T
      }

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: '请求超时',
            message: `请求超时 (${timeout}ms)`
          }
        }
        
        return {
          success: false,
          error: error.message,
          message: '网络请求失败'
        }
      }

      return {
        success: false,
        error: '未知错误',
        message: '发生未知错误'
      }
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...config })
  }

  /**
   * POST请求
   */
  async post<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body: data, ...config })
  }

  /**
   * PUT请求
   */
  async put<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body: data, ...config })
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', ...config })
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health', { timeout: 5000, retries: 1 })
      return response.success
    } catch {
      return false
    }
  }
}

// 创建默认的HTTP客户端实例
export const httpClient = new HttpClient('')