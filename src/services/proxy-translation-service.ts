/**
 * 代理翻译服务
 * 通过Vercel Edge Function代理调用翻译API，解决CORS问题
 */

import type { ApiResponse } from './types'

/**
 * 翻译结果接口
 */
export interface TranslationResult {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  confidence: number
  provider: string
}

/**
 * 代理翻译服务类
 */
export class ProxyTranslationService {
  private baseUrl: string
  private timeout: number = 30000 // 30秒超时

  constructor() {
    // 根据环境确定API端点
    if (typeof window !== 'undefined') {
      // 浏览器环境
      this.baseUrl = window.location.origin
    } else {
      // 服务器环境
      this.baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000'
    }
  }

  /**
   * 翻译单个文本
   */
  async translateText(
    text: string,
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<TranslationResult>> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: true,
          data: {
            translatedText: text,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            confidence: 1.0,
            provider: 'None'
          }
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          targetLanguage,
          sourceLanguage
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Translation failed')
      }

      return {
        success: true,
        data: result.data
      }

    } catch (error) {
      console.error('Proxy translation error:', error)
      
      // 如果是网络错误，返回原文作为回退
      if (error instanceof Error && (
        error.name === 'AbortError' || 
        error.message.includes('fetch') ||
        error.message.includes('network')
      )) {
        return {
          success: false,
          error: `网络错误: ${error.message}`,
          data: {
            translatedText: text,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            confidence: 0,
            provider: 'Fallback'
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '翻译服务暂时不可用'
      }
    }
  }

  /**
   * 批量翻译文本
   */
  async batchTranslate(
    texts: string[],
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<string[]>> {
    try {
      if (!texts || texts.length === 0) {
        return {
          success: true,
          data: []
        }
      }

      // 过滤空文本
      const validTexts = texts.map(text => text || '')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2) // 批量翻译给更多时间

      const response = await fetch(`${this.baseUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: validTexts,
          targetLanguage,
          sourceLanguage
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Batch translation API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        // 如果批量翻译失败，尝试逐个翻译
        console.warn('Batch translation failed, falling back to individual translations:', result.error)
        return this.fallbackIndividualTranslation(texts, targetLanguage, sourceLanguage)
      }

      return {
        success: true,
        data: result.data
      }

    } catch (error) {
      console.error('Batch translation error:', error)
      
      // 回退到逐个翻译
      return this.fallbackIndividualTranslation(texts, targetLanguage, sourceLanguage)
    }
  }

  /**
   * 回退到逐个翻译
   */
  private async fallbackIndividualTranslation(
    texts: string[],
    targetLanguage: string,
    sourceLanguage: string
  ): Promise<ApiResponse<string[]>> {
    try {
      const results = await Promise.allSettled(
        texts.map(text => this.translateText(text, targetLanguage, sourceLanguage))
      )

      const translatedTexts = results.map((result, index) => {
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          return result.value.data.translatedText
        }
        return texts[index] // 返回原文作为回退
      })

      return {
        success: true,
        data: translatedTexts
      }
    } catch (error) {
      console.error('Fallback individual translation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '批量翻译失败',
        data: texts // 返回原文数组
      }
    }
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'test',
          targetLanguage: 'zh-CN',
          sourceLanguage: 'en'
        })
      })

      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { [code: string]: string } {
    return {
      'auto': '自动检测',
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      'en': 'English',
      'fr': 'Français',
      'de': 'Deutsch',
      'es': 'Español',
      'ja': '日本語',
      'ko': '한국어',
      'ru': 'Русский',
      'pt': 'Português',
      'it': 'Italiano',
      'ar': 'العربية'
    }
  }

  /**
   * 获取服务信息
   */
  getServiceInfo() {
    return {
      name: 'Proxy Translation Service',
      provider: 'Multiple (MyMemory, LibreTranslate, Google)',
      endpoint: `${this.baseUrl}/api/translate`,
      timeout: this.timeout,
      supportsCORS: true,
      cost: 'Free'
    }
  }
}

// 导出单例实例
export const proxyTranslationService = new ProxyTranslationService()