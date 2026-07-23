export type JobApplyMode = 'website' | 'email' | 'referral' | 'unavailable'

export interface JobApplicationInfo {
  mode: JobApplyMode
  websiteUrl?: string
  hiringEmail?: string
  emailType?: string
  hasWebsiteApply: boolean
  hasEmailApply: boolean
  hasReferral: boolean
}

export interface MiniJob {
  id: string
  title: string
  originalTitle?: string
  company: string
  companyColor: string
  logoUrl?: string
  location: string
  region?: 'domestic' | 'overseas' | 'global' | 'both' | 'unclassified'
  type: string
  salary: string
  category?: string
  experienceLevel?: string
  tags: string[]
  matchScore?: number
  matchLabel?: string
  displayBand?: 'hidden' | 'common' | 'high'
  memberOnly?: boolean
  featured?: boolean
  canRefer?: boolean
  isTrusted?: boolean
  sourceType?: string
  status?: string
  applicationCount?: number
  application: JobApplicationInfo
  description: string
  originalDescription?: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  companyIndustry?: string
  companyAddress?: string
  companyRating?: string
  companyDescription?: string
  companyWebsite?: string
  companyTags?: string[]
  ratingSource?: string
  publishedAt?: string
  publishedLabel: string
}

export interface JobsResponse {
  jobs: MiniJob[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  categories: Array<{ label: string; value: string; count: number }>
  browse?: {
    viewedCount: number
    remaining: number | null
    limited: boolean
  }
}

export interface JobDetailSection {
  id: string
  title: string
  paragraphs: string[]
  items: string[]
}

export interface LearningVideo {
  id: string
  title: string
  category: string
  duration: string
  level: string
  description: string
  accent: string
  locked?: boolean
  featured?: boolean
}
