export type ClubMemberType = 'starter' | 'half_year' | 'annual'
export type LegacyMemberType = 'trial_week' | 'quarter' | 'quarter_pro' | 'year'
export type CrmMemberType = ClubMemberType | LegacyMemberType
export type CrmMembershipState = 'pending' | 'active' | 'expiring' | 'expired' | 'anomaly'
export type CrmServiceStage = 'not_started' | 'onboarding' | 'in_service' | 'follow_up' | 'paused' | 'completed'
export type CrmServiceStatus = 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface MemberCrmProfile {
  backgroundSummary: string
  detailedBackground: string
  primaryNeeds: string
  painPoints: string
  servicePlan: string
  serviceStage: CrmServiceStage
  tags: string[]
  lastContactAt: string | null
  nextFollowUpAt: string | null
  updatedAt?: string | null
}

export interface MemberCrmListItem {
  userId: string
  email: string
  username: string
  fullName: string
  memberDisplayId: number | null
  memberType: CrmMemberType
  memberStatus: string
  membershipState: CrmMembershipState
  memberCycleStartAt: string | null
  memberExpireAt: string | null
  serviceStage: CrmServiceStage
  lastContactAt: string | null
  nextFollowUpAt: string | null
  applicationCount: number
  activeRecommendationCount: number
  unavailableRecommendationCount: number
  pendingServiceCount: number
  attentionReasons: string[]
}

export interface CrmServiceRecord {
  id: string
  userId: string
  entitlementKey: string | null
  serviceType: string
  title: string
  status: CrmServiceStatus
  scheduledAt: string | null
  completedAt: string | null
  details: string
  outcome: string
  createdAt: string
  updatedAt: string
  createdByName?: string
}

export interface CrmEntitlement {
  key: string
  name: string
  description: string
  status: string
  totalQuota: number | null
  usedQuota: number
  remainingQuota: number | null
  expiresAt: string | null
  appointmentAt: string | null
  completedAt: string | null
  note: string
}

export interface CrmApplicationEvent {
  id: string
  status: string
  note: string
  eventAt: string
  nextFollowUpAt: string | null
  createdByName?: string
}

export interface CrmApplication {
  id: string
  sourceKind: 'site' | 'manual'
  sourceInteractionId: number | null
  jobId: string | null
  jobTitle: string
  companyName: string
  jobUrl: string
  applicationChannel: string
  status: string
  appliedAt: string | null
  updatedAt: string | null
  notes: string
  jobAvailability: 'active' | 'unavailable' | 'deleted' | 'external'
  events: CrmApplicationEvent[]
}

export interface CrmResumeDocument {
  id: string
  source: 'user' | 'crm'
  fileName: string
  fileType: string
  fileSize: number
  parseStatus: string
  notes?: string
  createdAt: string
}

export interface CrmRecommendationJob {
  jobId: string
  title: string
  company: string
  status: 'active' | 'unavailable' | 'deleted'
}

export interface CrmRecommendationBundle {
  id: number
  title: string
  isActive: boolean
  scheduleState: 'upcoming' | 'active' | 'expired'
  startTime: string | null
  endTime: string | null
  jobs: CrmRecommendationJob[]
}

export interface CrmAuditItem {
  id: number
  action: string
  entityType: string
  entityId: string | null
  changedFields: string[]
  metadata: Record<string, unknown>
  createdAt: string
  adminName: string
}

export interface MemberCrmDetail {
  member: MemberCrmListItem & {
    avatar: string
    title: string
    location: string
    targetRole: string
    bio: string
    phone: string
    website: string
    linkedin: string
    github: string
    summary: string
    experience: unknown[]
    education: unknown[]
    skills: unknown[]
  }
  crmProfile: MemberCrmProfile
  entitlements: CrmEntitlement[]
  services: CrmServiceRecord[]
  applications: CrmApplication[]
  userResumes: CrmResumeDocument[]
  crmResumes: CrmResumeDocument[]
  recommendationBundles: CrmRecommendationBundle[]
  auditLog: CrmAuditItem[]
  canEdit: boolean
}

export interface MemberCrmSummary {
  active: number
  expiring: number
  followUpDue: number
  recommendationAttention: number
}

export interface MemberCrmListResponse {
  items: MemberCrmListItem[]
  summary: MemberCrmSummary
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  canEdit: boolean
}
