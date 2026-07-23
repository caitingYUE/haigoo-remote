import type { JobApplicationInfo, MiniJob } from '../types'
import { resolvePublicUrl } from '../config/api'

interface RawTranslation {
  title?: string
  company?: string
  description?: string
  location?: string
  type?: string
  requirements?: unknown[]
  responsibilities?: unknown[]
  benefits?: unknown[]
}

export interface RawApiJob {
  id?: string
  title?: string
  company?: string
  location?: string
  region?: MiniJob['region']
  description?: string
  url?: string
  sourceUrl?: string
  logo?: string
  cachedLogoUrl?: string
  cached_logo_url?: string
  companyLogo?: string
  company_logo?: string
  cachedCompanyLogoUrl?: string
  cached_company_logo_url?: string
  publishedAt?: string
  source?: string
  category?: string
  salary?: unknown
  type?: string
  jobType?: string
  job_type?: string
  experienceLevel?: string
  experience_level?: string
  tags?: unknown[]
  requirements?: unknown[]
  responsibilities?: unknown[]
  benefits?: unknown[]
  status?: string
  translations?: RawTranslation | null
  sourceType?: string
  isTrusted?: boolean
  canRefer?: boolean
  memberOnly?: boolean
  isFeatured?: boolean
  matchScore?: number
  displayMatchScore?: number
  displayBand?: MiniJob['displayBand']
  matchLabel?: string
  companyIndustry?: string
  industry?: string
  companyAddress?: string
  companyRating?: string
  companyDescription?: string
  companyWebsite?: string
  companyTags?: unknown[]
  ratingSource?: string
  hiringEmail?: string | null
  emailType?: string | null
  hasWebsiteApply?: boolean
  hasEmailApply?: boolean
  hasReferral?: boolean
  effectiveReferralContactCount?: number
  applicationCount?: number
}

const JOB_TYPE_LABELS: Record<string, string> = {
  'full-time': '全职',
  'part-time': '兼职',
  contract: '合同',
  freelance: '自由职业',
  internship: '实习',
  remote: '远程'
}

const EXPERIENCE_LABELS: Record<string, string> = {
  Entry: '初级',
  Mid: '中级',
  Senior: '高级',
  Lead: '专家 / 负责人',
  Executive: '管理层'
}

const COMPANY_COLORS = ['#16382f', '#1b3154', '#3a2857', '#4a2f24', '#263847', '#243d2d']
const OPEN_SALARY_VALUES = new Set(['', '0', '0-0', 'null', 'open', 'competitive', 'unspecified', '薪资open', '薪资面议', '面议'])

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function getCompanyColor(company: string): string {
  const index = Array.from(company).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return COMPANY_COLORS[index % COMPANY_COLORS.length]
}

function resolveJobLogo(job: RawApiJob): string | undefined {
  const cachedLogo = String(
    job.cachedCompanyLogoUrl ||
    job.cached_company_logo_url ||
    job.cachedLogoUrl ||
    job.cached_logo_url ||
    ''
  ).trim()
  // Cloud Hosting converts approved logo files to CloudBase file IDs. Never
  // fall back to a website or third-party URL from the raw job record.
  return cachedLogo.startsWith('cloud://') ? resolvePublicUrl(cachedLogo) : undefined
}

function abbreviateAmount(value?: number): string {
  if (!value || !Number.isFinite(value)) return ''
  if (value >= 1000) {
    const compact = value / 1000
    return `${Number.isInteger(compact) ? compact.toFixed(0) : compact.toFixed(1)}k`
  }
  return String(Math.round(value))
}

export function formatSalary(value: unknown, fallback = '薪资Open'): string {
  if (value == null) return fallback

  if (typeof value === 'object') {
    const salary = value as {
      min?: number
      max?: number
      currency?: string
      period?: string
      display?: string
    }
    if (salary.display) return String(salary.display)
    const min = Number(salary.min)
    const max = Number(salary.max)
    const hasMin = Number.isFinite(min) && min > 0
    const hasMax = Number.isFinite(max) && max > 0
    if (!hasMin && !hasMax) return fallback
    const symbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'EUR' ? '€' : '$'
    const suffix = salary.period === 'hourly'
      ? '/时'
      : salary.period === 'monthly'
        ? '/月'
        : salary.period === 'package'
          ? '/总包'
          : '/年'
    const minText = abbreviateAmount(hasMin ? min : max)
    const maxText = abbreviateAmount(hasMax ? max : min)
    return minText === maxText ? `${symbol}${minText}${suffix}` : `${symbol}${minText}–${symbol}${maxText}${suffix}`
  }

  const text = String(value || '').trim()
  if (OPEN_SALARY_VALUES.has(text.toLowerCase())) return fallback

  if (text.startsWith('{')) {
    try {
      return formatSalary(JSON.parse(text), fallback)
    } catch {
      return text
    }
  }

  return text
}

export function formatPublishedLabel(value?: string): string {
  if (!value) return '发布时间未知'
  const publishedAt = new Date(value)
  if (Number.isNaN(publishedAt.getTime())) return '发布时间未知'

  const diffMs = Date.now() - publishedAt.getTime()
  const diffHours = Math.max(0, Math.floor(diffMs / 3600000))
  if (diffHours < 1) return '刚刚发布'
  if (diffHours < 24) return `${diffHours} 小时前`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`

  return `${publishedAt.getFullYear()}/${String(publishedAt.getMonth() + 1).padStart(2, '0')}/${String(publishedAt.getDate()).padStart(2, '0')}`
}

function resolveApplication(job: RawApiJob): JobApplicationInfo {
  const websiteUrl = String(job.url || job.sourceUrl || '').trim()
  const hiringEmail = String(job.hiringEmail || '').trim()
  const referralCount = Number(job.effectiveReferralContactCount || 0)
  const hasWebsiteApply = Boolean(job.hasWebsiteApply || websiteUrl)
  const hasEmailApply = Boolean(job.hasEmailApply || hiringEmail)
  const hasReferral = Boolean(job.hasReferral || job.canRefer || referralCount > 0)

  let mode: JobApplicationInfo['mode'] = 'unavailable'
  if (hasWebsiteApply) mode = 'website'
  else if (hasEmailApply) mode = 'email'
  else if (hasReferral) mode = 'referral'

  return {
    mode,
    websiteUrl: websiteUrl || undefined,
    hiringEmail: hiringEmail || undefined,
    emailType: String(job.emailType || '').trim() || undefined,
    hasWebsiteApply,
    hasEmailApply,
    hasReferral
  }
}

export function mapApiJob(job: RawApiJob): MiniJob {
  // The BFF should never return null entries, but keep rendering resilient
  // during cache migrations or partial upstream responses.
  if (!job || typeof job !== 'object') job = {}
  const translations = job.translations || {}
  const title = String(translations.title || job.title || '未命名岗位').trim()
  const company = String(translations.company || job.company || '企业信息待补充').trim()
  const description = String(translations.description || job.description || '').trim()
  const rawType = String(job.jobType || job.job_type || job.type || '').trim()
  const score = Number(
    job.displayMatchScore != null
      ? job.displayMatchScore
      : job.matchScore != null
        ? job.matchScore
        : 0
  )
  const displayBand = job.displayBand || (score >= 75 ? 'common' : 'hidden')
  const showMatchScore = displayBand !== 'hidden' && score >= 75

  const translatedResponsibilities = normalizeArray(translations.responsibilities)
  const translatedRequirements = normalizeArray(translations.requirements)
  const translatedBenefits = normalizeArray(translations.benefits)

  return {
    id: String(job.id || ''),
    title,
    originalTitle: title !== job.title ? String(job.title || '').trim() : undefined,
    company,
    companyColor: getCompanyColor(company),
    logoUrl: resolveJobLogo(job),
    location: String(translations.location || job.location || '远程范围待确认').trim(),
    region: job.region,
    type: String(translations.type || JOB_TYPE_LABELS[rawType] || rawType || '工作类型待确认').trim(),
    salary: formatSalary(job.salary),
    category: String(job.category || '').trim() || undefined,
    experienceLevel: EXPERIENCE_LABELS[String(job.experienceLevel || job.experience_level || '')] ||
      String(job.experienceLevel || job.experience_level || '').trim() ||
      undefined,
    tags: normalizeArray(job.tags).slice(0, 6),
    matchScore: showMatchScore ? score : undefined,
    matchLabel: showMatchScore ? String(job.matchLabel || '').trim() || undefined : undefined,
    displayBand,
    memberOnly: Boolean(job.memberOnly),
    featured: Boolean(job.isFeatured),
    canRefer: Boolean(job.canRefer),
    isTrusted: Boolean(job.isTrusted),
    sourceType: String(job.sourceType || job.source || '').trim() || undefined,
    status: String(job.status || '').trim() || undefined,
    applicationCount: Number(job.applicationCount || 0),
    application: resolveApplication(job),
    description,
    originalDescription: description !== job.description ? String(job.description || '').trim() : undefined,
    responsibilities: translatedResponsibilities.length > 0
      ? translatedResponsibilities
      : normalizeArray(job.responsibilities),
    requirements: translatedRequirements.length > 0
      ? translatedRequirements
      : normalizeArray(job.requirements),
    benefits: translatedBenefits.length > 0 ? translatedBenefits : normalizeArray(job.benefits),
    companyIndustry: String(job.companyIndustry || job.industry || '').trim() || undefined,
    companyAddress: String(job.companyAddress || '').trim() || undefined,
    companyRating: String(job.companyRating || '').trim() || undefined,
    companyDescription: String(job.companyDescription || '').trim() || undefined,
    companyWebsite: String(job.companyWebsite || '').trim() || undefined,
    companyTags: normalizeArray(job.companyTags),
    ratingSource: String(job.ratingSource || '').trim() || undefined,
    publishedAt: job.publishedAt,
    publishedLabel: formatPublishedLabel(job.publishedAt)
  }
}
