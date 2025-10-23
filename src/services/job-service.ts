/**
 * 职位服务
 * 提供职位匹配、推荐、面试准备等功能
 */

import { aiService } from './ai-service'
import { ALIBABA_BAILIAN_CONFIG } from './config'
import type {
  JobMatchRequest,
  JobMatchResponse,
  JobRecommendationRequest,
  JobRecommendationResponse,
  InterviewPrepRequest,
  InterviewPrepResponse,
  SkillAssessmentRequest,
  SkillAssessmentResponse,
  ApiResponse,
  BailianMessage
} from './types'

export class JobService {
  /**
   * 职位匹配分析
   */
  async analyzeJobMatch(request: JobMatchRequest): Promise<ApiResponse<JobMatchResponse>> {
    try {
      const systemPrompt = `你是一位专业的职位匹配分析师，请分析简历与职位描述的匹配度。

请以JSON格式返回分析结果，包含：
- matchScore: 匹配度评分(0-100)
- strengths: 匹配的优势列表
- gaps: 技能或经验差距列表
- recommendations: 提升匹配度的建议
- keywordMatch: 关键词匹配情况，包含matched(匹配的关键词)和missing(缺失的关键词)`

      const userPrompt = `简历内容：
${request.resumeContent}

职位描述：
${request.jobDescription}

${request.requirements ? `职位要求：\n${request.requirements.join('\n')}` : ''}`

      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(userPrompt)
      ]

      const response = await aiService.sendMessage(
        messages,
        ALIBABA_BAILIAN_CONFIG.models.qwen,
        {
          maxTokens: 2000,
          temperature: 0.3
        }
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '职位匹配分析失败'
        }
      }

      const matchResult = this.parseJobMatchResponse(response.data.output.text)
      
      return {
        success: true,
        data: matchResult
      }

    } catch (error) {
      console.error('职位匹配服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 职位推荐
   */
  async recommendJobs(request: JobRecommendationRequest): Promise<ApiResponse<JobRecommendationResponse>> {
    try {
      const systemPrompt = `你是一位专业的职业顾问，请根据用户的技能和偏好推荐合适的职位。

请以JSON格式返回推荐结果，包含：
- recommendations: 推荐职位列表，每个包含jobId、title、company、matchScore、reasons`

      const userPrompt = this.buildRecommendationPrompt(request)

      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(userPrompt)
      ]

      const response = await aiService.sendMessage(
        messages,
        ALIBABA_BAILIAN_CONFIG.models.qwen,
        {
          maxTokens: 2500,
          temperature: 0.5
        }
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '职位推荐失败'
        }
      }

      const recommendationResult = this.parseRecommendationResponse(response.data.output.text)
      
      return {
        success: true,
        data: recommendationResult
      }

    } catch (error) {
      console.error('职位推荐服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 面试准备
   */
  async prepareInterview(request: InterviewPrepRequest): Promise<ApiResponse<InterviewPrepResponse>> {
    try {
      const systemPrompt = `你是一位专业的面试教练，请根据职位描述和简历内容，为用户准备面试问题和建议。

请以JSON格式返回面试准备内容，包含：
- questions: 面试问题列表，每个包含question、type、difficulty、suggestedAnswer、tips
- preparation_tips: 面试准备建议列表`

      const userPrompt = `面试类型：${request.interviewType}

职位描述：
${request.jobDescription}

简历内容：
${request.resumeContent}`

      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(userPrompt)
      ]

      const response = await aiService.sendMessage(
        messages,
        ALIBABA_BAILIAN_CONFIG.models.qwen,
        {
          maxTokens: 3000,
          temperature: 0.6
        }
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '面试准备失败'
        }
      }

      const interviewResult = this.parseInterviewResponse(response.data.output.text)
      
      return {
        success: true,
        data: interviewResult
      }

    } catch (error) {
      console.error('面试准备服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 技能评估
   */
  async assessSkills(request: SkillAssessmentRequest): Promise<ApiResponse<SkillAssessmentResponse>> {
    try {
      const systemPrompt = `你是一位专业的技能评估师，请根据用户的技能和经验进行评估。

请以JSON格式返回评估结果，包含：
- assessments: 技能评估列表，每个包含skill、level、confidence、recommendations
- overallScore: 整体评分(0-100)
- improvementAreas: 需要改进的领域列表`

      const userPrompt = `用户技能：${request.skills.join(', ')}

工作经验：
${request.experience}

${request.jobRequirements ? `职位要求：\n${request.jobRequirements.join('\n')}` : ''}`

      const messages: BailianMessage[] = [
        aiService.createSystemMessage(systemPrompt),
        aiService.createUserMessage(userPrompt)
      ]

      const response = await aiService.sendMessage(
        messages,
        ALIBABA_BAILIAN_CONFIG.models.qwen,
        {
          maxTokens: 2000,
          temperature: 0.4
        }
      )

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || '技能评估失败'
        }
      }

      const assessmentResult = this.parseSkillAssessmentResponse(response.data.output.text)
      
      return {
        success: true,
        data: assessmentResult
      }

    } catch (error) {
      console.error('技能评估服务错误:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 构建推荐提示词
   */
  private buildRecommendationPrompt(request: JobRecommendationRequest): string {
    const { userProfile, limit = 5 } = request
    
    let prompt = `用户技能：${userProfile.skills.join(', ')}\n\n`
    prompt += `工作经验：\n${userProfile.experience}\n\n`
    
    if (userProfile.preferences.location) {
      prompt += `期望地点：${userProfile.preferences.location}\n`
    }
    
    if (userProfile.preferences.salary) {
      prompt += `期望薪资：${userProfile.preferences.salary.min}-${userProfile.preferences.salary.max}\n`
    }
    
    if (userProfile.preferences.jobType) {
      prompt += `工作类型：${userProfile.preferences.jobType}\n`
    }
    
    if (userProfile.preferences.industry && userProfile.preferences.industry.length > 0) {
      prompt += `期望行业：${userProfile.preferences.industry.join(', ')}\n`
    }
    
    prompt += `\n请推荐${limit}个最适合的职位。`
    
    return prompt
  }

  /**
   * 解析职位匹配响应
   */
  private parseJobMatchResponse(responseText: string): JobMatchResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('解析职位匹配响应失败:', error)
    }

    return {
      matchScore: 75,
      strengths: ['技能匹配度较高'],
      gaps: ['需要更多相关经验'],
      recommendations: ['提升相关技能', '积累项目经验'],
      keywordMatch: {
        matched: [],
        missing: []
      }
    }
  }

  /**
   * 解析推荐响应
   */
  private parseRecommendationResponse(responseText: string): JobRecommendationResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('解析推荐响应失败:', error)
    }

    return {
      recommendations: [
        {
          jobId: 'sample-1',
          title: '前端开发工程师',
          company: '科技公司',
          matchScore: 85,
          reasons: ['技能匹配度高', '经验符合要求']
        }
      ]
    }
  }

  /**
   * 解析面试响应
   */
  private parseInterviewResponse(responseText: string): InterviewPrepResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('解析面试响应失败:', error)
    }

    return {
      questions: [
        {
          question: '请介绍一下你的工作经验',
          type: 'behavioral',
          difficulty: 'easy',
          tips: ['准备具体的项目案例', '突出个人贡献']
        }
      ],
      preparation_tips: ['准备自我介绍', '了解公司背景', '准备技术问题']
    }
  }

  /**
   * 解析技能评估响应
   */
  private parseSkillAssessmentResponse(responseText: string): SkillAssessmentResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (error) {
      console.warn('解析技能评估响应失败:', error)
    }

    return {
      assessments: [
        {
          skill: 'JavaScript',
          level: 'intermediate',
          confidence: 80,
          recommendations: ['深入学习ES6+特性', '练习异步编程']
        }
      ],
      overallScore: 75,
      improvementAreas: ['算法和数据结构', '系统设计']
    }
  }
}

// 创建默认的职位服务实例
export const jobService = new JobService()