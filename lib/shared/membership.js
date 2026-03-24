export const MEMBER_TYPES = {
  NONE: 'none',
  TRIAL_WEEK: 'trial_week',
  QUARTER: 'quarter',
  YEAR: 'year'
}

export const MEMBER_TIERS = {
  NONE: 'none',
  TRIAL: 'trial',
  FULL: 'full'
}

export const PLAN_IDS = {
  [MEMBER_TYPES.TRIAL_WEEK]: 'trial_week_lite',
  [MEMBER_TYPES.QUARTER]: 'club_go_quarterly',
  [MEMBER_TYPES.YEAR]: 'goo_plus_yearly'
}

export const LEGACY_LEVEL_TO_TYPE = {
  club_go: MEMBER_TYPES.QUARTER,
  goo_plus: MEMBER_TYPES.YEAR,
  paid: MEMBER_TYPES.QUARTER,
  vip: MEMBER_TYPES.YEAR,
  free: MEMBER_TYPES.NONE,
  none: MEMBER_TYPES.NONE
}

export const DEFAULT_MEMBERSHIP_PLAN_CONFIG = {
  [MEMBER_TYPES.TRIAL_WEEK]: {
    id: PLAN_IDS[MEMBER_TYPES.TRIAL_WEEK],
    enabled: true,
    name: '海狗远程俱乐部体验会员（周）',
    shortLabel: '体验会员',
    liteLabel: 'Lite',
    price: 29.9,
    currency: 'CNY',
    duration_days: 7,
    isPlus: false,
    wechat_qr: '/Wechatpay_mini.png',
    alipay_qr: '/alipay_mini.jpg',
    description: '适合先体验海狗核心岗位权益，快速验证匹配度与使用价值。',
    discountLabel: '轻量试用 · 7天体验',
    features: [
      '解锁全部高薪远程职位（含内推）',
      '解锁全部企业认证信息及联系方式',
      'AI 远程工作助手（无限次）',
      'AI 简历优化（无限次）',
      '岗位收藏、直接翻译等功能（无限次）',
      '加入精英远程工作者社区',
      '解锁精选企业名单'
    ]
  },
  [MEMBER_TYPES.QUARTER]: {
    id: PLAN_IDS[MEMBER_TYPES.QUARTER],
    enabled: true,
    name: '海狗远程俱乐部会员（季度）',
    shortLabel: '季度会员',
    price: 199,
    currency: 'CNY',
    duration_days: 90,
    isPlus: false,
    discountLabel: '灵活订阅 · 适合短期冲刺',
    description: '适合短期冲刺的求职者，快速获得内推机会。',
    features: [
      '解锁全部高薪远程职位（含内推）',
      '解锁全部企业认证信息及联系方式',
      'AI 远程工作助手（无限次）',
      'AI 简历优化（无限次）',
      '岗位收藏、直接翻译等功能（无限次）',
      '加入精英远程工作者社区',
      '解锁精选企业名单'
    ]
  },
  [MEMBER_TYPES.YEAR]: {
    id: PLAN_IDS[MEMBER_TYPES.YEAR],
    enabled: true,
    comingSoon: true,
    name: '海狗远程俱乐部会员（年度）',
    shortLabel: '年度会员',
    price: 999,
    currency: 'CNY',
    duration_days: 365,
    isPlus: true,
    description: '适合致力于长期职业发展的专业人士，建立个人品牌。',
    features: [
      '包含季度会员所有权益',
      '1V1 远程求职咨询（1次，60分钟以内）',
      '专家简历精修 或 模拟面试（二选一）',
      '优先成为俱乐部城市主理人，共享收益',
      '合作企业优先定向直推'
    ]
  }
}

function toIsoString(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizeMemberType(rawType, legacyLevel = null) {
  const candidate = String(rawType || '').trim().toLowerCase()
  if (Object.values(MEMBER_TYPES).includes(candidate)) {
    return candidate
  }

  const legacy = String(legacyLevel || '').trim().toLowerCase()
  if (legacy && LEGACY_LEVEL_TO_TYPE[legacy]) {
    return LEGACY_LEVEL_TO_TYPE[legacy]
  }

  return MEMBER_TYPES.NONE
}

export function resolveMemberTypeFromUser(user) {
  const normalizedType = normalizeMemberType(user?.memberType || user?.member_type, user?.membershipLevel || user?.membership_level)
  if (normalizedType !== MEMBER_TYPES.NONE) return normalizedType
  return isMembershipActive(user) ? MEMBER_TYPES.QUARTER : MEMBER_TYPES.NONE
}

export function isMembershipActive(user) {
  if (!user) return false
  if (user.roles?.admin) return true

  const status = user.memberStatus || user.member_status
  if (status !== 'active' && status !== 'pro' && status !== 'lifetime') return false

  const startAt = user.memberCycleStartAt || user.member_cycle_start_at
  if (startAt) {
    const startDate = new Date(startAt)
    if (!Number.isNaN(startDate.getTime()) && startDate > new Date()) {
      return false
    }
  }

  const expireAt = user.memberExpireAt || user.member_expire_at
  if (!expireAt) return true
  return new Date(expireAt) > new Date()
}

export function deriveMemberTier(user) {
  if (!isMembershipActive(user)) return MEMBER_TIERS.NONE
  const type = resolveMemberTypeFromUser(user)
  return type === MEMBER_TYPES.TRIAL_WEEK ? MEMBER_TIERS.TRIAL : MEMBER_TIERS.FULL
}

export function deriveMembershipCapabilities(user) {
  const active = isMembershipActive(user)
  const memberType = resolveMemberTypeFromUser(user)
  const tier = deriveMemberTier(user)
  const isTrial = tier === MEMBER_TIERS.TRIAL
  const isFull = tier === MEMBER_TIERS.FULL

  return {
    memberType,
    memberTier: tier,
    isActive: active,
    isTrialMember: isTrial,
    isFullMember: isFull,
    canAccessRemotePremiumJobs: active,
    canAccessReferral: active,
    canAccessTrustedInfo: active,
    canAccessCompanyContacts: active,
    canUseTranslationUnlimited: active,
    canUseCopilotUnlimited: active,
    canUseResumeAiUnlimited: active,
    canAccessCommunity: active,
    canUseMemberFavoritesBenefits: active,
    canAccessTrustedCompaniesPage: active && isFull
  }
}

export function getDefaultMembershipPlanConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_MEMBERSHIP_PLAN_CONFIG))
}

export function normalizeMembershipPlanConfig(rawConfig) {
  const merged = getDefaultMembershipPlanConfig()
  const candidate = rawConfig && typeof rawConfig === 'object' && rawConfig.value && typeof rawConfig.value === 'object'
    ? rawConfig.value
    : rawConfig
  const source = candidate && typeof candidate === 'object' ? candidate : {}

  for (const memberType of Object.values(MEMBER_TYPES)) {
    if (memberType === MEMBER_TYPES.NONE) continue
    const current = source[memberType]
    if (!current || typeof current !== 'object') continue
    merged[memberType] = {
      ...merged[memberType],
      ...current,
      id: current.id || merged[memberType].id,
      duration_days: Number(current.duration_days || merged[memberType].duration_days),
      price: Number(current.price ?? merged[memberType].price),
      enabled: current.enabled !== undefined ? Boolean(current.enabled) : merged[memberType].enabled
    }
  }

  return merged
}

export function getPlanConfigByType(memberType, rawConfig) {
  const normalizedType = normalizeMemberType(memberType)
  const config = normalizeMembershipPlanConfig(rawConfig)
  return config[normalizedType] ? { ...config[normalizedType], memberType: normalizedType } : null
}

export function getPlanConfigByPlanId(planId, rawConfig) {
  const config = normalizeMembershipPlanConfig(rawConfig)
  for (const [memberType, plan] of Object.entries(config)) {
    if (plan?.id === planId) {
      return { ...plan, memberType }
    }
  }
  return null
}

export function getMembershipPlans(rawConfig) {
  const config = normalizeMembershipPlanConfig(rawConfig)
  return [MEMBER_TYPES.TRIAL_WEEK, MEMBER_TYPES.QUARTER, MEMBER_TYPES.YEAR]
    .map(type => ({
      ...config[type],
      memberType: type,
      tier: type === MEMBER_TYPES.TRIAL_WEEK ? MEMBER_TIERS.TRIAL : MEMBER_TIERS.FULL
    }))
    .filter(plan => plan.enabled !== false)
}

export function getLegacyMembershipLevel(memberType) {
  const normalizedType = normalizeMemberType(memberType)
  if (normalizedType === MEMBER_TYPES.YEAR) return 'goo_plus'
  if (normalizedType === MEMBER_TYPES.TRIAL_WEEK || normalizedType === MEMBER_TYPES.QUARTER) return 'club_go'
  return 'none'
}

export function calculateMembershipWindow(user, durationDays, now = new Date(), explicitStartAt = null) {
  const nowDate = now instanceof Date ? now : new Date(now)
  const explicitStartDate = explicitStartAt ? new Date(explicitStartAt) : null
  const currentExpireAt = user?.memberExpireAt || user?.member_expire_at
  const currentExpireDate = currentExpireAt ? new Date(currentExpireAt) : null
  const startAt =
    explicitStartDate && !Number.isNaN(explicitStartDate.getTime())
      ? explicitStartDate
      : currentExpireDate && currentExpireDate > nowDate
        ? currentExpireDate
        : nowDate
  const expireAt = new Date(startAt.getTime() + Number(durationDays || 0) * 24 * 60 * 60 * 1000)

  return {
    startAt,
    expireAt,
    startAtIso: toIsoString(startAt),
    expireAtIso: toIsoString(expireAt)
  }
}
