export interface Job {
  id: string
  title: string
  company: string
  location: string
  type: 'full-time' | 'part-time' | 'contract' | 'remote' | 'freelance' | 'internship'
  salary: {
    min: number
    max: number
    currency: string
  }
  description: string
  requirements: string[]
  responsibilities: string[]
  skills: string[]
  postedAt: string
  expiresAt: string
  source: string
  sourceUrl?: string
  logo?: string
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