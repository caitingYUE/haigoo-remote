/**
 * 多提供商翻译服务
 * 整合多个翻译服务提供商，提供智能回退机制
 */

import { myMemoryTranslateService } from './mymemory-translate-service'
import { translationAIService } from './translation-ai-service'
import { libreTranslateService } from './libre-translate-service'
import { googleTranslateService } from './google-translate-service'
import { proxyTranslationService } from './proxy-translation-service'
import type { ApiResponse } from './types'

/**
 * 翻译提供商接口
 */
interface TranslationProvider {
  name: string
  priority: number
  translateText: (text: string, targetLang: string, sourceLang?: string) => Promise<ApiResponse<any>>
  batchTranslate: (texts: string[], targetLang: string, sourceLang?: string) => Promise<ApiResponse<string[]>>
  checkHealth: () => Promise<boolean>
}

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
 * 多提供商翻译服务类
 */
export class MultiTranslationService {
  private providers: TranslationProvider[] = []
  private healthStatus: { [key: string]: boolean } = {}
  private lastHealthCheck: number = 0
  private healthCheckInterval: number = 5 * 60 * 1000 // 5分钟

  constructor() {
    this.initializeProviders()
  }

  /**
   * 初始化翻译提供商
   */
  private initializeProviders() {
    this.providers = [
      // 优先使用代理翻译服务 - 零成本且解决CORS问题
      {
        name: 'Proxy',
        priority: 1,
        translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
          return await proxyTranslationService.translateText(text, targetLang, sourceLang)
        },
        batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
          return await proxyTranslationService.batchTranslate(texts, targetLang, sourceLang)
        },
        checkHealth: async () => {
          return await proxyTranslationService.checkHealth()
        }
      },
      // 暂时禁用豆包服务，因为模型配置有问题
      // {
      //   name: 'Doubao',
      //   priority: 1,
      //   translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
      //     const result = await doubaoTranslateService.translateText({
      //       text,
      //       targetLanguage: targetLang,
      //       sourceLanguage: sourceLang === 'auto' ? undefined : sourceLang
      //     })
      //     
      //     if (result.success && result.data) {
      //       return {
      //         success: true,
      //         data: {
      //           translatedText: result.data.translatedText,
      //           sourceLanguage: result.data.sourceLanguage,
      //           targetLanguage: result.data.targetLanguage,
      //           confidence: result.data.confidence || 0.95,
      //           provider: 'Doubao'
      //         }
      //       }
      //     }
      //     return result
      //   },
      //   batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
      //     const requests = texts.map(text => ({
      //       text,
      //       targetLanguage: targetLang,
      //       sourceLanguage: sourceLang === 'auto' ? undefined : sourceLang
      //     }))
      //     
      //     const result = await doubaoTranslateService.batchTranslate(requests)
      //     
      //     if (result.success && result.data) {
      //       return {
      //         success: true,
      //         data: result.data.map(item => item.translatedText)
      //       }
      //     }
      //     
      //     return {
      //       success: false,
      //       error: result.error || '豆包批量翻译失败',
      //       data: texts // 返回原文作为回退
      //     }
      //   },
      //   checkHealth: async () => {
      //     return await doubaoTranslateService.checkHealth()
      //   }
      // },
      {
        name: 'MyMemory',
        priority: 1, // 提升MyMemory优先级
        translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
          return await myMemoryTranslateService.translateText(text, targetLang, sourceLang)
        },
        batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
          return await myMemoryTranslateService.batchTranslate(texts, targetLang, sourceLang)
        },
        checkHealth: async () => {
          return await myMemoryTranslateService.checkHealth()
        }
      },
      {
        name: 'LibreTranslate',
        priority: 2, // 调整优先级
        translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
          const result = await libreTranslateService.translateText(text, targetLang, sourceLang)
          
          if (result.success && result.data) {
            return {
              success: true,
              data: {
                translatedText: result.data.translatedText,
                sourceLanguage: result.data.detectedLanguage?.language || sourceLang,
                targetLanguage: targetLang,
                confidence: result.data.detectedLanguage?.confidence || 0.85,
                provider: 'LibreTranslate'
              }
            }
          }
          return result
        },
        batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
          const results = await Promise.all(
            texts.map(text => libreTranslateService.translateText(text, targetLang, sourceLang))
          )
          
          const translatedTexts = results.map((result, index) => 
            result.success && result.data ? result.data.translatedText : texts[index]
          )
          
          return {
            success: true,
            data: translatedTexts
          }
        },
        checkHealth: async () => {
           return await libreTranslateService.checkHealth()
         }
       },
       {
         name: 'Google Translate',
         priority: 3, // 调整优先级
         translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
           const result = await googleTranslateService.translateText(text, targetLang, sourceLang)
           
           if (result.success && result.data) {
             return {
               success: true,
               data: {
                 translatedText: result.data.translatedText,
                 sourceLanguage: result.data.sourceLanguage,
                 targetLanguage: targetLang,
                 confidence: result.data.confidence,
                 provider: 'Google Translate'
               }
             }
           }
           return result
         },
         batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
           const result = await googleTranslateService.batchTranslate(texts, targetLang, sourceLang)
           return result
         },
         checkHealth: async () => {
           return await googleTranslateService.checkHealth()
         }
       },
       {
         name: 'AI Service',
         priority: 4, // 调整优先级
        translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
          // 将语言代码映射到AI服务支持的类型
          const mappedTargetLang = this.mapLanguageCode(targetLang) as 'zh' | 'en' | 'fr' | 'de' | 'pl'
          const mappedSourceLang = sourceLang === 'auto' ? 'auto' : this.mapLanguageCode(sourceLang) as 'zh' | 'en' | 'fr' | 'de' | 'pl'
          
          const result = await translationAIService.translateText({
            text,
            targetLanguage: mappedTargetLang,
            sourceLanguage: mappedSourceLang
          })
          
          if (result.success && result.data) {
            return {
              success: true,
              data: {
                translatedText: result.data.translatedText,
                sourceLanguage: result.data.sourceLanguage,
                targetLanguage: result.data.targetLanguage,
                confidence: result.data.confidence || 0.8,
                provider: 'AI Service'
              }
            }
          }
          return result
        },
        batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
          // 将语言代码映射到AI服务支持的类型
          const mappedTargetLang = this.mapLanguageCode(targetLang) as 'zh' | 'en' | 'fr' | 'de' | 'pl'
          
          return await translationAIService.batchTranslate(texts, mappedTargetLang)
        },
        checkHealth: async () => {
          try {
            const result = await translationAIService.translateText({
              text: 'test',
              targetLanguage: 'zh',
              sourceLanguage: 'en'
            })
            return result.success
          } catch {
            return false
          }
        }
      },
      {
        name: 'Dictionary Fallback',
        priority: 6,
        translateText: async (text: string, targetLang: string, sourceLang: string = 'auto') => {
          return this.dictionaryFallback(text, targetLang, sourceLang)
        },
        batchTranslate: async (texts: string[], targetLang: string, sourceLang: string = 'auto') => {
          const results = await Promise.all(
            texts.map(text => this.dictionaryFallback(text, targetLang, sourceLang))
          )
          const translatedTexts = results.map((result, index) => 
            result.success && result.data ? result.data.translatedText : texts[index]
          )
          return {
            success: true,
            data: translatedTexts
          }
        },
        checkHealth: async () => {
          return true // 词典回退总是可用
        }
      }
    ]

    // 按优先级排序
    this.providers.sort((a, b) => a.priority - b.priority)
  }

  /**
   * 翻译文本
   */
  async translateText(
    text: string,
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<TranslationResult>> {
    if (!text || text.trim().length === 0) {
      return {
        success: true,
        data: {
          translatedText: text,
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
          targetLanguage,
          confidence: 1.0,
          provider: 'None'
        }
      }
    }

    // 更新健康状态
    await this.updateHealthStatus()

    // 按优先级排序提供商，并过滤掉不健康的提供商
    const availableProviders = this.providers
      .filter(provider => this.healthStatus[provider.name] !== false)
      .sort((a, b) => a.priority - b.priority)

    console.log('可用的翻译提供商:', availableProviders.map(p => `${p.name}(优先级:${p.priority})`))

    // 尝试每个可用的提供商
    for (const provider of availableProviders) {
      try {
        console.log(`尝试使用 ${provider.name} 翻译...`)
        
        const result = await provider.translateText(text, targetLanguage, sourceLanguage)
        
        if (result.success && result.data) {
          console.log(`${provider.name} 翻译成功`)
          return {
            success: true,
            data: {
              translatedText: result.data.translatedText,
              sourceLanguage: result.data.sourceLanguage || sourceLanguage,
              targetLanguage: result.data.targetLanguage || targetLanguage,
              confidence: result.data.confidence || 0.8,
              provider: provider.name
            }
          }
        } else {
          console.warn(`${provider.name} 翻译失败:`, result.error)
          // 标记该提供商为不健康
          this.healthStatus[provider.name] = false
        }
      } catch (error) {
        console.error(`${provider.name} 翻译异常:`, error)
        // 标记该提供商为不健康
        this.healthStatus[provider.name] = false
      }
    }

    // 所有提供商都失败，返回原文
    return {
      success: false,
      error: '所有翻译服务都不可用',
      data: {
        translatedText: text,
        sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage,
        targetLanguage,
        confidence: 0,
        provider: 'Fallback'
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
    if (!texts || texts.length === 0) {
      return {
        success: true,
        data: []
      }
    }

    // 更新健康状态
    await this.updateHealthStatus()

    // 尝试每个提供商
    for (const provider of this.providers) {
      try {
        console.log(`尝试使用 ${provider.name} 批量翻译...`)
        
        const result = await provider.batchTranslate(texts, targetLanguage, sourceLanguage)
        
        if (result.success && result.data) {
          console.log(`${provider.name} 批量翻译成功`)
          return result
        } else {
          console.warn(`${provider.name} 批量翻译失败:`, result.error)
        }
      } catch (error) {
        console.error(`${provider.name} 批量翻译异常:`, error)
      }
    }

    // 所有提供商都失败，返回原文
    return {
      success: false,
      error: '所有翻译服务都不可用',
      data: texts
    }
  }

  /**
   * 词典回退翻译
   */
  private async dictionaryFallback(
    text: string,
    targetLang: string,
    sourceLang: string = 'auto'
  ): Promise<ApiResponse<TranslationResult>> {
    // 简单的词典映射
    const dictionary: { [key: string]: { [key: string]: string } } = {
      'en': {
        'hello': '你好',
        'world': '世界',
        'job': '工作',
        'company': '公司',
        'remote': '远程',
        'work': '工作',
        'developer': '开发者',
        'engineer': '工程师',
        'manager': '经理',
        'designer': '设计师',
        'analyst': '分析师',
        'consultant': '顾问',
        'specialist': '专家',
        'coordinator': '协调员',
        'assistant': '助理',
        'intern': '实习生',
        'freelance': '自由职业',
        'contract': '合同',
        'full-time': '全职',
        'part-time': '兼职',
        'salary': '薪资',
        'benefits': '福利',
        'experience': '经验',
        'skills': '技能',
        'requirements': '要求',
        'responsibilities': '职责',
        'location': '地点',
        'apply': '申请',
        'application': '申请',
        'resume': '简历',
        'interview': '面试'
      }
    }

    const words = text.toLowerCase().split(/\s+/)
    const translatedWords: string[] = []
    
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '')
      if (dictionary['en'] && dictionary['en'][cleanWord]) {
        translatedWords.push(dictionary['en'][cleanWord])
      } else {
        translatedWords.push(word)
      }
    }

    const translatedText = translatedWords.join(' ')
    
    return {
      success: true,
      data: {
        translatedText,
        sourceLanguage: sourceLang === 'auto' ? 'en' : sourceLang,
        targetLanguage: targetLang,
        confidence: 0.3, // 词典翻译置信度较低
        provider: 'Dictionary Fallback'
      }
    }
  }

  /**
   * 更新健康状态
   */
  private async updateHealthStatus() {
    const now = Date.now()
    
    // 对于从未检查过或者有失败服务的情况，更频繁地检查
    const hasFailedServices = Object.values(this.healthStatus).some(status => status === false)
    const checkInterval = hasFailedServices ? 30 * 1000 : this.healthCheckInterval // 失败时30秒检查一次
    
    if (now - this.lastHealthCheck < checkInterval) {
      return
    }

    this.lastHealthCheck = now
    console.log('更新翻译服务健康状态...')
    
    for (const provider of this.providers) {
      try {
        const isHealthy = await provider.checkHealth()
        this.healthStatus[provider.name] = isHealthy
        console.log(`${provider.name} 健康状态: ${isHealthy ? '✅' : '❌'}`)
      } catch (error) {
        console.error(`${provider.name} 健康检查失败:`, error)
        this.healthStatus[provider.name] = false
      }
    }
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo(): Array<{
    name: string
    priority: number
    healthy: boolean
    lastCheck: number
  }> {
    return this.providers.map(provider => ({
      name: provider.name,
      priority: provider.priority,
      healthy: this.healthStatus[provider.name] ?? false,
      lastCheck: this.lastHealthCheck
    }))
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { [code: string]: string } {
    return myMemoryTranslateService.getSupportedLanguages()
  }

  /**
   * 映射语言代码到AI服务支持的格式
   */
  private mapLanguageCode(lang: string): string {
    const langMap: { [key: string]: string } = {
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'zh': 'zh',
      'en': 'en',
      'fr': 'fr',
      'de': 'de',
      'pl': 'pl'
    }
    return langMap[lang] || 'en'
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<{ [key: string]: boolean }> {
    await this.updateHealthStatus()
    return { ...this.healthStatus }
  }
}

// 创建默认实例
export const multiTranslationService = new MultiTranslationService()