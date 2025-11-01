/**
 * MyMemory 翻译服务
 * 使用免费的 MyMemory API 进行翻译，无需 API 密钥，支持浏览器直接调用
 */

import type { ApiResponse } from './types'

export interface MyMemoryTranslationResponse {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  confidence: number
  provider: string
}

export interface MyMemoryApiResponse {
  responseData: {
    translatedText: string
    match: number
  }
  quotaFinished: boolean
  mtLangSupported: boolean
  responseDetails: string
  responseStatus: number
  responderId: string
  exception_code?: string
  matches?: Array<{
    id: string
    segment: string
    translation: string
    source: string
    target: string
    quality: string
    reference: string
    'usage-count': number
    subject: string
    'created-by': string
    'last-updated-by': string
    'create-date': string
    'last-update-date': string
    match: number
  }>
}

export class MyMemoryTranslateService {
  private readonly baseUrl = 'https://api.mymemory.translated.net'
  private readonly maxTextLength = 500 // MyMemory API 限制

  /**
   * 翻译文本
   */
  async translateText(
    text: string,
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<MyMemoryTranslationResponse>> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: true,
          data: {
            translatedText: text,
            sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
            targetLanguage,
            confidence: 1.0,
            provider: 'MyMemory'
          }
        }
      }

      // 检查文本长度
      if (text.length > this.maxTextLength) {
        return {
          success: false,
          error: `文本长度超过限制 (${this.maxTextLength} 字符)`
        }
      }

      // 构建 API URL
      const langPair = sourceLanguage === 'auto' ? `auto|${targetLanguage}` : `${sourceLanguage}|${targetLanguage}`
      const url = `${this.baseUrl}/get?q=${encodeURIComponent(text)}&langpair=${langPair}`

      console.log(`MyMemory API 请求: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: MyMemoryApiResponse = await response.json()

      if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || '翻译请求失败')
      }

      if (!data.responseData?.translatedText) {
        throw new Error('翻译结果为空')
      }

      // 检测源语言
      const detectedSourceLang = this.detectSourceLanguage(text, sourceLanguage)

      return {
        success: true,
        data: {
          translatedText: data.responseData.translatedText,
          sourceLanguage: detectedSourceLang,
          targetLanguage,
          confidence: data.responseData.match / 100, // MyMemory 返回 0-100 的匹配度
          provider: 'MyMemory'
        }
      }

    } catch (error) {
      console.error('MyMemory 翻译错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '翻译服务异常'
      }
    }
  }

  /**
   * 批量翻译
   */
  async batchTranslate(
    texts: string[],
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<string[]>> {
    try {
      const results: string[] = []
      
      // 分批处理，避免并发过多
      const batchSize = 2
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const batchPromises = batch.map(text => 
          this.translateText(text, targetLanguage, sourceLanguage)
        )
        
        const batchResults = await Promise.all(batchPromises)
        
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j]
          if (result.success && result.data) {
            results.push(result.data.translatedText)
          } else {
            // 翻译失败时返回原文
            results.push(batch[j])
            console.warn(`批量翻译失败 (${i + j}): ${result.error}`)
          }
        }

        // 添加延迟避免频率限制
        if (i + batchSize < texts.length) {
          await this.delay(200)
        }
      }
      
      return {
        success: true,
        data: results
      }
    } catch (error) {
      console.error('批量翻译错误:', error)
      return {
        success: false,
        error: '批量翻译失败'
      }
    }
  }

  /**
   * 检测源语言
   */
  private detectSourceLanguage(text: string, providedLang: string): string {
    if (providedLang !== 'auto') {
      return providedLang
    }

    // 简单的语言检测
    if (/[\u4e00-\u9fff]/.test(text)) {
      return 'zh-CN'
    }
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja'
    }
    if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko'
    }
    if (/[а-яё]/i.test(text)) {
      return 'ru'
    }
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(text)) {
      return 'fr'
    }
    if (/[äöüß]/i.test(text)) {
      return 'de'
    }
    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/i.test(text)) {
      return 'es'
    }
    
    return 'en' // 默认英语
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { [code: string]: string } {
    return {
      'auto': '自动检测',
      'zh-CN': '中文(简体)',
      'zh-TW': '中文(繁体)',
      'en': '英语',
      'ja': '日语',
      'ko': '韩语',
      'fr': '法语',
      'de': '德语',
      'es': '西班牙语',
      'it': '意大利语',
      'pt': '葡萄牙语',
      'ru': '俄语',
      'ar': '阿拉伯语',
      'hi': '印地语',
      'th': '泰语',
      'vi': '越南语',
      'nl': '荷兰语',
      'sv': '瑞典语',
      'da': '丹麦语',
      'no': '挪威语',
      'fi': '芬兰语',
      'pl': '波兰语',
      'tr': '土耳其语',
      'he': '希伯来语',
      'id': '印尼语',
      'ms': '马来语',
      'tl': '菲律宾语'
    }
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.translateText('hello', 'zh-CN', 'en')
      return result.success
    } catch (error) {
      console.error('MyMemory 健康检查失败:', error)
      return false
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 规范化语言代码
   */
  private normalizeLanguageCode(lang: string): string {
    const langMap: { [key: string]: string } = {
      'zh': 'zh-CN',
      'zh-cn': 'zh-CN',
      'zh-tw': 'zh-TW',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'it': 'it',
      'pt': 'pt',
      'ru': 'ru',
      'ar': 'ar',
      'hi': 'hi'
    }

    return langMap[lang.toLowerCase()] || lang
  }
}

// 创建默认实例
export const myMemoryTranslateService = new MyMemoryTranslateService()