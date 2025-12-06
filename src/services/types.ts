/**
 * AI服务相关的类型定义
 */

// 基础API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  errorType?: string
  errorCode?: string
}

// 阿里百炼API请求类型
export interface BailianRequest {
  model: string
  input: {
    messages: BailianMessage[]
  }
  parameters?: {
    max_tokens?: number
    temperature?: number
    top_p?: number
    top_k?: number
    repetition_penalty?: number
    seed?: number
    stop?: string[]
  }
}

// 阿里百炼消息类型
export interface BailianMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 阿里百炼API响应类型
export interface BailianResponse {
  output: {
    text: string
    finish_reason: string
  }
  usage: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  request_id: string
}

// DeepSeek/OpenAI 消息类型
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// DeepSeek/OpenAI API请求类型
export interface DeepSeekRequest {
  model: string
  messages: DeepSeekMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
}

// DeepSeek/OpenAI API响应类型
export interface DeepSeekResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: DeepSeekMessage
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// 简历优化相关类型
export interface ResumeOptimizationRequest {
  resumeContent: string
  jobDescription?: string
  targetPosition?: string
  optimizationType: 'general' | 'job-specific' | 'skills' | 'format'
}

export interface ResumeOptimizationResponse {
  optimizedResume: string
  suggestions: string[]
  improvements: {
    category: string
    description: string
    priority: 'high' | 'medium' | 'low'
  }[]
  score: {
    overall: number
    categories: {
      content: number
      format: number
      keywords: number
      relevance: number
    }
  }
}

// 职位匹配相关类型
export interface JobMatchRequest {
  resumeContent: string
  jobDescription: string
  requirements?: string[]
}

export interface JobMatchResponse {
  matchScore: number
  strengths: string[]
  gaps: string[]
  recommendations: string[]
  keywordMatch: {
    matched: string[]
    missing: string[]
  }
}

// 职位推荐相关类型
export interface JobRecommendationRequest {
  userProfile: {
    skills: string[]
    experience: string
    preferences: {
      location?: string
      salary?: { min: number; max: number }
      jobType?: string
      industry?: string[]
    }
  }
  limit?: number
}

export interface JobRecommendationResponse {
  recommendations: {
    jobId: string
    title: string
    company: string
    matchScore: number
    reasons: string[]
  }[]
}

// 面试准备相关类型
export interface InterviewPrepRequest {
  jobDescription: string
  resumeContent: string
  interviewType: 'technical' | 'behavioral' | 'general'
}

export interface InterviewPrepResponse {
  questions: {
    question: string
    type: 'technical' | 'behavioral' | 'situational'
    difficulty: 'easy' | 'medium' | 'hard'
    suggestedAnswer?: string
    tips: string[]
  }[]
  preparation_tips: string[]
}

// 技能评估相关类型
export interface SkillAssessmentRequest {
  skills: string[]
  experience: string
  jobRequirements?: string[]
}

export interface SkillAssessmentResponse {
  assessments: {
    skill: string
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    confidence: number
    recommendations: string[]
  }[]
  overallScore: number
  improvementAreas: string[]
}

// API错误类型
export interface ApiError {
  type: 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'SERVICE_UNAVAILABLE' | 'AUTHENTICATION_ERROR' | 'VALIDATION_ERROR' | 'QUOTA_EXCEEDED' | 'MODEL_ERROR' | 'UNKNOWN_ERROR'
  code?: string
  message: string
  details?: any
  timestamp?: string
}

// 请求配置类型
export interface RequestConfig {
  timeout?: number
  retries?: number
  retryDelay?: number
}

// 服务状态类型
export interface ServiceStatus {
  isAvailable: boolean
  lastCheck: string
  responseTime?: number
  error?: string
}