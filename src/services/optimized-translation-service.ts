/**
 * 优化后的翻译服务
 * 技术负责人优化方案：简化架构，提升性能，减少错误
 * 
 * 优化策略：
 * 1. 只使用代理服务，避免多层调用
 * 2. 添加缓存机制，减少重复翻译
 * 3. 并行处理批量翻译
 * 4. 智能错误处理和重试机制
 */

import { proxyTranslationService } from './proxy-translation-service'
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
  cached?: boolean
  responseTime?: number
}

/**
 * 缓存项接口
 */
interface CacheItem {
  result: TranslationResult
  timestamp: number
  hits: number
}

/**
 * 优化后的翻译服务类
 */
export class OptimizedTranslationService {
  private cache: Map<string, CacheItem> = new Map()
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时缓存
  private readonly MAX_CACHE_SIZE = 1000 // 最大缓存条目数
  private readonly BATCH_SIZE = 10 // 批量处理大小
  private readonly RETRY_ATTEMPTS = 2 // 重试次数
  private readonly RETRY_DELAY = 1000 // 重试延迟(ms)

  /**
   * 生成缓存键
   */
  private getCacheKey(text: string, targetLang: string, sourceLang: string): string {
    return `${sourceLang}:${targetLang}:${text.toLowerCase().trim()}`
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key))

    // 如果缓存仍然过大，删除最少使用的条目
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits)
      
      const toDelete = sortedEntries.slice(0, this.cache.size - this.MAX_CACHE_SIZE)
      toDelete.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * 从缓存获取翻译结果
   */
  private getFromCache(text: string, targetLang: string, sourceLang: string): TranslationResult | null {
    const key = this.getCacheKey(text, targetLang, sourceLang)
    const item = this.cache.get(key)

    if (item && Date.now() - item.timestamp < this.CACHE_TTL) {
      item.hits++
      return {
        ...item.result,
        cached: true
      }
    }

    return null
  }

  /**
   * 将结果存入缓存
   */
  private setCache(text: string, targetLang: string, sourceLang: string, result: TranslationResult): void {
    const key = this.getCacheKey(text, targetLang, sourceLang)
    
    this.cache.set(key, {
      result: { ...result, cached: false },
      timestamp: Date.now(),
      hits: 1
    })

    // 定期清理缓存
    if (this.cache.size % 100 === 0) {
      this.cleanExpiredCache()
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 带重试的翻译请求
   */
  private async translateWithRetry(
    text: string,
    targetLang: string,
    sourceLang: string,
    attempt: number = 1
  ): Promise<ApiResponse<TranslationResult>> {
    const startTime = Date.now()

    try {
      const result = await proxyTranslationService.translateText(text, targetLang, sourceLang)
      
      if (result.success && result.data) {
        const responseTime = Date.now() - startTime
        const enhancedResult = {
          ...result.data,
          responseTime
        }

        // 只缓存成功的结果
        this.setCache(text, targetLang, sourceLang, enhancedResult)
        
        return {
          success: true,
          data: enhancedResult
        }
      }

      // 如果失败且还有重试机会
      if (attempt < this.RETRY_ATTEMPTS) {
        console.warn(`翻译失败，第${attempt}次重试中...`, result.error)
        await this.delay(this.RETRY_DELAY * attempt)
        return this.translateWithRetry(text, targetLang, sourceLang, attempt + 1)
      }

      return result
    } catch (error) {
      console.error(`翻译请求失败 (尝试 ${attempt}/${this.RETRY_ATTEMPTS}):`, error)
      
      if (attempt < this.RETRY_ATTEMPTS) {
        await this.delay(this.RETRY_DELAY * attempt)
        return this.translateWithRetry(text, targetLang, sourceLang, attempt + 1)
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '翻译服务暂时不可用'
      }
    }
  }

  /**
   * 翻译单个文本（带缓存）
   */
  async translateText(
    text: string,
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<TranslationResult>> {
    try {
      // 输入验证
      if (!text || text.trim().length === 0) {
        return {
          success: true,
          data: {
            translatedText: text,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            confidence: 1.0,
            provider: 'None',
            cached: false,
            responseTime: 0
          }
        }
      }

      // 检查缓存
      const cachedResult = this.getFromCache(text, targetLanguage, sourceLanguage)
      if (cachedResult) {
        console.log('🎯 缓存命中:', text.substring(0, 50) + '...')
        return {
          success: true,
          data: cachedResult
        }
      }

      // 执行翻译
      return await this.translateWithRetry(text, targetLanguage, sourceLanguage)

    } catch (error) {
      console.error('翻译服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '翻译服务异常'
      }
    }
  }

  /**
   * 批量翻译（并行处理 + 缓存）
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

      const results: string[] = []
      const uncachedTexts: { text: string; index: number }[] = []

      // 第一步：检查缓存
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i] || ''
        
        if (text.trim().length === 0) {
          results[i] = text
          continue
        }

        const cachedResult = this.getFromCache(text, targetLanguage, sourceLanguage)
        if (cachedResult) {
          results[i] = cachedResult.translatedText
          console.log(`🎯 批量缓存命中 [${i}]:`, text.substring(0, 30) + '...')
        } else {
          uncachedTexts.push({ text, index: i })
        }
      }

      // 第二步：并行处理未缓存的文本
      if (uncachedTexts.length > 0) {
        console.log(`🚀 并行翻译 ${uncachedTexts.length} 个文本`)
        
        // 分批处理，避免过多并发请求
        const batches: Array<{ text: string; index: number }[]> = []
        for (let i = 0; i < uncachedTexts.length; i += this.BATCH_SIZE) {
          batches.push(uncachedTexts.slice(i, i + this.BATCH_SIZE))
        }

        for (const batch of batches) {
          const batchPromises = batch.map(async ({ text, index }) => {
            const result = await this.translateWithRetry(text, targetLanguage, sourceLanguage)
            return { result, index, originalText: text }
          })

          const batchResults = await Promise.allSettled(batchPromises)
          
          batchResults.forEach((promiseResult, batchIndex) => {
            const { text: originalText, index } = batch[batchIndex]
            
            if (promiseResult.status === 'fulfilled') {
              const { result } = promiseResult.value
              if (result.success && result.data) {
                results[index] = result.data.translatedText
              } else {
                results[index] = originalText // 失败时返回原文
                console.warn(`批量翻译失败 [${index}]:`, result.error)
              }
            } else {
              results[index] = originalText // 异常时返回原文
              console.error(`批量翻译异常 [${index}]:`, promiseResult.reason)
            }
          })

          // 批次间短暂延迟，避免API限流
          if (batches.length > 1) {
            await this.delay(200)
          }
        }
      }

      return {
        success: true,
        data: results
      }

    } catch (error) {
      console.error('批量翻译服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '批量翻译服务异常',
        data: texts // 返回原文数组作为回退
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
    totalHits: number
  } {
    let totalHits = 0
    let totalRequests = 0

    for (const item of this.cache.values()) {
      totalHits += item.hits
      totalRequests += item.hits
    }

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
    console.log('🗑️ 翻译缓存已清空')
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const result = await proxyTranslationService.checkHealth()
      return result
    } catch (error) {
      console.error('健康检查失败:', error)
      return false
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { [code: string]: string } {
    return proxyTranslationService.getSupportedLanguages()
  }

  /**
   * 获取服务信息
   */
  getServiceInfo() {
    const cacheStats = this.getCacheStats()
    const proxyInfo = proxyTranslationService.getServiceInfo()
    
    return {
      name: 'Optimized Translation Service',
      version: '2.0.0',
      provider: proxyInfo.provider,
      endpoint: proxyInfo.endpoint,
      features: [
        'Smart Caching',
        'Parallel Processing',
        'Auto Retry',
        'Performance Monitoring'
      ],
      cache: cacheStats,
      cost: 'Free',
      performance: {
        batchSize: this.BATCH_SIZE,
        retryAttempts: this.RETRY_ATTEMPTS,
        cacheEnabled: true
      }
    }
  }
}

// 导出单例实例
export const optimizedTranslationService = new OptimizedTranslationService()