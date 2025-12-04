export interface Job {
  id: string
  title: string
  company?: string  // 可选，避免显示"未知公司"
  location: string
  type: 'full-time' | 'part-time' | 'contract' | 'remote' | 'freelance' | 'internship'
  region?: 'domestic' | 'overseas' | 'both'
  salary?: {
    min: number
    max: number
    currency: string
  }
  description?: string  // 可选，避免显示"暂无描述"
  requirements: string[]
  responsibilities: string[]
  benefits?: string[]
  skills: string[]
  postedAt: string
  expiresAt?: string  // 可选，避免虚假过期时间
  source: string
  sourceUrl?: string
  logo?: string
  // RSS数据扩展字段
  experienceLevel?: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive'
  category?: string
  isRemote?: boolean
  remoteLocationRestriction?: string
  // 推荐度得分 (0-100) - 只有真实数据才设置
  recommendationScore?: number
  // 推荐相关字段
  recommendationId?: string  // 推荐唯一ID，用于关联推荐时间
  recommendedAt?: string     // 推荐时间戳 (ISO 8601 format)
  recommendationGroup?: number // 推荐组别 (1或2，每天2组推荐)
  // 翻译字段 - 用于存储中文翻译，优先显示翻译内容
  translations?: {
    title?: string
    company?: string
    description?: string
    location?: string
    type?: string
    requirements?: string[]
    responsibilities?: string[]
  }
  // Trusted Company Fields
  companyId?: string
  sourceType?: 'trusted' | 'rss'
  isTrusted?: boolean
  canRefer?: boolean

  // Enterprise Fields (Synced)
  companyIndustry?: string
  companyTags?: string[]
  companyWebsite?: string
  companyDescription?: string

  // AI-generated job summary (30-50 characters)
  summary?: string

  // Featured job flag for homepage display
  isFeatured?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  title: string
  location: string
  skills: string[]
  experience: number
  resumeUrl?: string
  linkedinUrl?: string
}

export interface JobMatch {
  jobId: string
  matchScore: number
  strengths: string[]
  improvements: string[]
  recommendations: string[]
}

export interface ResumeOptimization {
  jobId: string
  originalResume: string
  optimizedResume: string
  matchScore: number
  suggestions: {
    type: 'improvement' | 'addition' | 'keyword'
    section: string
    original: string
    suggested: string
    reason: string
  }[]
  improvementAreas: string[]
  createdAt?: string
}

export interface JobFilter {
  search: string
  type: string
  salaryMin: number
  salaryMax: number
  skills: string[]
}
