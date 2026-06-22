export type MemberType = 'none' | 'trial_week' | 'quarter' | 'quarter_pro' | 'year' | 'half_year' | 'annual'
export type MemberTier = 'none' | 'trial' | 'full'

export interface MembershipCapabilities {
  isActive: boolean
  memberType: MemberType
  memberTier: MemberTier
  isTrialMember: boolean
  isFullMember: boolean
  canAccessRemotePremiumJobs: boolean
  canAccessReferral: boolean
  canAccessTrustedInfo: boolean
  canAccessCompanyContacts: boolean
  canUseTranslationUnlimited: boolean
  canUseCopilotUnlimited: boolean
  canUseResumeAiUnlimited: boolean
  canAccessCommunity: boolean
  canUseMemberFavoritesBenefits: boolean
  canAccessTrustedCompaniesPage: boolean
  canAccessCorporateEnglishVideos: boolean
  canAccessCorporateEnglishProfile: boolean
  canAccessCorporateEnglishClips: boolean
  canAccessCorporateEnglishResources: boolean
}

function normalizeMemberType(type?: unknown, legacyLevel?: unknown): MemberType {
  if (typeof type === 'string') {
    const normalized = type.trim().toLowerCase()
    if (
      normalized === 'trial_week'
      || normalized === 'quarter'
      || normalized === 'quarter_pro'
      || normalized === 'year'
      || normalized === 'half_year'
      || normalized === 'annual'
    ) {
      return normalized
    }
  }

  if (typeof legacyLevel === 'string') {
    const normalizedLevel = legacyLevel.trim().toLowerCase()
    if (normalizedLevel === 'goo_plus') return 'year'
    if (normalizedLevel === 'vip') return 'quarter_pro'
    if (normalizedLevel === 'annual') return 'annual'
    if (normalizedLevel === 'half_year') return 'half_year'
    if (normalizedLevel === 'club_go' || normalizedLevel === 'haigoo_member') return 'quarter'
  }

  return 'none'
}

function isMembershipActive(user?: any): boolean {
  if (!user) return false
  if (user?.roles?.admin) return true
  if ((user.memberStatus || user.member_status) !== 'active') return false

  const startAt = user.memberCycleStartAt || user.member_cycle_start_at
  if (startAt) {
    const startTime = new Date(startAt).getTime()
    if (Number.isFinite(startTime) && startTime > Date.now()) {
      return false
    }
  }

  const expireAt = user.memberExpireAt || user.member_expire_at
  if (!expireAt) return true

  const expireTime = new Date(expireAt).getTime()
  return Number.isFinite(expireTime) && expireTime > Date.now()
}

function resolveMemberTypeFromUser(user?: any): MemberType {
  const normalizedType = normalizeMemberType(
    user?.memberType || user?.member_type,
    user?.membershipLevel || user?.membership_level
  )

  if (normalizedType !== 'none') return normalizedType
  return isMembershipActive(user) ? 'quarter' : 'none'
}

function deriveMemberTier(user?: any): MemberTier {
  if (!isMembershipActive(user)) return 'none'
  return resolveMemberTypeFromUser(user) === 'trial_week' ? 'trial' : 'full'
}

export function deriveMembershipCapabilities(user?: any): MembershipCapabilities {
  const isActive = isMembershipActive(user)
  const memberType = resolveMemberTypeFromUser(user)
  const memberTier = deriveMemberTier(user)
  const isTrialMember = isActive && memberType === 'trial_week'
  const isFullMember = isActive && memberTier === 'full'
  const isQuarterOrAbove = isActive && ['quarter', 'quarter_pro', 'year', 'half_year', 'annual'].includes(memberType)
  const canAccessTrustedCompaniesPage = isFullMember

  return {
    isActive,
    memberType,
    memberTier,
    isTrialMember,
    isFullMember,
    canAccessRemotePremiumJobs: isActive,
    canAccessReferral: isActive,
    canAccessTrustedInfo: true,
    canAccessCompanyContacts: isActive,
    canUseTranslationUnlimited: isActive,
    canUseCopilotUnlimited: isActive,
    canUseResumeAiUnlimited: isActive,
    canAccessCommunity: isActive,
    canUseMemberFavoritesBenefits: true,
    canAccessTrustedCompaniesPage,
    canAccessCorporateEnglishVideos: isQuarterOrAbove,
    canAccessCorporateEnglishProfile: isQuarterOrAbove,
    canAccessCorporateEnglishClips: isQuarterOrAbove,
    canAccessCorporateEnglishResources: isQuarterOrAbove
  }
}
