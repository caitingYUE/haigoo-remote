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
  serviceFlow: Array<{
    key: string
    label: string
    status: CrmServiceStatus | 'not_started'
    completed: boolean
    title: string
    updatedAt: string | null
  }>
  completedFlowCount: number
  currentServiceLabel: string
  nextServiceLabel: string
  crmExcluded: boolean
  crmExcludedAt: string | null
  crmExclusionReason: string
  attentionReasons: string[]
}

export interface CrmServiceDocument {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  notes: string
  createdAt: string
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
  documents: CrmServiceDocument[]
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

export type CrmCareerRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type CrmCareerArtifactStatus = 'draft' | 'approved' | 'archived'

export interface CrmCareerEvidenceItem {
  id: string
  category: string
  statement: string
  sourceExcerpt: string
  grade: 'A' | 'B' | 'C' | 'D' | 'U'
}

export interface CrmCareerPath {
  roleName: string
  whyFit: string
  evidenceIds: string[]
  mainGaps: string[]
  preparationActions: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface CrmResumeDiagnosisContent {
  schemaVersion: 'member-crm-resume-diagnosis-v1'
  summary: { headline: string; positioning: string; consultantBrief: string }
  evidenceLedger: CrmCareerEvidenceItem[]
  strengths: Array<{ title: string; explanation: string; confidence: string; evidenceIds: string[] }>
  findings: Array<{
    category: string; severity: 'high' | 'medium' | 'low'; title: string
    detail: string; recommendation: string; evidenceIds: string[]
  }>
  candidateProfile: {
    headline: string; seniority: 'entry' | 'mid' | 'senior_ic' | 'manager' | 'director' | 'uncertain'; primaryFunctions: string[]; transferableSkills: string[]
    domainAssets: string[]; workStyleStrengths: string[]; languages: string[]; tools: string[]
    targetRolesNow: string[]; targetRolesBridge: string[]; targetRolesLater: string[]
    evidenceGaps: string[]; unverifiedClaims: string[]
  }
  careerPaths: { now: CrmCareerPath[]; bridge: CrmCareerPath[]; later: CrmCareerPath[] }
  clarificationQuestions: Array<{ question: string; reason: string; priority: string }>
  quality: { verifiedEvidenceCount: number; rejectedEvidenceCount: number; warnings: string[] }
  localProfile: Record<string, unknown>
}

export interface CrmCareerArtifact {
  id: string
  runId: string
  artifactType: 'resume_diagnosis'
  version: number
  status: CrmCareerArtifactStatus
  content: CrmResumeDiagnosisContent
  sourceRefs: Record<string, unknown>
  consultantNotes: string
  approvedAt: string | null
  approvedByName: string
  createdAt: string
}

export interface CrmCareerRun {
  id: string
  userId: string
  workflowKey: 'resume_diagnosis'
  status: CrmCareerRunStatus
  sourceResumeKind: 'crm' | 'user'
  sourceResumeId: string
  sourceResumeName: string
  provider: string
  model: string
  tokenUsage: Record<string, number>
  inputOptions: { includeCrmContext?: boolean; consultantFocus?: string }
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  cached: boolean
  deduplicated?: boolean
  artifact: CrmCareerArtifact | null
}

export interface CrmCareerWorkspace {
  modelConfigured: boolean
  provider: string
  model: string
  runs: CrmCareerRun[]
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

export interface CrmConsultationRequest {
  id: string
  userId: string
  topic: string
  wechatId: string
  question: string
  sourcePage: string
  sourceContentId: string | null
  sourceCompanyId: string | null
  status: 'pending' | 'contacted' | 'scheduled' | 'completed' | 'closed'
  assignedTo: string | null
  assignedToName: string
  createdAt: string
  updatedAt: string
  contactedAt: string | null
  closedAt: string | null
  email: string
  username: string
  memberType: string
}

export interface CrmConsultationListResponse {
  items: CrmConsultationRequest[]
  summary: { pending: number; contacted: number; active: number }
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  canEdit: boolean
}
