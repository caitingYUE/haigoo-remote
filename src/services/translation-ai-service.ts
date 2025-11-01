/**
 * AI翻译服务
 * 使用阿里百炼API提供真正的翻译功能
 */

import { aiService } from './ai-service'
import type { ApiResponse } from './types'

export interface TranslationRequest {
  text: string
  targetLanguage: 'zh' | 'en' | 'fr' | 'de' | 'pl'
  sourceLanguage?: 'auto' | 'zh' | 'en' | 'fr' | 'de' | 'pl'
  context?: string // 上下文信息，如职位描述、公司信息等
}

export interface TranslationResponse {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  confidence: number
}

export class TranslationAIService {
  /**
   * 翻译文本
   */
  async translateText(request: TranslationRequest): Promise<ApiResponse<TranslationResponse>> {
    try {
      const { text, targetLanguage, sourceLanguage = 'auto', context } = request
      
      // 如果文本为空或太短，直接返回
      if (!text || text.trim().length < 2) {
        return {
          success: true,
          data: {
            translatedText: text,
            sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
            targetLanguage,
            confidence: 1.0
          }
        }
      }

      // 构建翻译提示词
      const systemPrompt = this.buildTranslationPrompt(targetLanguage, context)
      const userMessage = this.formatTextForTranslation(text, sourceLanguage)

      const messages = aiService.buildConversation(systemPrompt, userMessage)

      // 调用AI服务进行翻译
      const response = await aiService.sendMessage(messages, undefined, {
        temperature: 0.3, // 较低的温度以确保翻译的一致性
        maxTokens: Math.min(2000, text.length * 3) // 根据原文长度动态调整
      })

      if (!response.success || !response.data?.output?.text) {
        return {
          success: false,
          error: '翻译服务暂时不可用'
        }
      }

      const translatedText = this.cleanTranslationResult(response.data.output.text)
      const detectedLanguage = this.detectLanguage(text)

      return {
        success: true,
        data: {
          translatedText,
          sourceLanguage: detectedLanguage,
          targetLanguage,
          confidence: 0.9 // AI翻译的置信度
        }
      }
    } catch (error) {
      console.error('Translation error:', error)
      return {
        success: false,
        error: '翻译过程中发生错误'
      }
    }
  }

  /**
   * 批量翻译
   */
  async batchTranslate(
    texts: string[], 
    targetLanguage: 'zh' | 'en' | 'fr' | 'de' | 'pl',
    context?: string
  ): Promise<ApiResponse<string[]>> {
    try {
      const results: string[] = []
      
      // 分批处理，避免单次请求过大
      const batchSize = 5
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const batchPromises = batch.map(text => 
          this.translateText({ text, targetLanguage, context })
        )
        
        const batchResults = await Promise.all(batchPromises)
        const batchTexts = batchResults.map(result => 
          result.success ? result.data!.translatedText : result.error || '翻译失败'
        )
        
        results.push(...batchTexts)
      }

      return {
        success: true,
        data: results
      }
    } catch (error) {
      return {
        success: false,
        error: '批量翻译失败'
      }
    }
  }

  /**
   * 构建翻译提示词
   */
  private buildTranslationPrompt(targetLanguage: 'zh' | 'en' | 'fr' | 'de' | 'pl', context?: string): string {
    const languageMap: Record<string, string> = {
      zh: '中文',
      en: '英文',
      fr: '法语',
      de: '德语',
      pl: '波兰语'
    }

    const contextPrompt = context ? `\n\n上下文：这是${context}相关的内容。` : ''

    return `你是一个专业的翻译助手，专门处理职位招聘相关的文本翻译。

任务：将用户提供的文本翻译成${languageMap[targetLanguage]}。

要求：
1. 保持原文的格式和结构（如段落、列表、标题等）
2. 准确翻译专业术语和技术词汇
3. 保持语言自然流畅，符合目标语言的表达习惯
4. 对于公司名称、产品名称等专有名词，保持原文或提供通用译名
5. 保留原文中的HTML标签和Markdown格式
6. 如果原文已经是目标语言，请直接返回原文${contextPrompt}

请直接返回翻译结果，不要添加任何解释或说明。`
  }

  /**
   * 格式化待翻译文本
   */
  private formatTextForTranslation(text: string, sourceLanguage: string): string {
    const langHint = sourceLanguage === 'auto' ? '' : `（原文语言：${sourceLanguage}）`
    return `请翻译以下内容${langHint}：

${text}`
  }

  /**
   * 清理翻译结果
   */
  private cleanTranslationResult(text: string): string {
    return text
      .replace(/^(翻译结果?[:：]?\s*)/i, '') // 移除"翻译结果："前缀
      .replace(/^(译文[:：]?\s*)/i, '') // 移除"译文："前缀
      .replace(/^(Translation[:：]?\s*)/i, '') // 移除"Translation:"前缀
      .trim()
  }

  /**
   * 简单的语言检测
   */
  private detectLanguage(text: string): string {
    // 简单的中文检测
    const chineseRegex = /[\u4e00-\u9fff]/
    const englishRegex = /[a-zA-Z]/
    // 朴素的德语、法语、波兰语特殊字符检测
    const germanRegex = /[äöüßÄÖÜ]/
    const frenchRegex = /[éèêëàâäôöùûüçÉÈÊËÀÂÄÔÖÙÛÜÇ]/
    const polishRegex = /[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/
    
    const chineseCount = (text.match(chineseRegex) || []).length
    const englishCount = (text.match(englishRegex) || []).length
    const germanCount = (text.match(germanRegex) || []).length
    const frenchCount = (text.match(frenchRegex) || []).length
    const polishCount = (text.match(polishRegex) || []).length
    
    if (chineseCount > englishCount && chineseCount > germanCount && chineseCount > frenchCount && chineseCount > polishCount) {
      return 'zh'
    } else if (englishCount >= germanCount && englishCount >= frenchCount && englishCount >= polishCount && englishCount > 0) {
      return 'en'
    } else if (germanCount >= englishCount && germanCount >= frenchCount && germanCount >= polishCount && germanCount > 0) {
      return 'de'
    } else if (frenchCount >= englishCount && frenchCount >= germanCount && frenchCount >= polishCount && frenchCount > 0) {
      return 'fr'
    } else if (polishCount >= englishCount && polishCount >= germanCount && polishCount >= frenchCount && polishCount > 0) {
      return 'pl'
    } else {
      return 'auto'
    }
  }

  /**
   * 检查是否需要翻译
   */
  isTranslationNeeded(text: string, targetLanguage: 'zh' | 'en' | 'fr' | 'de' | 'pl'): boolean {
    const detectedLang = this.detectLanguage(text)
    return detectedLang !== targetLanguage && detectedLang !== 'auto'
  }
}

// 导出单例
export const translationAIService = new TranslationAIService()