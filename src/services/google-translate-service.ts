/**
 * Google Translate 免费API服务
 * 使用Google Translate的免费API提供翻译功能
 * 注意：这使用的是非官方的免费接口，生产环境建议使用官方API
 */

import type { ApiResponse } from './types'

export interface GoogleTranslateResponse {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  confidence: number
}

export class GoogleTranslateService {
  private baseUrl: string = 'https://translate.googleapis.com/translate_a/single'
  private userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  /**
   * 翻译文本
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<GoogleTranslateResponse>> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: true,
          data: {
            translatedText: text,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            confidence: 1.0
          }
        }
      }

      // 构建请求参数
      const params = new URLSearchParams({
        client: 'gtx',
        sl: sourceLanguage === 'auto' ? 'auto' : this.mapLanguageCode(sourceLanguage),
        tl: this.mapLanguageCode(targetLanguage),
        dt: 't',
        q: text
      })

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`Google Translate API请求失败: ${response.status}`)
      }

      const data = await response.json()
      
      // 解析Google Translate的响应格式
      if (!data || !Array.isArray(data) || !data[0]) {
        throw new Error('Google Translate API返回格式错误')
      }

      // 提取翻译结果
      let translatedText = ''
      if (Array.isArray(data[0])) {
        translatedText = data[0].map((item: any) => item[0]).join('')
      } else {
        translatedText = data[0][0][0] || text
      }

      // 提取检测到的源语言
      const detectedSourceLang = data[2] || sourceLanguage

      return {
        success: true,
        data: {
          translatedText: translatedText.trim(),
          sourceLanguage: detectedSourceLang,
          targetLanguage: targetLanguage,
          confidence: 0.95 // Google Translate通常有很高的置信度
        }
      }

    } catch (error) {
      console.error('Google Translate翻译失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Translate翻译失败',
        data: {
          translatedText: text,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          confidence: 0
        }
      }
    }
  }

  /**
   * 批量翻译
   */
  async batchTranslate(
    texts: string[],
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<string[]>> {
    try {
      const results = await Promise.all(
        texts.map(text => this.translateText(text, targetLanguage, sourceLanguage))
      )

      const translatedTexts = results.map((result, index) => 
        result.success && result.data ? result.data.translatedText : texts[index]
      )

      return {
        success: true,
        data: translatedTexts
      }

    } catch (error) {
      console.error('Google Translate批量翻译失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google Translate批量翻译失败',
        data: texts
      }
    }
  }

  /**
   * 检测语言
   */
  async detectLanguage(text: string): Promise<ApiResponse<{ language: string; confidence: number }>> {
    try {
      const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: 'en',
        dt: 't',
        q: text.substring(0, 100) // 只取前100个字符进行检测
      })

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent
        }
      })

      if (!response.ok) {
        throw new Error(`语言检测失败: ${response.status}`)
      }

      const data = await response.json()
      const detectedLang = data[2] || 'unknown'

      return {
        success: true,
        data: {
          language: detectedLang,
          confidence: 0.9
        }
      }

    } catch (error) {
      console.error('Google Translate语言检测失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '语言检测失败',
        data: {
          language: 'unknown',
          confidence: 0
        }
      }
    }
  }

  /**
   * 健康检查
   */
  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.translateText('hello', 'zh', 'en')
      return result.success && !!result.data?.translatedText && result.data.translatedText.length > 0
    } catch {
      return false
    }
  }

  /**
   * 映射语言代码到Google Translate支持的格式
   */
  private mapLanguageCode(lang: string): string {
    const languageMap: { [key: string]: string } = {
      'zh-CN': 'zh',
      'zh-TW': 'zh-tw',
      'zh-HK': 'zh-tw',
      'en': 'en',
      'en-US': 'en',
      'en-GB': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'it': 'it',
      'pt': 'pt',
      'ru': 'ru',
      'ar': 'ar',
      'hi': 'hi',
      'th': 'th',
      'vi': 'vi',
      'id': 'id',
      'ms': 'ms',
      'tl': 'tl',
      'auto': 'auto'
    }

    return languageMap[lang] || lang
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { [code: string]: string } {
    return {
      'auto': '自动检测',
      'zh': '中文',
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
      'id': '印尼语',
      'ms': '马来语',
      'tl': '菲律宾语'
    }
  }
}

// 创建服务实例
export const googleTranslateService = new GoogleTranslateService()