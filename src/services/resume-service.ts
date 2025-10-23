/**
 * 简历优化服务
 * 提供简历分析、优化、评分等功能
 */

import { aiService } from './ai-service'
import { ALIBABA_BAILIAN_CONFIG } from './config'
import type {
  ResumeOptimizationRequest,
  ResumeOptimizationResponse,
  ApiResponse,
  BailianMessage
} from './types'

export class ResumeService {
  /**
   * 优化简历内容
   */
  async optimizeResume(request: ResumeOptimizationRequest): Promise<ApiResponse<ResumeOptimizationResponse>> {
    try {
      const systemPrompt = this.buildOptimizationPrompt(request.optimizationType)
      const userPrompt = this.buildUserPrompt(request)
      
      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(userPrompt)
      ]

      const response = await aiService.sendMessage(
        messages,
        ALIBABA_BAILIAN_CONFIG.models.qwen,
        {
          maxTokens: 3000,
          temperature: 0.7
        }
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '简历优化失败',
          message: '无法获取优化建议'
        }
      }

      // 解析AI响应
      const optimizationResult = this.parseOptimizationResponse(response.data.output.text)
      
      return {
        success: true,
        data: optimizationResult
      }

    } catch (error) {
      console.error('简历优化服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: '简历优化服务异常'
      }
    }
  }

  /**
   * 分析简历质量
   */
  async analyzeResume(resumeContent: string): Promise<ApiResponse<{
    score: number
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
  }>> {
    try {
      const systemPrompt = `你是一位专业的简历分析师，请分析用户提供的简历内容，从以下维度进行评估：
1. 内容完整性和结构
2. 技能匹配度
3. 工作经验描述
4. 教育背景
5. 格式和可读性

请以JSON格式返回分析结果，包含：
- score: 总体评分(0-100)
- strengths: 优势列表
- weaknesses: 不足之处
- suggestions: 改进建议`

      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(`请分析以下简历内容：\n\n${resumeContent}`)
      ]

      const response = await aiService.sendMessage(messages)

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '简历分析失败'
        }
      }

      const analysisResult = this.parseAnalysisResponse(response.data.output.text)
      
      return {
        success: true,
        data: analysisResult
      }

    } catch (error) {
      console.error('简历分析服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 生成简历关键词建议
   */
  async suggestKeywords(resumeContent: string, targetPosition?: string): Promise<ApiResponse<{
    currentKeywords: string[]
    suggestedKeywords: string[]
    industryKeywords: string[]
  }>> {
    try {
      const systemPrompt = `你是一位简历关键词专家，请分析简历内容并提供关键词建议。
请以JSON格式返回：
- currentKeywords: 简历中已有的关键词
- suggestedKeywords: 建议添加的关键词
- industryKeywords: 行业相关关键词`

      const userPrompt = targetPosition 
        ? `目标职位：${targetPosition}\n\n简历内容：\n${resumeContent}`
        : `简历内容：\n${resumeContent}`

      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(userPrompt)
      ]

      const response = await aiService.sendMessage(messages)

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '关键词分析失败'
        }
      }

      const keywordResult = this.parseKeywordResponse(response.data.output.text)
      
      return {
        success: true,
        data: keywordResult
      }

    } catch (error) {
      console.error('关键词建议服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 构建优化提示词
   */
  private buildOptimizationPrompt(type: string): string {
    const basePrompt = `你是一位专业的简历优化专家，拥有丰富的HR和招聘经验。`

    const typePrompts = {
      general: `请对用户的简历进行全面优化，提升整体质量和吸引力。`,
      'job-specific': `请根据目标职位要求，优化简历内容，突出相关技能和经验。`,
      skills: `请重点优化简历中的技能部分，确保技能描述准确、完整且有吸引力。`,
      format: `请优化简历的格式和结构，提升可读性和专业性。`
    }

    return `${basePrompt}${typePrompts[type as keyof typeof typePrompts] || typePrompts.general}

请以JSON格式返回优化结果，包含：
- optimizedResume: 优化后的简历内容
- suggestions: 具体的优化建议列表
- improvements: 改进点详情，包含category(类别)、description(描述)、priority(优先级)
- score: 评分信息，包含overall(总分)和categories(各维度分数)`
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(request: ResumeOptimizationRequest): string {
    let prompt = `简历内容：\n${request.resumeContent}`

    if (request.jobDescription) {
      prompt += `\n\n目标职位描述：\n${request.jobDescription}`
    }

    if (request.targetPosition) {
      prompt += `\n\n目标职位：${request.targetPosition}`
    }

    return prompt
  }

  /**
   * 解析优化响应
   */
  private parseOptimizationResponse(responseText: string): ResumeOptimizationResponse {
    try {
      // 尝试解析JSON响应
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          optimizedResume: parsed.optimizedResume || responseText,
          suggestions: parsed.suggestions || [],
          improvements: parsed.improvements || [],
          score: parsed.score || {
            overall: 75,
            categories: {
              content: 75,
              format: 75,
              keywords: 75,
              relevance: 75
            }
          }
        }
      }
    } catch (error) {
      console.warn('解析JSON响应失败，使用文本解析:', error)
    }

    // 如果JSON解析失败，使用文本解析
    return {
      optimizedResume: responseText,
      suggestions: this.extractSuggestions(responseText),
      improvements: [],
      score: {
        overall: 75,
        categories: {
          content: 75,
          format: 75,
          keywords: 75,
          relevance: 75
        }
      }
    }
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(responseText: string): {
    score: number
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
  } {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('解析分析响应失败:', error)
    }

    return {
      score: 75,
      strengths: ['简历结构清晰'],
      weaknesses: ['需要更多具体的成就描述'],
      suggestions: ['添加量化的工作成果', '优化技能关键词']
    }
  }

  /**
   * 解析关键词响应
   */
  private parseKeywordResponse(responseText: string): {
    currentKeywords: string[]
    suggestedKeywords: string[]
    industryKeywords: string[]
  } {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('解析关键词响应失败:', error)
    }

    return {
      currentKeywords: [],
      suggestedKeywords: [],
      industryKeywords: []
    }
  }

  /**
   * 从文本中提取建议
   */
  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (line.includes('建议') || line.includes('优化') || line.includes('改进')) {
        suggestions.push(line.trim())
      }
    }

    return suggestions.length > 0 ? suggestions : ['请根据AI反馈进行相应优化']
  }
}

// 创建默认的简历服务实例
export const resumeService = new ResumeService()