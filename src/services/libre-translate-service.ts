/**
 * LibreTranslate 翻译服务
 * 使用开源的LibreTranslate API提供翻译功能
 */

import type { ApiResponse } from './types'

export interface LibreTranslateRequest {
  q: string
  source: string
  target: string
  format?: 'text' | 'html'
  alternatives?: number
  api_key?: string
}

export interface LibreTranslateResponse {
  translatedText: string
  detectedLanguage?: {
    confidence: number
    language: string
  }
  alternatives?: string[]
}

export class LibreTranslateService {
  private baseUrl: string
  private apiKey?: string

  constructor(baseUrl: string = 'https://translate.argosopentech.com', apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // 移除末尾的斜杠
    this.apiKey = apiKey
  }

  /**
   * 翻译文本
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<LibreTranslateResponse>> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: true,
          data: {
            translatedText: text,
            detectedLanguage: {
              confidence: 1.0,
              language: sourceLanguage === 'auto' ? 'en' : sourceLanguage
            }
          }
        }
      }

      const requestBody: LibreTranslateRequest = {
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text'
      }

      if (this.apiKey) {
        requestBody.api_key = this.apiKey
      }

      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('LibreTranslate API error:', response.status, errorText)
        return {
          success: false,
          error: `翻译服务错误: ${response.status}`
        }
      }

      const data: LibreTranslateResponse = await response.json()
      
      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('LibreTranslate service error:', error)
      return {
        success: false,
        error: '翻译服务连接失败'
      }
    }
  }

  /**
   * 检测语言
   */
  async detectLanguage(text: string): Promise<ApiResponse<{ language: string; confidence: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: text })
      })

      if (!response.ok) {
        return {
          success: false,
          error: '语言检测失败'
        }
      }

      const data = await response.json()
      const result = Array.isArray(data) ? data[0] : data

      return {
        success: true,
        data: {
          language: result.language,
          confidence: result.confidence
        }
      }
    } catch (error) {
      console.error('Language detection error:', error)
      return {
        success: false,
        error: '语言检测服务连接失败'
      }
    }
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages(): Promise<ApiResponse<Array<{ code: string; name: string }>>> {
    try {
      const response = await fetch(`${this.baseUrl}/languages`)
      
      if (!response.ok) {
        return {
          success: false,
          error: '获取语言列表失败'
        }
      }

      const data = await response.json()
      
      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('Get languages error:', error)
      return {
        success: false,
        error: '获取语言列表服务连接失败'
      }
    }
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/languages`, {
        method: 'GET',
        timeout: 5000
      } as any)
      
      return response.ok
    } catch (error) {
      console.error('LibreTranslate health check failed:', error)
      return false
    }
  }
}

// 创建默认实例
export const libreTranslateService = new LibreTranslateService()