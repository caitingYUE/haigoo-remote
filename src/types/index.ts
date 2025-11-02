export interface Job {
  id: string
  title: string
  company?: string  // 可选，避免显示"未知公司"
  location: string
  type: 'full-time' | 'part-time' | 'contract' | 'remote' | 'freelance' | 'internship'
  salary?: {
    min: number
    max: number
    currency: string
  }
  description?: string  // 可选，避免显示"暂无描述"
  requirements: string[]
  responsibilities: string[]
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