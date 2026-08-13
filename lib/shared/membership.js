export const MEMBER_TYPES = {
  NONE: 'none',
  TRIAL_WEEK: 'trial_week',
  STARTER: 'starter',
  QUARTER: 'quarter',
  QUARTER_PRO: 'quarter_pro',
  YEAR: 'year',
  HALF_YEAR: 'half_year',
  ANNUAL: 'annual'
}

export const MEMBER_TIERS = {
  NONE: 'none',
  TRIAL: 'trial',
  FULL: 'full'
}

export const PLAN_IDS = {
  [MEMBER_TYPES.TRIAL_WEEK]: 'trial_week_lite',
  [MEMBER_TYPES.STARTER]: 'club_starter_monthly',
  [MEMBER_TYPES.QUARTER]: 'club_go_quarterly',
  [MEMBER_TYPES.QUARTER_PRO]: 'quarter_pro_quarterly',
  [MEMBER_TYPES.YEAR]: 'goo_plus_yearly',
  [MEMBER_TYPES.HALF_YEAR]: 'club_half_year',
  [MEMBER_TYPES.ANNUAL]: 'club_annual'
}

export const LEGACY_LEVEL_TO_TYPE = {
  club_go: MEMBER_TYPES.QUARTER,
  goo_plus: MEMBER_TYPES.YEAR,
  paid: MEMBER_TYPES.QUARTER,
  pro: MEMBER_TYPES.QUARTER_PRO,
  quarter_pro: MEMBER_TYPES.QUARTER_PRO,
  vip: MEMBER_TYPES.QUARTER_PRO,
  starter: MEMBER_TYPES.STARTER,
  monthly: MEMBER_TYPES.STARTER,
  club_starter: MEMBER_TYPES.STARTER,
  half_year: MEMBER_TYPES.HALF_YEAR,
  annual: MEMBER_TYPES.ANNUAL,
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
    description: '适合用一周集中整理方向、申请材料和行动节奏。',
    discountLabel: '7 天体验',
    features: [
      '查看公开岗位与 Private 岗位',
      '官网与企业公开邮箱申请',
      '职业方向与申请建议',
      '简历与申请材料工具',
      '远程职业成长内容'
    ]
  },
  [MEMBER_TYPES.STARTER]: {
    id: PLAN_IDS[MEMBER_TYPES.STARTER],
    enabled: true,
    name: 'Club Starter',
    shortLabel: 'Starter',
    price: 99,
    currency: 'CNY',
    duration_days: 30,
    duration_months: 0,
    isPlus: false,
    discountLabel: '工具服务',
    description: '适合远程入门或目标明确、希望通过网站信息和工具高效推进投递的用户。',
    features: [
      '查看公开岗位与 Private 岗位',
      '官网与企业公开邮箱申请',
      '远程职业成长内容',
      '简历、岗位订阅等职业工具',
      '申请节奏与材料整理支持'
    ]
  },
  [MEMBER_TYPES.QUARTER]: {
    id: PLAN_IDS[MEMBER_TYPES.QUARTER],
    enabled: true,
    name: 'Haigoo VIP 会员',
    shortLabel: 'VIP 会员',
    price: 199,
    currency: 'CNY',
    duration_days: 90,
    duration_months: 3,
    isPlus: false,
    discountLabel: '季度职业支持',
    description: '适合在一个完整周期内持续推进申请，并稳定整理材料与行动节奏。',
    features: [
      '查看公开岗位与 Private 岗位',
      '官网与企业公开邮箱申请',
      '远程职业成长内容',
      '简历与岗位订阅工具',
      '职业方向与申请建议'
    ]
  },
  [MEMBER_TYPES.QUARTER_PRO]: {
    id: PLAN_IDS[MEMBER_TYPES.QUARTER_PRO],
    enabled: true,
    name: 'Haigoo VIP 会员',
    shortLabel: 'VIP 会员',
    price: 399,
    currency: 'CNY',
    duration_days: 90,
    duration_months: 3,
    isPlus: true,
    wechat_qr: '/wechatpay_399.png',
    alipay_qr: '/alipay_399.jpg',
    discountLabel: '长期支持',
    description: '围绕职业方向、材料表达和申请推进提供季度支持。',
    features: [
      '远程职业成长内容',
      '职业成长跟读音频',
      '英文材料优化建议',
      '阶段复盘与行动建议',
      '一对一专业语音咨询'
    ]
  },
  [MEMBER_TYPES.YEAR]: {
    id: PLAN_IDS[MEMBER_TYPES.YEAR],
    enabled: true,
    comingSoon: true,
    name: 'Club Partner',
    shortLabel: 'Partner 会员',
    price: 999,
    currency: 'CNY',
    duration_days: 365,
    isPlus: true,
    description: '适合持续规划职业方向，并长期沉淀个人表达和职业资源。',
    features: [
      '远程岗位与职业成长内容',
      '一对一专业语音咨询',
      '定制简历、Cover Letter 与指导',
      '长期职业规划与阶段复盘',
      '闭门交流优先参与'
    ]
  },
  [MEMBER_TYPES.HALF_YEAR]: {
    id: PLAN_IDS[MEMBER_TYPES.HALF_YEAR],
    enabled: true,
    name: 'Club Member',
    shortLabel: 'Club Member',
    price: 499,
    currency: 'CNY',
    duration_days: 183,
    duration_months: 6,
    isPlus: true,
    discountLabel: '长期陪伴',
    description: '适合正在认真探索远程工作，希望获得长期岗位资源和求职支持的用户。',
    features: [
      '查看公开岗位与 Private 岗位',
      '官网与企业公开邮箱申请',
      '远程职业成长内容',
      '简历、岗位订阅等职业工具',
      '一对一专业语音咨询'
    ]
  },
  [MEMBER_TYPES.ANNUAL]: {
    id: PLAN_IDS[MEMBER_TYPES.ANNUAL],
    enabled: true,
    name: 'Club Partner',
    shortLabel: 'Club Partner',
    price: 998,
    currency: 'CNY',
    duration_days: 365,
    duration_months: 12,
    isPlus: true,
    discountLabel: '推荐｜适合 HR / 品牌 / 市场 / 运营',
    description: '适合希望长期探索远程职业机会，并沉淀个人职业资源的用户。',
    features: [
      'Club Member 全部权益',
      '1 次远程求职规划',
      '优先参与会员闭门交流',
      '可申请成为共建伙伴',
      '企业岗位发布与品牌传播支持额度（1季度1次）'
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
  const isQuarterOrAbove = active && [
    MEMBER_TYPES.STARTER,
    MEMBER_TYPES.QUARTER,
    MEMBER_TYPES.QUARTER_PRO,
    MEMBER_TYPES.YEAR,
    MEMBER_TYPES.HALF_YEAR,
    MEMBER_TYPES.ANNUAL
  ].includes(memberType)

  return {
    memberType,
    memberTier: tier,
    isActive: active,
    isTrialMember: isTrial,
    isFullMember: isFull,
    canAccessRemotePremiumJobs: active,
    canAccessReferral: active,
    canAccessTrustedInfo: true,
    canAccessCompanyContacts: active,
    canUseTranslationUnlimited: active,
    canUseCopilotUnlimited: active,
    canUseResumeAiUnlimited: active,
    canAccessCommunity: active,
    canUseMemberFavoritesBenefits: true,
    canAccessTrustedCompaniesPage: active && isFull,
    canAccessCorporateEnglishVideos: isQuarterOrAbove,
    canAccessCorporateEnglishProfile: isQuarterOrAbove,
    canAccessCorporateEnglishClips: isQuarterOrAbove,
    canAccessCorporateEnglishResources: isQuarterOrAbove
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
      duration_days: Number(current.duration_days ?? merged[memberType].duration_days),
      duration_months: Number(current.duration_months ?? merged[memberType].duration_months ?? 0),
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
  return [
    MEMBER_TYPES.TRIAL_WEEK,
    MEMBER_TYPES.STARTER,
    MEMBER_TYPES.QUARTER,
    MEMBER_TYPES.QUARTER_PRO,
    MEMBER_TYPES.YEAR,
    MEMBER_TYPES.HALF_YEAR,
    MEMBER_TYPES.ANNUAL
  ]
    .map(type => ({
      ...config[type],
      memberType: type,
      tier: type === MEMBER_TYPES.TRIAL_WEEK ? MEMBER_TIERS.TRIAL : MEMBER_TIERS.FULL
    }))
    .filter(plan => plan.enabled !== false)
}

export function getLegacyMembershipLevel(memberType) {
  const normalizedType = normalizeMemberType(memberType)
  if ([MEMBER_TYPES.YEAR, MEMBER_TYPES.QUARTER_PRO, MEMBER_TYPES.ANNUAL].includes(normalizedType)) return 'goo_plus'
  if ([MEMBER_TYPES.TRIAL_WEEK, MEMBER_TYPES.STARTER, MEMBER_TYPES.QUARTER, MEMBER_TYPES.HALF_YEAR].includes(normalizedType)) return 'club_go'
  return 'none'
}

function addCalendarMonths(date, months) {
  const result = new Date(date)
  const day = result.getDate()
  result.setMonth(result.getMonth() + Number(months || 0))
  if (result.getDate() !== day) {
    result.setDate(0)
  }
  return result
}

export function calculateMembershipWindow(user, durationDays, now = new Date(), explicitStartAt = null, memberType = null) {
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
  const normalizedType = normalizeMemberType(memberType)
  const monthDurationByType = {
    [MEMBER_TYPES.STARTER]: 1,
    [MEMBER_TYPES.QUARTER]: 3,
    [MEMBER_TYPES.QUARTER_PRO]: 3,
    [MEMBER_TYPES.HALF_YEAR]: 6,
    [MEMBER_TYPES.ANNUAL]: 12
  }
  const durationMonths = monthDurationByType[normalizedType]
  const expireAt = durationMonths
    ? addCalendarMonths(startAt, durationMonths)
    : new Date(startAt.getTime() + Number(durationDays || 0) * 24 * 60 * 60 * 1000)

  return {
    startAt,
    expireAt,
    startAtIso: toIsoString(startAt),
    expireAtIso: toIsoString(expireAt)
  }
}
