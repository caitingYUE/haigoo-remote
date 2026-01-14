/**
 * AI服务核心模块
 * 封装与后端AI代理API的交互逻辑
 */

import { ALIBABA_BAILIAN_CONFIG, API_CONFIG } from './config'
import type {
  BailianRequest,
  BailianResponse,
  BailianMessage,
  ApiResponse
} from './types'

// AI服务类
export class AIService {
  constructor() {}

  /**
   * 发送消息到AI服务 (通过后端代理)
   */
  async sendMessage(
    messages: BailianMessage[],
    model?: string,
    options?: {
      maxTokens?: number
      temperature?: number
      topP?: number
      provider?: 'bailian' | 'deepseek'
      action?: string
    }
  ): Promise<ApiResponse<BailianResponse>> {
    const provider = options?.provider || 'bailian'
    const action = options?.action || 'analyze-resume'
    
    // Construct payload for proxy
    const payload = {
      messages,
      model,
      provider,
      parameters: {
        max_tokens: options?.maxTokens || API_CONFIG.maxTokens,
        temperature: options?.temperature || API_CONFIG.temperature,
        top_p: options?.topP
      }
    }

    try {
      const response = await fetch(`/api/ai?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!data.success) {
         return {
           success: false,
           error: data.error,
           message: data.message || 'AI Service Error'
         }
      }

      return {
        success: true,
        data: data.data
      }

    } catch (error) {
      console.error('AI Proxy Request Failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Error',
        message: 'AI Service Call Failed'
      }
    }
  }

  /**
   * 创建系统消息
   */
  createSystemMessage(content: string): BailianMessage {
    return {
      role: 'system',
      content
    }
  }

  /**
   * 创建用户消息
   */
  createUserMessage(content: string): BailianMessage {
    return {
      role: 'user',
      content
    }
  }

  /**
   * 创建助手消息
   */
  createAssistantMessage(content: string): BailianMessage {
    return {
      role: 'assistant',
      content
    }
  }

  /**
   * 构建对话上下文
   */
  buildConversation(
    systemPrompt: string,
    userInput: string,
    previousMessages?: BailianMessage[]
  ): BailianMessage[] {
    const messages: BailianMessage[] = []

    // 1. 添加系统提示词
    messages.push(this.createSystemMessage(systemPrompt))

    // 2. 添加历史消息（如果存在）
    if (previousMessages && previousMessages.length > 0) {
      messages.push(...previousMessages)
    }

    // 3. 添加用户当前输入
    messages.push(this.createUserMessage(userInput))

    return messages
  }

  /**
   * 检查服务健康状态
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/ai?action=analyze-resume', {
        method: 'OPTIONS'
      })
      return response.ok
    } catch (e) {
      console.warn('AI Service health check failed:', e)
      return false
    }
  }
}

// 导出单例实例
export const aiService = new AIService()
