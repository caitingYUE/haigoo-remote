/**
 * AI服务模块统一导出
 * 提供所有AI相关服务的便捷访问入口
 */

// 导入服务实例
import { aiService } from './ai-service'
import { resumeService } from './resume-service'
import { jobService } from './job-service'
import { httpClient } from './http-client'
import { errorHandler } from './error-handler'

// 核心服务
export { aiService } from './ai-service'
export { resumeService } from './resume-service'
export { jobService } from './job-service'

// 工具和配置
export { httpClient } from './http-client'
export { errorHandler, ErrorType, withRetry } from './error-handler'
export { ALIBABA_BAILIAN_CONFIG, validateConfig } from './config'

// 类型定义
export type {
  // 基础类型
  ApiResponse,
  ApiError,
  BailianRequest,
  BailianResponse,
  BailianMessage,
  
  // 简历相关
  ResumeOptimizationRequest,
  ResumeOptimizationResponse,
  
  // 职位相关
  JobMatchRequest,
  JobMatchResponse,
  JobRecommendationRequest,
  JobRecommendationResponse,
  InterviewPrepRequest,
  InterviewPrepResponse,
  SkillAssessmentRequest,
  SkillAssessmentResponse,
  
  // 配置和状态
  RequestConfig,
  ServiceStatus
} from './types'

// 便捷的服务实例
export const services = {
  ai: aiService,
  resume: resumeService,
  job: jobService,
  http: httpClient,
  error: errorHandler
} as const

// 服务健康检查
export async function checkServicesHealth() {
  try {
    const healthStatus = await aiService.checkServiceHealth()
    return {
      success: true,
      data: {
        ai: healthStatus,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '健康检查失败'
    }
  }
}