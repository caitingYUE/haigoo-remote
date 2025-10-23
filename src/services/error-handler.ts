/**
 * 错误处理和重试机制
 * 提供统一的错误处理、重试逻辑和错误恢复策略
 */

import type { ApiError, ApiResponse } from './types'

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMIT',
    'SERVER_ERROR',
    'SERVICE_UNAVAILABLE'
  ]
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  MODEL_ERROR = 'MODEL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private retryConfig: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  /**
   * 带重试的异步操作执行
   */
  async executeWithRetry<T>(
    operation: () => Promise<ApiResponse<T>>,
    customConfig?: Partial<RetryConfig>
  ): Promise<ApiResponse<T>> {
    const config = { ...this.retryConfig, ...customConfig }
    let lastError: ApiError | undefined

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation()
        
        // 如果成功，直接返回
        if (result.success) {
          return result
        }

        // 如果失败，检查是否可重试
        const error = this.parseError(result.error)
        lastError = error

        if (!this.isRetryableError(this.getErrorTypeFromString(error.type), config.retryableErrors)) {
          return {
            success: false,
            error: error.message,
            errorType: error.type,
            errorCode: error.code
          }
        }

        // 如果是最后一次尝试，不再重试
        if (attempt === config.maxRetries) {
          break
        }

        // 计算延迟时间并等待
        const delay = this.calculateDelay(attempt, config)
        await this.sleep(delay)

      } catch (error) {
        const parsedError = this.parseError(error)
        lastError = parsedError

        // 如果不可重试或是最后一次尝试，返回错误
        if (!this.isRetryableError(parsedError.type as ErrorType, config.retryableErrors) || 
            attempt === config.maxRetries) {
          return {
            success: false,
            error: parsedError.message,
            errorType: parsedError.type,
            errorCode: parsedError.code
          }
        }

        // 计算延迟时间并等待
        const delay = this.calculateDelay(attempt, config)
        await this.sleep(delay)
      }
    }

    // 所有重试都失败了
    return {
      success: false,
      error: lastError?.message || '操作失败，已达到最大重试次数',
      errorType: lastError?.type || ErrorType.UNKNOWN_ERROR,
      errorCode: lastError?.code
    }
  }

  /**
   * 解析错误
   */
  parseError(error: any): ApiError {
    if (typeof error === 'string') {
      return {
        type: this.classifyErrorType(error),
        message: error,
        code: undefined,
        details: undefined
      }
    }

    if (error && typeof error === 'object') {
      // 网络错误
      if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
        return {
          type: ErrorType.NETWORK_ERROR,
          message: '网络连接失败，请检查网络设置',
          code: error.code,
          details: error
        }
      }

      // 超时错误
      if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
        return {
          type: ErrorType.TIMEOUT,
          message: '请求超时，请稍后重试',
          code: error.code,
          details: error
        }
      }

      // HTTP 状态码错误
      if (error.status || error.statusCode) {
        const status = error.status || error.statusCode
        return this.parseHttpError(status, error.message || error.statusText)
      }

      // API 响应错误
      if (error.error_code || error.errorCode) {
        return this.parseApiError(error)
      }

      return {
        type: ErrorType.UNKNOWN_ERROR,
        message: error.message || '未知错误',
        code: error.code,
        details: error
      }
    }

    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: '未知错误',
      code: undefined,
      details: error
    }
  }

  /**
   * 解析 HTTP 错误
   */
  private parseHttpError(status: number, message?: string): ApiError {
    switch (status) {
      case 400:
        return {
          type: ErrorType.VALIDATION_ERROR,
          message: message || '请求参数错误',
          code: status.toString()
        }
      case 401:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: message || 'API密钥无效或已过期',
          code: status.toString()
        }
      case 403:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: message || '访问被拒绝，请检查权限',
          code: status.toString()
        }
      case 429:
        return {
          type: ErrorType.RATE_LIMIT,
          message: message || '请求频率过高，请稍后重试',
          code: status.toString()
        }
      case 500:
        return {
          type: ErrorType.SERVER_ERROR,
          message: message || '服务器内部错误',
          code: status.toString()
        }
      case 502:
      case 503:
        return {
          type: ErrorType.SERVICE_UNAVAILABLE,
          message: message || '服务暂时不可用，请稍后重试',
          code: status.toString()
        }
      default:
        return {
          type: status >= 500 ? ErrorType.SERVER_ERROR : ErrorType.UNKNOWN_ERROR,
          message: message || `HTTP错误: ${status}`,
          code: status.toString()
        }
    }
  }

  /**
   * 解析 API 错误
   */
  private parseApiError(error: any): ApiError {
    const errorCode = error.error_code || error.errorCode
    const message = error.error_message || error.message || error.error

    // 阿里百炼特定错误码
    switch (errorCode) {
      case 'InvalidApiKey':
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'API密钥无效',
          code: errorCode
        }
      case 'QuotaExceeded':
        return {
          type: ErrorType.QUOTA_EXCEEDED,
          message: 'API调用配额已用完',
          code: errorCode
        }
      case 'RateLimitExceeded':
        return {
          type: ErrorType.RATE_LIMIT,
          message: '请求频率超限，请稍后重试',
          code: errorCode
        }
      case 'ModelNotFound':
        return {
          type: ErrorType.MODEL_ERROR,
          message: '指定的模型不存在',
          code: errorCode
        }
      case 'InvalidInput':
        return {
          type: ErrorType.VALIDATION_ERROR,
          message: '输入参数无效',
          code: errorCode
        }
      default:
        return {
          type: ErrorType.UNKNOWN_ERROR,
          message: message || '未知API错误',
          code: errorCode
        }
    }
  }

  /**
   * 分类错误类型
   */
  private classifyErrorType(message: string): ErrorType {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('network') || lowerMessage.includes('连接')) {
      return ErrorType.NETWORK_ERROR
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('超时')) {
      return ErrorType.TIMEOUT
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('频率')) {
      return ErrorType.RATE_LIMIT
    }
    if (lowerMessage.includes('server error') || lowerMessage.includes('服务器错误')) {
      return ErrorType.SERVER_ERROR
    }
    if (lowerMessage.includes('unavailable') || lowerMessage.includes('不可用')) {
      return ErrorType.SERVICE_UNAVAILABLE
    }
    if (lowerMessage.includes('auth') || lowerMessage.includes('认证') || lowerMessage.includes('密钥')) {
      return ErrorType.AUTHENTICATION_ERROR
    }
    if (lowerMessage.includes('quota') || lowerMessage.includes('配额')) {
      return ErrorType.QUOTA_EXCEEDED
    }

    return ErrorType.UNKNOWN_ERROR
  }

  // 移除未使用的方法
  // private parseErrorType(error: any): ErrorType {
  //   ...
  // }

  /**
   * 从字符串获取错误类型
   */
  private getErrorTypeFromString(errorType: string): ErrorType {
    switch (errorType.toUpperCase()) {
      case 'NETWORK_ERROR':
        return ErrorType.NETWORK_ERROR
      case 'TIMEOUT':
        return ErrorType.TIMEOUT
      case 'RATE_LIMIT':
        return ErrorType.RATE_LIMIT
      case 'SERVER_ERROR':
        return ErrorType.SERVER_ERROR
      case 'SERVICE_UNAVAILABLE':
        return ErrorType.SERVICE_UNAVAILABLE
      case 'AUTHENTICATION_ERROR':
        return ErrorType.AUTHENTICATION_ERROR
      case 'VALIDATION_ERROR':
        return ErrorType.VALIDATION_ERROR
      case 'QUOTA_EXCEEDED':
        return ErrorType.QUOTA_EXCEEDED
      case 'MODEL_ERROR':
        return ErrorType.MODEL_ERROR
      default:
        return ErrorType.UNKNOWN_ERROR
    }
  }

  /**
   * 检查错误是否可重试
   */
  private isRetryableError(errorType: ErrorType, retryableErrors: string[]): boolean {
    return retryableErrors.includes(errorType.toString())
  }

  /**
   * 计算延迟时间（指数退避）
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt)
    return Math.min(delay, config.maxDelay)
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 创建用户友好的错误消息
   */
  createUserFriendlyMessage(error: ApiError): string {
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        return '网络连接失败，请检查网络设置后重试'
      case ErrorType.TIMEOUT:
        return '请求超时，请稍后重试'
      case ErrorType.RATE_LIMIT:
        return '请求过于频繁，请稍后再试'
      case ErrorType.AUTHENTICATION_ERROR:
        return 'API认证失败，请检查配置'
      case ErrorType.QUOTA_EXCEEDED:
        return 'API调用次数已达上限，请稍后重试'
      case ErrorType.VALIDATION_ERROR:
        return '输入内容有误，请检查后重试'
      case ErrorType.SERVER_ERROR:
        return '服务器暂时出现问题，请稍后重试'
      case ErrorType.SERVICE_UNAVAILABLE:
        return '服务暂时不可用，请稍后重试'
      case ErrorType.MODEL_ERROR:
        return '模型服务异常，请稍后重试'
      default:
        return error.message || '操作失败，请重试'
    }
  }
}

// 创建默认的错误处理器实例
export const errorHandler = new ErrorHandler()

/**
 * 便捷的重试装饰器
 */
export function withRetry<T extends any[], R>(
  config?: Partial<RetryConfig>
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: T): Promise<ApiResponse<R>> {
      const handler = new ErrorHandler(config)
      return handler.executeWithRetry(() => originalMethod.apply(this, args))
    }

    return descriptor
  }
}