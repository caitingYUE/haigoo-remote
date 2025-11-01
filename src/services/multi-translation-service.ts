/**
 * 多翻译服务管理器 - 优化版本
 * 
 * 技术负责人优化决策：
 * 1. 简化架构：只使用优化后的代理服务
 * 2. 减少错误传播：单一服务链路
 * 3. 提升性能：内置缓存和并行处理
 * 4. 降低维护成本：统一的错误处理和监控
 */

import { optimizedTranslationService } from './optimized-translation-service'
import type { ApiResponse } from './types'

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
 * 多翻译服务管理器 - 优化版本
 */
export class MultiTranslationService {
  private readonly service = optimizedTranslationService

  constructor() {
    console.log('🚀 多翻译服务已初始化 - 优化版本')
    this.logServiceInfo()
  }

  private logServiceInfo() {
    const info = this.service.getServiceInfo()
    console.log('📊 翻译服务信息:', {
      name: info.name,
      version: info.version,
      features: info.features,
      cost: info.cost
    })
  }

  /**
   * 翻译单个文本
   */
  async translateText(
    text: string,
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<TranslationResult>> {
    return await this.service.translateText(text, targetLanguage, sourceLanguage)
  }

  /**
   * 批量翻译
   */
  async batchTranslate(
    texts: string[],
    targetLanguage: string = 'zh-CN',
    sourceLanguage: string = 'auto'
  ): Promise<ApiResponse<string[]>> {
    return await this.service.batchTranslate(texts, targetLanguage, sourceLanguage)
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    return await this.service.checkHealth()
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): { [code: string]: string } {
    return this.service.getSupportedLanguages()
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.service.getCacheStats()
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.service.clearCache()
  }

  /**
   * 获取服务信息
   */
  getServiceInfo() {
    return this.service.getServiceInfo()
  }

  /**
   * 获取可用的翻译提供商列表（向后兼容）
   */
  getAvailableProviders(): string[] {
    const info = this.service.getServiceInfo()
    return [info.provider]
  }

  /**
   * 获取当前活跃的提供商（向后兼容）
   */
  getCurrentProvider(): string {
    const info = this.service.getServiceInfo()
    return info.provider
  }
}

// 导出单例实例
export const multiTranslationService = new MultiTranslationService()