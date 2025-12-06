/**
 * AI服务核心模块
 * 封装与阿里百炼API的交互逻辑
 */

import { HttpClient } from './http-client'
import { ALIBABA_BAILIAN_CONFIG, DEEPSEEK_CONFIG, API_CONFIG } from './config'
import type {
  BailianRequest,
  BailianResponse,
  BailianMessage,
  DeepSeekRequest,
  DeepSeekResponse,
  ApiResponse
} from './types'

// AI服务类
export class AIService {
  private bailianClient: HttpClient
  private deepSeekClient: HttpClient

  constructor() {
    this.bailianClient = new HttpClient(ALIBABA_BAILIAN_CONFIG.baseUrl)
    this.deepSeekClient = new HttpClient(DEEPSEEK_CONFIG.baseUrl)
  }

  /**
   * 发送消息到AI服务
   */
  async sendMessage(
    messages: BailianMessage[],
    model?: string,
    options?: {
      maxTokens?: number
      temperature?: number
      topP?: number
      provider?: 'bailian' | 'deepseek'
    }
  ): Promise<ApiResponse<BailianResponse>> {
    // 默认使用 DeepSeek，如果未配置则回退到 Bailian
    const provider = options?.provider || (DEEPSEEK_CONFIG.apiKey ? 'deepseek' : 'bailian')
    
    if (provider === 'deepseek') {
      return this.sendDeepSeekMessage(messages, model, options)
    }

    return this.sendBailianMessage(messages, model, options)
  }

  /**
   * 发送消息到阿里百炼API
   */
  private async sendBailianMessage(
    messages: BailianMessage[],
    model: string = ALIBABA_BAILIAN_CONFIG.models.qwen,
    options?: {
      maxTokens?: number
      temperature?: number
      topP?: number
    }
  ): Promise<ApiResponse<BailianResponse>> {
    const request: BailianRequest = {
      model,
      input: {
        messages
      },
      parameters: {
        max_tokens: options?.maxTokens || API_CONFIG.maxTokens,
        temperature: options?.temperature || API_CONFIG.temperature,
        top_p: options?.topP || 0.8
      }
    }

    try {
      const response = await this.bailianClient.post<BailianResponse>(
        '/services/aigc/text-generation/generation',
        request
      )

      return response
    } catch (error) {
      console.error('阿里百炼API请求失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: 'AI服务调用失败'
      }
    }
  }

  /**
   * 发送消息到 DeepSeek API
   */
  private async sendDeepSeekMessage(
    messages: BailianMessage[],
    model: string = DEEPSEEK_CONFIG.models.chat,
    options?: {
      maxTokens?: number
      temperature?: number
      topP?: number
    }
  ): Promise<ApiResponse<BailianResponse>> {
    const request: DeepSeekRequest = {
      model,
      messages,
      max_tokens: options?.maxTokens || API_CONFIG.maxTokens,
      temperature: options?.temperature || API_CONFIG.temperature,
      top_p: options?.topP || 1.0,
      stream: false
    }

    try {
      const headers = {
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }

      const response = await this.deepSeekClient.request<DeepSeekResponse>(
        '/chat/completions',
        {
          method: 'POST',
          body: request,
          headers
        }
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
          message: response.message
        }
      }

      // 转换为 BailianResponse 格式以保持兼容性
      const deepSeekData = response.data
      const mappedResponse: BailianResponse = {
        output: {
          text: deepSeekData.choices[0]?.message?.content || '',
          finish_reason: deepSeekData.choices[0]?.finish_reason || 'stop'
        },
        usage: {
          input_tokens: deepSeekData.usage?.prompt_tokens || 0,
          output_tokens: deepSeekData.usage?.completion_tokens || 0,
          total_tokens: deepSeekData.usage?.total_tokens || 0
        },
        request_id: deepSeekData.id
      }

      return {
        success: true,
        data: mappedResponse
      }
    } catch (error) {
      console.error('DeepSeek API请求失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: 'AI服务调用失败'
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
    const messages: BailianMessage[] = [
      this.createSystemMessage(systemPrompt)
    ]

    // 添加历史消息
    if (previousMessages && previousMessages.length > 0) {
      messages.push(...previousMessages)
    }

    // 添加当前用户输入
    messages.push(this.createUserMessage(userInput))

    return messages
  }

  /**
   * 流式响应处理（如果API支持）
   */
  async sendMessageStream(
    messages: BailianMessage[],
    model: string = ALIBABA_BAILIAN_CONFIG.models.qwen,
    onChunk?: (chunk: string) => void
  ): Promise<ApiResponse<string>> {
    // 注意：这里需要根据阿里百炼API的实际流式接口进行调整
    // 目前先实现非流式版本
    const response = await this.sendMessage(messages, model)
    
    if (response.success && response.data) {
      const fullText = response.data.output.text
      
      // 模拟流式输出
      if (onChunk) {
        const chunks = fullText.split(' ')
        for (const chunk of chunks) {
          onChunk(chunk + ' ')
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      
      return {
        success: true,
        data: fullText
      }
    }

    return {
      success: false,
      error: response.error,
      message: response.message
    }
  }

  /**
   * 检查服务状态
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      const testMessages: BailianMessage[] = [
        this.createSystemMessage('你是一个测试助手'),
        this.createUserMessage('测试连接')
      ]

      const response = await this.sendMessage(testMessages, ALIBABA_BAILIAN_CONFIG.models.qwen, {
        maxTokens: 10
      })

      return response.success
    } catch {
      return false
    }
  }

  /**
   * 获取模型信息
   */
  getAvailableModels() {
    return ALIBABA_BAILIAN_CONFIG.models
  }

  /**
   * 计算token数量（估算）
   */
  estimateTokens(text: string): number {
    // 简单的token估算：中文字符按1.5个token计算，英文单词按1个token计算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const otherChars = text.length - chineseChars - englishWords
    
    return Math.ceil(chineseChars * 1.5 + englishWords + otherChars * 0.5)
  }

  /**
   * 验证消息长度
   */
  validateMessageLength(messages: BailianMessage[], maxTokens: number = API_CONFIG.maxTokens): boolean {
    const totalTokens = messages.reduce((sum, message) => {
      return sum + this.estimateTokens(message.content)
    }, 0)

    return totalTokens <= maxTokens
  }
}

// 创建默认的AI服务实例
export const aiService = new AIService()