export interface MiniCompany {
  id: string
  name: string
  description: string
  industry: string
  tags: string[]
  specialties: string[]
  address: string
  employeeCount: string
  foundedYear: string
  rating: number | null
  logoFileId: string
  logoUrl?: string
  updatedAt: string | null
  websiteUrl?: string
  hasPublicOpportunity?: boolean
  publicOpportunityUpdatedAt?: string | null
  remoteWork?: string[]
  culture?: ContentBlock[]
  ceoInsights?: ContentBlock[]
  insightsLocked?: boolean
}

export interface ContentBlock {
  id?: string
  type: 'heading_1' | 'heading_2' | 'paragraph' | 'quote' | 'bullet_list' | 'numbered_list' | string
  text?: string
  items?: string[]
}

export interface GrowthNote {
  id: string
  title: string
  titleZh?: string
  summary: string
  originType: 'video' | 'original' | 'external'
  authorName: string
  sourceName: string
  sourceUrl?: string
  category: string
  difficulty: string
  tags: string[]
  accessTier: 'free' | 'vip'
  unlocked: boolean
  isFeatured: boolean
  publishedAt: string | null
  updatedAt: string | null
  durationMinutes: number | null
  coverAspectRatio: number | null
  coverFileId?: string
  coverUrl?: string
  notes?: ContentBlock[]
  audio?: { fileId: string; durationSeconds: number | null } | null
}

export type CareerRetentionPolicy = 'session' | '30_days' | '90_days' | 'long_term'

export interface CareerIntake {
  location: string
  timezone: string
  workMode: string
  weeklyHours: number
  availability: string
  eveningOverlap: string
  languages: string
  targetRoles: string
  careerGoal: string
  constraints: string
}

export interface CareerCompleteness {
  checks: Array<{ key: string; label: string; complete: boolean }>
  completeCount: number
  total: number
}

export interface CareerPath {
  roleName: string
  whyFit: string
  mainGaps: string[]
  preparationActions: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface CareerCompanyMatch {
  id: string
  name: string
  industry: string
  description: string
  fitLevel: 'current' | 'explore' | 'research'
  reasons: string[]
  caution: string
}

export interface CareerMatchResult {
  summary: { headline: string; positioning: string; consultantBrief?: string }
  strengths: Array<{ title: string; explanation: string; confidence: string }>
  careerPaths: { now: CareerPath[]; bridge: CareerPath[]; later: CareerPath[] }
  candidateProfile: Record<string, unknown>
  clarificationQuestions: Array<{ question: string; reason: string; priority: string }>
  remoteReadiness: Array<{ key: string; label: string; confirmed: boolean }>
  companies: CareerCompanyMatch[]
}

export interface CareerMatchState {
  success: true
  profile: null | {
    profile_id: string
    source_type: 'manual' | 'resume'
    career_text: string
    intake: CareerIntake
    structured_profile?: Record<string, unknown>
    profile_hash?: string | null
    profile_completeness?: number
    retention_policy: CareerRetentionPolicy
    expires_at: string | null
    version: number
    updated_at: string
  }
  freeAssessmentAvailable: boolean
  canAssess: boolean
  isMember: boolean
  retentionReviewDue: boolean
  latestRun: null | {
    run_id: string
    status: 'needs_clarification' | 'ready'
    clarification_questions: CareerMatchResult['clarificationQuestions']
    result: CareerMatchResult | null
    created_at: string
  }
}

export interface MiniMembershipPlan {
  id: string
  memberType: string
  name: string
  shortLabel: string
  price: number
  currency: string
  durationDays: number
  durationMonths: number
  description: string
  featured: boolean
  features: string[]
}

export interface ConsultationRequest {
  id: string
  consultation_topic: string
  wechat_id?: string
  question?: string
  source_page?: string
  status: string
  created_at: string
  updated_at?: string
}
