import { useNavigate, Link } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import {
    Sparkles, Target, Briefcase, Loader2, X, UploadCloud,
    ChevronLeft, ChevronRight, MapPin, DollarSign, Building2, Search, ArrowRight,
    Crown, CheckCircle2, Heart, Star, Users, ShieldCheck, MessageCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import JobTickerItem from './JobTickerItem'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { TrustedCompany, trustedCompaniesService } from '../services/trusted-companies-service'
import { stripMarkdown } from '../utils/text-formatter'
import { formatSalaryForDisplay } from '../utils/salary-display'
import { getCompanyLogoSources } from '../utils/company-logo'
import { getCompanyDetailPath } from '../utils/share-link-helper'
import {
    readPendingGuestResume,
    savePendingGuestResume,
    clearPendingGuestResume,
    hydrateGuestResumeFile,
    claimPendingGuestResume,
} from '../services/guest-resume-bridge'
import { markMatchScoreRefresh } from '../utils/match-score-refresh'
import { trackingService } from '../services/tracking-service'

const HERO_CACHE_KEY = 'copilot_hero_state_v2'
const HERO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const HERO_RESUME_STATE_KEY = 'copilot_hero_resume_state_v1'
const HERO_PLAN_STATUS_KEY = 'copilot_plan_status_v1'
const LOGIN_EVENT_KEY = 'haigoo_login_event_at'
const HOME_HERO_BG_SRC = '/pic_lists/Home_pics/background05.webp'
const HOME_HERO_LOVE_SRC = '/pic_lists/Home_pics/love-transparent.webp'
const HOME_HERO_INLINE_LOVE_SRC = '/pic_lists/Home_pics/hero-love-inline.webp'
const HOME_HERO_TITLE_SRC = '/pic_lists/Home_pics/haigoo-hero-title-680.webp'
const HOME_HERO_TITLE_SRCSET = [
    '/pic_lists/Home_pics/haigoo-hero-title-680.webp 680w',
    '/pic_lists/Home_pics/haigoo-hero-title-1020.webp 1020w',
    '/pic_lists/Home_pics/haigoo-hero-title-1360.webp 1360w',
].join(', ')
const HOME_UPGRADE_AVATAR_SRC = '/pic_lists/Home_pics/Haigoo_hi-transparent.webp'
const HOME_UPGRADE_BANNER_DISMISS_KEY = 'haigoo_home_upgrade_banner_dismissed_v1'
const HOME_SYSTEM_UPGRADE_END_AT = new Date('2026-06-22T20:40:00+08:00').getTime()

const LazyGeneratedPlanView = lazy(() => import('./GeneratedPlanView'))
const LazyJobDetailModal = lazy(() => import('./JobDetailModal'))
const LazyHaigooClubInfoCard = lazy(() => import('./HaigooClubInfoCard'))

async function parseResumeFileOnDemand(file: File) {
    const module = await import('../services/resume-parser-enhanced')
    return module.parseResumeFileEnhanced(file)
}

const HomeVipBadge = ({ className = '' }: { className?: string }) => (
    <span className={`inline-flex min-w-[46px] shrink-0 items-center justify-center gap-1 rounded-full border border-white bg-[#6f63ff] px-2 py-0.5 text-[10px] font-black text-white shadow-[0_10px_18px_-12px_rgba(79,70,229,0.8)] ${className}`}>
        <Crown className="h-3 w-3 fill-current" />
        <span className="text-[9px] font-black leading-none tracking-wide">Club</span>
    </span>
)

// Sample data from public remote job listings for local preview.
const SAMPLE_RECOMMENDATIONS = [
    {
        id: 'remotive-clickhouse-pm',
        title: 'Senior Product Manager, ClickHouse Cloud',
        company_name: 'ClickHouse',
        company_logo: '',
        location: 'USA (Remote)',
        timezone: 'US time zones',
        salary: '$145k - $225k USD',
        matchScore: 92,
        company_intro: 'ClickHouse 是全球领先的开源 OLAP 列式数据库公司，服务于 Cloudflare、Spotify 等顶级客户，全远程团队，工程师文化浓厚，融资超 5 亿美元。'
    },
    {
        id: 'remotive-metrostar-fullstack',
        title: 'Sr. Full Stack Developer I',
        company_name: 'MetroStar',
        company_logo: '',
        location: 'USA (Remote)',
        timezone: 'US time zones',
        salary: '$101k - $147k USD',
        matchScore: 89,
        company_intro: 'MetroStar 是美国联邦政府数字化转型的核心技术服务商，专注于现代化软件工程和 DevSecOps，连续多年入选最佳雇主榜单，完全远程。'
    },
    {
        id: 'remotive-moneygram-data',
        title: 'Sr. Data Scientist',
        company_name: 'MoneyGram',
        company_logo: '',
        location: 'USA (Remote)',
        timezone: 'US time zones',
        salary: '$130k - $185k USD',
        matchScore: 87,
        company_intro: 'MoneyGram 是全球跨境金融服务领域的百年品牌，业务覆盖 200+ 国家，正积极推进数字化和区块链转型，数据团队在全球分布式协作。'
    },
    {
        id: 'remotive-pexa-ux',
        title: 'UX Designer',
        company_name: 'PEXA Group',
        company_logo: '',
        location: 'UK (Remote)',
        timezone: 'UK time zones',
        salary: '£45k - £55k GBP',
        matchScore: 86,
        company_intro: 'PEXA Group 是澳大利亚头部房产科技平台，正在向英国市场扩张，产品覆盖房产交易全链路，设计团队支持多区域跨时区协作。'
    }
]

const PREVIEW_PM_RECOMMENDATIONS = [
    {
        id: 'preview-clickhouse-pm',
        title: 'Senior Product Manager, ClickHouse Cloud',
        company_name: 'ClickHouse',
        company_logo: '',
        location: 'USA (Remote)',
        timezone: 'US time zones',
        salary: '$145k - $225k USD',
        company_intro: '主导云数据平台产品路线，跨研发与客户团队协作，面向全球远程团队。'
    },
    {
        id: 'preview-gitlab-growth-pm',
        title: 'Senior Product Manager, Growth',
        company_name: 'GitLab',
        company_logo: '',
        location: 'Global (Remote)',
        timezone: 'EU/US overlap',
        salary: '$135k - $205k USD',
        company_intro: '负责增长漏斗与转化策略，驱动 PLG 关键指标，支持多时区远程协作。'
    },
    {
        id: 'preview-zapier-ai-pm',
        title: 'Product Manager, AI Platform',
        company_name: 'Zapier',
        company_logo: '',
        location: 'North America (Remote)',
        timezone: 'US/CAN time zones',
        salary: '$130k - $190k USD',
        company_intro: '打造自动化与 AI 能力产品化路径，负责用户体验、商业目标与交付节奏。'
    }
]

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
    featuredJobs?: Job[]
    trustedCompanies?: TrustedCompany[]
    companyJobStats?: Record<string, { total: number; categories: Record<string, number> }>
    companiesLoading?: boolean
}

const HOME_FEATURED_TABS = [
    { id: 'all', label: '综合推荐' },
    { id: '人力资源,招聘,财务,会计,法务,行政,管理,客户服务,HR,Recruiter,Talent Acquisition,Finance,Legal,Admin', label: '人事行政' },
    { id: '产品经理,产品设计,营销设计,网站和营销设计,视觉设计,平面设计,创意设计,UI/UX设计,用户研究,增长黑客,Product Manager,Product Designer,Marketing Designer,Visual Designer,Graphic Designer,Creative Designer,UI,UX,Growth', label: '产品设计' },
    { id: '前端开发,后端开发,全栈开发,软件开发,移动开发,算法工程师,测试/QA,数据开发,数据库工程师,平台工程师,服务器开发,运维/SRE,网络安全,架构师,技术支持,工程,开发,Engineer,Developer,Frontend,Backend,Full Stack,Software,QA,DevOps,Data Engineer', label: '技术研发' },
    { id: 'Marketing,Digital Marketing,Content,Social Media,Growth,Operations,Project Manager,市场,营销,运营,增长', label: '运营营销' },
    { id: 'Sales,Account Manager,Business Development,Customer Success,销售,客户经理,BD,商务', label: '销售商务' },
]

const HAIGOO_VERIFICATION_STANDARDS = [
    '官网、LinkedIn等主页信息正常，近期有持续更新',
    '主营业务/产品运营状态正常，且非灰黑产',
    '企业远程文化悠久或远程友好，支持员工成长',
    '有中国业务/分公司或对中国员工友好',
    '岗位来自官方招聘平台发布/内推合作，有可联系的对接人或联系方式',
]

function getJobCompanyKey(job: any) {
    return String(job?.company || job?.company_name || job?.companyName || 'unknown').trim().toLowerCase()
}

function getJobTimestamp(job: any) {
    const rawDate = job?.publishedAt || job?.published_at || job?.createdAt || job?.created_at || ''
    const time = rawDate ? new Date(rawDate).getTime() : 0
    return Number.isFinite(time) ? time : 0
}

function spreadJobsByCompany<T extends Record<string, any>>(jobs: T[], limit = 6, maxPerCompany = 2) {
    const seen = new Set<string>()
    const companyCounts = new Map<string, number>()
    const sortedJobs = [...jobs]
        .filter((job) => {
            const id = String(job?.id || job?.jobId || job?.job_id || '')
            if (!id || seen.has(id)) return false
            seen.add(id)
            return true
        })
        .sort((a, b) => getJobTimestamp(b) - getJobTimestamp(a))

    const selected: T[] = []
    for (const job of sortedJobs) {
        const companyKey = getJobCompanyKey(job)
        const currentCount = companyCounts.get(companyKey) || 0
        if (currentCount >= maxPerCompany) continue
        companyCounts.set(companyKey, currentCount + 1)
        selected.push(job)
        if (selected.length >= limit) break
    }

    return selected
}

function resolveLogoCandidates(logo?: string, company?: string, website?: string, companyId?: string, cachedLogoUrl?: string) {
    const baseSources = getCompanyLogoSources({
        companyId,
        cachedLogoUrl,
        originalLogoUrl: logo,
        version: company || website
    })
    const websiteFallbacks: string[] = []
    const rawWebsite = String(website || '').trim()
    if (rawWebsite) {
        try {
            const withProtocol = /^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`
            const host = new URL(withProtocol).hostname.replace(/^www\./, '')
            if (host) {
                websiteFallbacks.push(`https://logo.clearbit.com/${host}`)
                websiteFallbacks.push(`https://www.google.com/s2/favicons?domain=${host}&sz=128`)
            }
        } catch {
            // ignore malformed company websites
        }
    }
    return Array.from(new Set([...baseSources, ...websiteFallbacks]))
}

function getHeroCacheKey(userId?: string | null) {
    return userId ? `${HERO_CACHE_KEY}_${userId}` : HERO_CACHE_KEY
}

function getLocalDateKey(input: number | string | Date = Date.now()) {
    const date = input instanceof Date ? input : new Date(input)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

type HeroRecommendationHistoryEntry = {
    contextKey: string
    dateKey: string
    jobIds: string[]
    updatedAt: number
}

function spreadByCompany<T extends { company_name?: string; company?: string }>(items: T[], bucketSize = 6) {
    const source = [...items]
    const result: T[] = []
    let used = new Set<string>()
    while (source.length) {
        if (result.length % bucketSize === 0) used = new Set<string>()
        let idx = source.findIndex((i) => {
            const name = (i.company_name || i.company || '').trim().toLowerCase()
            return name && !used.has(name)
        })
        if (idx < 0) idx = 0
        const picked = source.splice(idx, 1)[0]
        const key = (picked.company_name || picked.company || '').trim().toLowerCase()
        if (key) used.add(key)
        result.push(picked)
    }
    return result
}

function getHeroDisplaySalary(rawSalary: any) {
    return formatSalaryForDisplay(rawSalary, '薪资Open')
}

function formatHiringLine(total?: number, categories?: Record<string, number>) {
    const safeTotal = Number(total || 0)
    const categoryText = Object.entries(categories || {})
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, 3)
        .map(([name]) => name)
        .filter(Boolean)
        .join('/')
    return categoryText ? `${safeTotal} 个在招 ${categoryText}` : `${safeTotal} 个在招岗位`
}

function cleanHeroRichText(text?: string) {
    if (!text) return ''
    const decoded = String(text)
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, ' ')
    return stripMarkdown(decoded).replace(/\s+/g, ' ').trim()
}

function normalizeHeroTranslations(value: any) {
    if (!value) return null
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value)
            return parsed && typeof parsed === 'object' ? parsed : null
        } catch {
            return null
        }
    }
    return typeof value === 'object' ? value : null
}

function normalizeHeroBoolean(value: any) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase())
    return false
}

function isFreshHomeJob(job: any) {
    if (job?.isNew !== undefined && job?.isNew !== null) return normalizeHeroBoolean(job.isNew)
    if (job?.is_new !== undefined && job?.is_new !== null) return normalizeHeroBoolean(job.is_new)
    const rawDate = job?.publishedAt || job?.published_at || job?.createdAt || job?.created_at || ''
    const time = rawDate ? new Date(rawDate).getTime() : 0
    if (!Number.isFinite(time) || time <= 0) return false
    return Date.now() - time <= 3 * 24 * 60 * 60 * 1000
}

const HomeNewBadge = () => (
    <span
        className="inline-flex h-5 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 px-2 text-[10px] font-black leading-none text-white shadow-[0_10px_18px_-14px_rgba(16,185,129,0.55)]"
        aria-label="new"
        title="最近 3 天内上新"
    >
        New
    </span>
)

function normalizePlanCompareText(value?: string) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

function isInvalidJobDirectionInput(value?: string) {
    const text = String(value || '').trim()
    if (!text) return true
    if (/^[a-z0-9]$/i.test(text)) return true
    const normalized = text.toLowerCase()
    const validShortTerms = new Set(['hr', 'pm', 'qa', 'ui', 'ux', 'ios'])
    if (/^[a-z]{2,3}$/.test(normalized) && !validShortTerms.has(normalized)) return true
    return false
}

function buildHeroRecommendationContextKey(direction?: string, positionType?: string) {
    return `${normalizePlanCompareText(direction) || 'default'}::${String(positionType || 'full-time').trim().toLowerCase() || 'full-time'}`
}

function buildHeroAutoRefreshAttemptKey(
    userId: string | null | undefined,
    contextKey: string,
    dateKey: string,
    loginEventStamp?: string
) {
    return [
        userId || 'guest',
        contextKey || 'default',
        dateKey || getLocalDateKey(),
        String(loginEventStamp || 'no-login-event').trim() || 'no-login-event'
    ].join('::')
}

function normalizeHeroRecommendationHistory(raw: any): HeroRecommendationHistoryEntry[] {
    if (!Array.isArray(raw)) return []
    return raw
        .map((item) => {
            const contextKey = String(item?.contextKey || '').trim()
            const dateKey = String(item?.dateKey || '').trim()
            const jobIds = Array.isArray(item?.jobIds)
                ? Array.from(new Set(item.jobIds.map((jobId: any) => String(jobId || '').trim()).filter(Boolean)))
                : []
            const updatedAt = Number(item?.updatedAt) || 0
            if (!contextKey || !dateKey || jobIds.length === 0 || !updatedAt) return null
            return { contextKey, dateKey, jobIds, updatedAt }
        })
        .filter(Boolean) as HeroRecommendationHistoryEntry[]
}

function mergeHeroRecommendationHistory(
    history: HeroRecommendationHistoryEntry[],
    entry: HeroRecommendationHistoryEntry
) {
    const merged = [entry, ...normalizeHeroRecommendationHistory(history).filter((item) => !(item.contextKey === entry.contextKey && item.dateKey === entry.dateKey))]
        .sort((a, b) => b.updatedAt - a.updatedAt)

    const perContextCount = new Map<string, number>()
    const trimmed: HeroRecommendationHistoryEntry[] = []

    for (const item of merged) {
        const currentCount = perContextCount.get(item.contextKey) || 0
        if (currentCount >= 3) continue
        trimmed.push(item)
        perContextCount.set(item.contextKey, currentCount + 1)
        if (trimmed.length >= 12) break
    }

    return trimmed
}

function getRecentRecommendationIds(
    history: HeroRecommendationHistoryEntry[],
    contextKey: string
) {
    const scoped = normalizeHeroRecommendationHistory(history)
        .filter((item) => item.contextKey === contextKey)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 3)

    return Array.from(new Set(scoped.flatMap((item) => item.jobIds)))
}

function isStoredPlanReusable(
    plan: any,
    options: {
        jobDirection: string
        positionTypeLabel: string
        defaults: {
            language: string
            education: string
            preparationTime: string
            weeklyHours: string
        }
        hasResume: boolean
    }
) {
    if (!plan || typeof plan !== 'object') return false
    const goalContext = plan.goal_context || {}
    const defaults = plan.defaults || {}
    const resumeCompatible = !options.hasResume || Boolean(goalContext.has_resume)

    return normalizePlanCompareText(goalContext.job_direction) === normalizePlanCompareText(options.jobDirection)
        && normalizePlanCompareText(goalContext.position_type) === normalizePlanCompareText(options.positionTypeLabel)
        && normalizePlanCompareText(defaults.english_level) === normalizePlanCompareText(options.defaults.language)
        && normalizePlanCompareText(defaults.education_level) === normalizePlanCompareText(options.defaults.education)
        && normalizePlanCompareText(defaults.preparation_time) === normalizePlanCompareText(options.defaults.preparationTime)
        && normalizePlanCompareText(defaults.weekly_commitment) === normalizePlanCompareText(options.defaults.weeklyHours)
        && resumeCompatible
}

// ── Unified Input Card Component ──
function InputCard({ 
    label, 
    value, 
    onChange, 
    placeholder, 
    options,
    icon: Icon 
}: {
    label: string
    value: string
    onChange: (val: string) => void
    placeholder?: string
    options?: { value: string, label: string }[]
    icon: any
}) {
    return (
        <div className="relative group h-[58px] rounded-[18px] border border-white/80 bg-white/92 shadow-[0_12px_30px_-26px_rgba(62,91,120,0.45)] transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-200">
            <div className="absolute left-3.5 top-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide pointer-events-none select-none">
                {label} <span className="text-rose-500">*</span>
            </div>
            <Icon className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 transition-colors pointer-events-none group-focus-within:text-indigo-500" />
            
            {options ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-full w-full cursor-pointer appearance-none border-none bg-transparent pb-1.5 pl-3.5 pr-10 pt-5 text-sm font-bold text-slate-800 outline-none"
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="h-full w-full border-none bg-transparent pb-1.5 pl-3.5 pr-10 pt-5 text-sm font-bold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300"
                />
            )}
        </div>
    )
}

function CompanyLogo({ companyName, logoCandidates, className }: { companyName: string, logoCandidates: string[], className?: string }) {
    const [index, setIndex] = useState(0)
    const src = logoCandidates[index]
    return src ? (
        <img
            src={src}
            alt={companyName}
            className={className}
            onError={() => setIndex((prev) => (prev < logoCandidates.length - 1 ? prev + 1 : prev))}
        />
    ) : (
        <span className="text-sm font-bold text-indigo-500">{(companyName || '').slice(0, 2).toUpperCase()}</span>
    )
}

function normalizePlanForView(plan: any) {
    if (!plan) return null
    const normalized = { ...plan }
    if (normalized.readiness === undefined && typeof normalized.remoteReadiness?.score === 'number') {
        normalized.readiness = normalized.remoteReadiness.score
    }
    if ((!normalized.summary || !normalized.summary.trim()) && normalized.resumeEval?.summary) {
        normalized.summary = normalized.resumeEval.summary
    }
    if ((!normalized.recommendations || normalized.recommendations.length === 0) && normalized.applicationPlan?.recommendations) {
        normalized.recommendations = normalized.applicationPlan.recommendations
    }
    if ((!normalized.milestones || normalized.milestones.length === 0) && Array.isArray(normalized.applicationPlan?.steps)) {
        normalized.milestones = normalized.applicationPlan.steps.map((s: any, idx: number) => ({
            month: s.week || `阶段 ${idx + 1}`,
            focus: s.action || s.focus || '行动任务',
            tasks: s.tasks || (s.action ? [s.action] : [])
        }))
    }
    if ((!normalized.milestones || normalized.milestones.length === 0) && normalized.plan_v2?.milestones) {
        normalized.milestones = normalized.plan_v2.milestones
    }
    if ((!normalized.milestones || normalized.milestones.length === 0) && Array.isArray(normalized.phases)) {
        normalized.milestones = normalized.phases.map((phase: any, idx: number) => ({
            month: phase.phase_name || `阶段 ${idx + 1}`,
            focus: phase.focus || phase.phase_key || '行动推进',
            tasks: (phase.tasks || []).map((task: any) => task.task_name || task.task || task)
        }))
    }
    if ((!normalized.summary || !normalized.summary.trim()) && Array.isArray(normalized.phases) && normalized.phases.length > 0) {
        normalized.summary = `AI 已基于你的目标与准备周期生成 ${normalized.phases.length} 个阶段的求职行动计划，可按阶段逐步推进。`
    }
    return normalized
}

function extractParsedResumeHints(parsed: any) {
    return Array.from(new Set([
        parsed?.title,
        parsed?.targetRole,
        parsed?.summary,
        ...(typeof parsed?.skills === 'string' ? parsed.skills.split(/[,，、/\n|]+/g) : []),
        ...(typeof parsed?.workExperience === 'string' ? parsed.workExperience.split(/[\n,，、/|]+/g) : []),
    ]
        .map(item => String(item || '').trim())
        .filter(item => item.length >= 2)
    )).slice(0, 12)
}

function isLikelyResumePayload(parsed: any, fileName = '') {
    const lowerName = String(fileName || '').toLowerCase()
    const extensionLooksValid = /\.(pdf|doc|docx)$/i.test(lowerName)
    if (!extensionLooksValid) return false

    const text = String(parsed?.text || parsed?.content || parsed?.textContent || '').trim()
    const fields = [
        parsed?.name,
        parsed?.title,
        parsed?.targetRole,
        parsed?.summary,
        parsed?.workExperience,
        parsed?.experience,
        parsed?.education,
        parsed?.degree,
        parsed?.skills
    ].filter((item) => {
        if (Array.isArray(item)) return item.length > 0
        return String(item || '').trim().length >= 2
    })
    const resumeKeywords = /(resume|cv|curriculum vitae|简历|教育经历|教育背景|工作经历|项目经历|工作经验|求职意向|技能|experience|education|skills|employment)/i

    return fields.length >= 2 || (text.length >= 180 && resumeKeywords.test(text)) || (fields.length >= 1 && resumeKeywords.test(`${lowerName}\n${text}`))
}


const TICKER_TARGET_MIN = 8
const TICKER_TARGET_MAX = 10
const TICKER_RECENT_WINDOWS = [3, 7, 14]
const PLAN_LANGUAGE_OPTIONS = [
    '中等（可借助翻译软件线上交流）',
    '较强（可独立完成英文面试与协作）',
    '基础（需要更多准备）',
]
const PLAN_EDUCATION_OPTIONS = ['大学本科', '大专', '硕士及以上', '其他']
const PLAN_TIMELINE_OPTIONS = ['1-3个月', '1个月内', '3-6个月']
const PLAN_WEEKLY_HOUR_OPTIONS = ['5-10小时', '10-15小时', '15小时以上', '3-5小时']

function mapPreparationTimelineToApi(value: string) {
    if (value === '1个月内') return 'immediately'
    if (value === '3-6个月') return '3-6 months'
    return '1-3 months'
}

function readStoredHeroResumeState() {
    try {
        const raw = localStorage.getItem(HERO_RESUME_STATE_KEY)
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function writeStoredHeroResumeState(payload: any) {
    try {
        localStorage.setItem(HERO_RESUME_STATE_KEY, JSON.stringify(payload))
    } catch {
        // ignore
    }
}

function clearStoredHeroResumeState() {
    try {
        localStorage.removeItem(HERO_RESUME_STATE_KEY)
    } catch {
        // ignore
    }
}

function readStoredPlanStatus() {
    try {
        const raw = localStorage.getItem(HERO_PLAN_STATUS_KEY)
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function writeStoredPlanStatus(status: 'idle' | 'pending' | 'ready') {
    try {
        localStorage.setItem(HERO_PLAN_STATUS_KEY, JSON.stringify({ status, updatedAt: Date.now() }))
    } catch {
        // ignore
    }
}

export default function HomeHero({
    stats: _stats,
    featuredJobs = [],
    trustedCompanies = [],
    companyJobStats = {},
    companiesLoading = false
}: HomeHeroProps) {
    const navigate = useNavigate()
    const { user, isAuthenticated, token, isMember, memberType, updateProfile, isLoading: authLoading } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()
    const userId = user?.user_id || null
    const storedTargetRole = String(user?.profile?.targetRole || '').trim()
    const [showUpgradeBanner, setShowUpgradeBanner] = useState(() => {
        try {
            return localStorage.getItem(HOME_UPGRADE_BANNER_DISMISS_KEY) !== 'dismissed'
        } catch {
            return true
        }
    })
    const [showUpgradeFeedbackModal, setShowUpgradeFeedbackModal] = useState(false)
    const [upgradeFeedbackContent, setUpgradeFeedbackContent] = useState('')
    const [upgradeFeedbackSubmitting, setUpgradeFeedbackSubmitting] = useState(false)
    const [isSystemUpgradeNoticeActive, setIsSystemUpgradeNoticeActive] = useState(() => Date.now() < HOME_SYSTEM_UPGRADE_END_AT)

    useEffect(() => {
        if (!isSystemUpgradeNoticeActive) return
        const timer = window.setInterval(() => {
            if (Date.now() >= HOME_SYSTEM_UPGRADE_END_AT) {
                setIsSystemUpgradeNoticeActive(false)
            }
        }, 30 * 1000)
        return () => window.clearInterval(timer)
    }, [isSystemUpgradeNoticeActive])

    const dismissUpgradeBanner = () => {
        try {
            localStorage.setItem(HOME_UPGRADE_BANNER_DISMISS_KEY, 'dismissed')
        } catch {
            // ignore
        }
        setShowUpgradeBanner(false)
    }

    const handleUpgradeBannerFeedback = () => {
        trackingService.track('feedback_entry_click', {
            page_key: 'home',
            module: 'home_upgrade_banner',
            feature_key: 'platform_feedback',
            source_key: 'home_upgrade_banner'
        })
        if (!isAuthenticated) {
            showWarning('请先登录后留言', '登录后可以把你的想法直接留给海狗。')
            return
        }
        setShowUpgradeFeedbackModal(true)
    }
    const submitUpgradeFeedback = async () => {
        const content = upgradeFeedbackContent.trim()
        if (!content) {
            showError('请填写留言内容')
            return
        }
        try {
            setUpgradeFeedbackSubmitting(true)
            trackingService.track('feedback_submit', {
                page_key: 'home',
                module: 'home_upgrade_banner',
                feature_key: 'platform_feedback',
                source_key: 'home_upgrade_banner_modal'
            })
            const res = await fetch('/api/user-profile?action=submit_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token || localStorage.getItem('haigoo_auth_token') || ''}`
                },
                body: JSON.stringify({
                    accuracy: 'unknown',
                    content,
                    contact: user?.email || '',
                    source: 'home_upgrade_banner',
                    sourceUrl: '/'
                })
            })
            const data = await res.json().catch(() => ({ success: false }))
            if (!res.ok || !data?.success) {
                showError('留言提交失败', data?.error || '请稍后重试')
                return
            }
            showSuccess('留言已收到', '谢谢你告诉我们你的想法，我们会认真查看。')
            setUpgradeFeedbackContent('')
            setShowUpgradeFeedbackModal(false)
        } catch {
            showError('留言提交失败', '网络错误')
        } finally {
            setUpgradeFeedbackSubmitting(false)
        }
    }
    const upgradeBannerMessage = isSystemUpgradeNoticeActive
        ? '系统正在升级中，建议20:40后再使用网站。'
        : '嗨，我是海狗，你的远程工作探索伙伴。'
    const shouldShowUpgradeBanner = isSystemUpgradeNoticeActive || showUpgradeBanner

    // Background Parallax State
    const [bgPosition] = useState({ x: 50, y: 50 })

    // Form State
    const [jobDirection, setJobDirection] = useState('')
    const [heroSearchTerm, setHeroSearchTerm] = useState('')
    const [positionType, setPositionType] = useState('full-time')
    const [resumeId, setResumeId] = useState<string | null>(null)
    const [resumeName, setResumeName] = useState<string | null>(null)
    const [guestResumeFile, setGuestResumeFile] = useState<File | null>(null)
    const [guestResumeHints, setGuestResumeHints] = useState<string[]>([])
    const [pendingHeroRecommendationRefresh, setPendingHeroRecommendationRefresh] = useState<null | {
        resumeId: string | null
        resumeHints?: string[]
    }>(null)
    const [privacyAccepted, setPrivacyAccepted] = useState(false)
    const [highlightPrivacyConsent, setHighlightPrivacyConsent] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const privacyConsentRef = useRef<HTMLLabelElement>(null)
    
    // Process State
    const [loading, setLoading] = useState(false)
    const [recommendations, setRecommendations] = useState<any[]>([])
    const [hasResults, setHasResults] = useState(false)
    const [isEditingPreferences, setIsEditingPreferences] = useState(false)
    const [hasHydrated, setHasHydrated] = useState(false)
    const [showPlanModal, setShowPlanModal] = useState(false)
    const [keepPlanWorkerAlive, setKeepPlanWorkerAlive] = useState(false)
    const [planStatus, setPlanStatus] = useState<'idle' | 'pending' | 'ready'>('idle')
    const [activeCard, setActiveCard] = useState(0)
    const touchStartXRef = useRef<number | null>(null)
    const resumeHydratedFromAccount = useRef(false)
    const [selectedJobDetail, setSelectedJobDetail] = useState<any | null>(null)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now())
    const [recommendationHistory, setRecommendationHistory] = useState<HeroRecommendationHistoryEntry[]>([])
    const [previewJobs, setPreviewJobs] = useState<any[]>([])
    const [activeFeaturedTab, setActiveFeaturedTab] = useState(HOME_FEATURED_TABS[0].id)
    const [featuredTabJobs, setFeaturedTabJobs] = useState<Job[]>([])
    const [featuredTabLoading, setFeaturedTabLoading] = useState(false)
    const [companyCoverImages, setCompanyCoverImages] = useState<Record<string, string>>({})
    const companyCoverRequestedRef = useRef(new Set<string>())
    const autoRefreshAttemptKeyRef = useRef('')
    const recommendationsFreshSnapshotKeyRef = useRef('')
    const pendingResumeSyncAttempted = useRef(false)
    const accountHeroHydratedForUser = useRef<string | null>(null)
    const displayRecommendations = hasResults && recommendations.length > 0
        ? (isAuthenticated ? recommendations : recommendations.slice(0, 1))
        : SAMPLE_RECOMMENDATIONS
    const dailyLimit = isAuthenticated ? 5 : 1
    const effectiveJobDirection = String(jobDirection || storedTargetRole || '').trim()
    const recommendationContextKey = useMemo(
        () => buildHeroRecommendationContextKey(effectiveJobDirection, positionType),
        [effectiveJobDirection, positionType]
    )
    const todayDateKey = getLocalDateKey()
    const latestRecommendationDateKey = lastUpdatedAt ? getLocalDateKey(lastUpdatedAt) : ''
    const hasRecommendationForToday = useMemo(() => {
        if (!recommendationContextKey) return false
        return normalizeHeroRecommendationHistory(recommendationHistory).some((item) => (
            item.contextKey === recommendationContextKey && item.dateKey === todayDateKey
        ))
    }, [recommendationContextKey, recommendationHistory, todayDateKey])
    const positionTypeLabel = positionType === 'full-time'
        ? '全职远程'
        : positionType === 'contract'
            ? '合同/兼职'
            : positionType === 'freelance'
                ? '自由职业'
                : '实习'
    const memberExpireLabel = isMember
        ? (user?.memberExpireAt ? new Date(user.memberExpireAt).toLocaleDateString('zh-CN') : '长期有效')
        : ''
    const homeMemberEntitlement = memberType === 'trial_week'
        ? {
            title: '欢迎回来，体验权益已为你开启',
            description: `短期冲刺求职权益已解锁，当前有效期至 ${memberExpireLabel}。`,
            tags: ['岗位申请开放', '联系人限时开放', 'AI 简历工具', '7 天短期体验', '外企英语样例'],
            iconText: 'text-[#6f63f6]',
            iconBg: 'bg-[#f0edff]',
            button: '进入远程工作',
            ctaHref: '/jobs'
        }
        : memberType === 'annual'
            ? {
                title: '欢迎回来，Club Partner 权益已为你开启',
                description: `岗位申请路径、外企英语材料、语音咨询、年度规划和共建申请权益已解锁，当前有效期至 ${memberExpireLabel}。`,
                tags: ['全部岗位申请', '联系人信息开放', '外企英语材料', '年度规划', '共建申请'],
                iconText: 'text-[#6f63f6]',
                iconBg: 'bg-[#f0edff]',
                button: '查看 Partner 权益',
                ctaHref: '/profile?tab=membership#member-benefits'
            }
        : memberType === 'half_year'
            ? {
                title: '欢迎回来，Club Member 权益已为你开启',
                description: `岗位申请路径、外企英语材料和语音咨询权益已解锁，当前有效期至 ${memberExpireLabel}。`,
                tags: ['全部岗位申请', '联系人信息开放', '外企英语材料', 'AI 简历建议', '语音咨询'],
                iconText: 'text-[#6f63f6]',
                iconBg: 'bg-[#f0edff]',
                button: '查看 Member 权益',
                ctaHref: '/profile?tab=membership#member-benefits'
            }
        : memberType === 'quarter_pro' || memberType === 'year'
            ? {
                title: '欢迎回来，Pro权益已为你开启',
                description: `全部求职权益、外企英语跟读素材和延伸资料已解锁，当前有效期至 ${memberExpireLabel}。`,
                tags: ['全部岗位申请', '联系人信息开放', '外企英语跟读', '更多资料开放', 'CEO 联系权限'],
                iconText: 'text-[#6f63f6]',
                iconBg: 'bg-[#f0edff]',
                button: '继续学习与求职',
                ctaHref: '/profile?tab=membership#member-benefits'
            }
            : {
                title: '欢迎回来，季度权益已为你开启',
                description: `远程求职权益、外企英语视频和企业文化内容已解锁，当前有效期至 ${memberExpireLabel}。`,
                tags: ['全部岗位申请', '联系人信息开放', '精选企业名单', '外企英语视频', 'CEO 商业思维'],
                iconText: 'text-[#6f63f6]',
                iconBg: 'bg-[#f0edff]',
                button: '进入远程工作',
                ctaHref: '/jobs'
            }

    useEffect(() => {
        if (activeFeaturedTab === HOME_FEATURED_TABS[0].id) {
            setFeaturedTabJobs(featuredJobs.slice(0, 6))
            setFeaturedTabLoading(false)
            return
        }

        let cancelled = false
        setFeaturedTabLoading(true)
        processedJobsService.getProcessedJobs(1, 24, {
            isFeatured: true,
            isApproved: true,
            category: activeFeaturedTab,
            sortBy: 'recent',
            skipAggregations: true
        }).then((res) => {
            if (!cancelled) setFeaturedTabJobs(spreadJobsByCompany(res.jobs || [], 6, 2))
        }).catch((error) => {
            console.error('Failed to fetch home featured tab:', activeFeaturedTab, error)
            if (!cancelled) setFeaturedTabJobs([])
        }).finally(() => {
            if (!cancelled) setFeaturedTabLoading(false)
        })

        return () => { cancelled = true }
    }, [activeFeaturedTab, featuredJobs])

    const curatedJobs = useMemo(() => {
        const source = activeFeaturedTab === HOME_FEATURED_TABS[0].id
            ? (featuredTabJobs.length > 0 ? featuredTabJobs : featuredJobs)
            : featuredTabJobs
        return spreadJobsByCompany(source, 6, 2)
    }, [activeFeaturedTab, featuredJobs, featuredTabJobs])

    const displayCompanies = useMemo(() => trustedCompanies.slice(0, 6), [trustedCompanies])

    useEffect(() => {
        let cancelled = false
        const missingCoverCompanies = displayCompanies.filter((company) => company.id && !company.coverImage && !companyCoverRequestedRef.current.has(company.id))
        if (missingCoverCompanies.length === 0) return

        const loadCovers = async () => {
            for (let index = 0; index < missingCoverCompanies.length; index += 2) {
                if (cancelled) return
                const batch = missingCoverCompanies.slice(index, index + 2)
                await Promise.all(batch.map(async (company) => {
                    companyCoverRequestedRef.current.add(company.id)
                    try {
                        const result = await trustedCompaniesService.getCompanyCoverImage(company.id)
                        if (cancelled) return
                        setCompanyCoverImages((prev) => ({
                            ...prev,
                            [company.id]: result?.coverImage || ''
                        }))
                    } catch {
                        if (cancelled) return
                        setCompanyCoverImages((prev) => ({
                            ...prev,
                            [company.id]: ''
                        }))
                    }
                }))
            }
        }

        const idleId = typeof window !== 'undefined' && 'requestIdleCallback' in window
            ? (window as any).requestIdleCallback(loadCovers, { timeout: 2500 })
            : globalThis.setTimeout(loadCovers, 900)

        return () => {
            cancelled = true
            if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
                ;(window as any).cancelIdleCallback(idleId)
            } else {
                globalThis.clearTimeout(idleId)
            }
        }
    }, [displayCompanies])

    const formattedUpdatedAt = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(lastUpdatedAt)
    
    const previewDisplayJobs = (() => {
        if (previewJobs.length >= 3) return previewJobs.slice(0, 3)
        const filler = PREVIEW_PM_RECOMMENDATIONS.filter(p => !previewJobs.find(j => j.id === p.id))
        return [...previewJobs, ...filler].slice(0, 3)
    })()

    const [tickerJobs, setTickerJobs] = useState<any[]>([])
    const tickerRepeatCount = tickerJobs.length > 0 ? Math.max(4, Math.ceil(12 / tickerJobs.length)) : 0
    const tickerLoop = tickerRepeatCount > 0 ? Array.from({ length: tickerRepeatCount }, () => tickerJobs).flat() : []

    const normalizeHeroJob = (job: any) => {
        const translations = normalizeHeroTranslations(job?.translations)
        const companyTranslations = normalizeHeroTranslations(job?.companyTranslations || job?.company_translations)
        const company = job?.company_name || job?.company || translations?.company || 'Company'
        const originalLogo = job?.logo || job?.companyLogo || job?.company_logo || job?.originalLogoUrl || ''
        const cachedLogo = job?.cachedLogoUrl || job?.cachedCompanyLogoUrl || job?.cached_logo_url || job?.cached_company_logo_url || ''
        const companyWebsite = job?.companyWebsite || job?.company_website || job?.website || ''
        const updatedAt = job?.updatedAt || job?.updated_at || ''
        return {
            ...job,
            id: String(job?.id || job?.jobId || job?.job_id || ''),
            title: job?.title || '远程岗位',
            company,
            company_name: company,
            location: job?.location || '远程',
            salary: getHeroDisplaySalary(job?.salary || job?.salary_range),
            timezone: job?.timezone || job?.remote_timezone || '',
            description: typeof job?.description === 'string' ? job.description : '',
            company_intro: cleanHeroRichText(job?.companyDescription || job?.company_description || job?.companyIntro || job?.company_intro || ''),
            companyDescription: cleanHeroRichText(job?.companyDescription || job?.company_description || job?.companyIntro || job?.company_intro || ''),
            translations,
            companyTranslations,
            companyId: job?.companyId || job?.company_id,
            cachedLogoUrl: cachedLogo,
            logo: originalLogo,
            company_logo: originalLogo,
            companyLogo: originalLogo,
            company_website: companyWebsite,
            companyWebsite,
            url: job?.url || job?.sourceUrl || '',
            sourceUrl: job?.sourceUrl || job?.url || '',
            source: job?.source || 'hero',
            publishedAt: job?.publishedAt || job?.published_at || '',
            createdAt: job?.createdAt || job?.created_at || '',
            updatedAt,
            category: job?.category || '',
            jobType: job?.jobType || job?.job_type || job?.type || '',
            experienceLevel: job?.experienceLevel || job?.experience_level || '',
            companyRating: job?.companyRating || job?.company_rating || job?.trustedCompanyRating || job?.trusted_company_rating || '',
            ratingSource: job?.ratingSource || job?.rating_source || job?.trustedRatingSource || job?.trusted_rating_source || '',
            memberOnly: normalizeHeroBoolean(job?.memberOnly ?? job?.member_only),
            isNew: isFreshHomeJob(job),
            logo_candidates: job?.logo_candidates || resolveLogoCandidates(
                originalLogo,
                company,
                companyWebsite,
                job?.companyId || job?.company_id,
                cachedLogo
            ),
        }
    }
    const heroDetailJobs = useMemo(
        () => {
            const seen = new Set<string>()
            return [...displayRecommendations, ...curatedJobs]
                .map((job) => normalizeHeroJob(job))
                .filter((job) => {
                    if (!job.id || seen.has(job.id)) return false
                    seen.add(job.id)
                    return true
                })
        },
        [curatedJobs, displayRecommendations]
    )
    const currentHeroJobIndex = useMemo(() => {
        if (!selectedJobDetail?.id) return -1
        return heroDetailJobs.findIndex((job) => job.id === String(selectedJobDetail.id))
    }, [heroDetailJobs, selectedJobDetail])

    useEffect(() => {
        const stored = readStoredPlanStatus()
        if (stored?.status === 'pending' && Date.now() - Number(stored.updatedAt || 0) < 30 * 60 * 1000) {
            setPlanStatus('pending')
        }
    }, [])

    useEffect(() => {
        if (!isAuthenticated || !token) {
            setPlanStatus('idle')
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/copilot', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const data = await res.json().catch(() => ({}))
                if (cancelled) return
                if (res.ok && data?.plan) {
                    setPlanStatus('ready')
                    writeStoredPlanStatus('ready')
                    return
                }
                const stored = readStoredPlanStatus()
                if (stored?.status === 'pending' && Date.now() - Number(stored.updatedAt || 0) < 30 * 60 * 1000) {
                    setPlanStatus('pending')
                    return
                }
                setPlanStatus('idle')
                writeStoredPlanStatus('idle')
            } catch {
                if (!cancelled) setPlanStatus(prev => prev)
            }
        })()
        return () => { cancelled = true }
    }, [isAuthenticated, token])

    const fetchHeroJobDetail = async (job: any) => {
        const normalized = normalizeHeroJob(job)
        if (!normalized.id) return normalized

        const authToken = token || localStorage.getItem('haigoo_auth_token')
        const baseParams = {
            id: normalized.id,
            skipAggregations: 'true'
        }

        const requestDetail = async (url: string) => {
            const resp = await fetch(url, {
                headers: {
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                }
            })
            const data = await resp.json().catch(() => ({}))
            if (!resp.ok || !Array.isArray(data.jobs) || !data.jobs[0]) return null
            return normalizeHeroJob({ ...normalized, ...data.jobs[0] })
        }

        const directParams = new URLSearchParams(baseParams)
        const direct = await requestDetail(`/api/data/processed-jobs?${directParams.toString()}`)
        if (direct) return direct

        const fallbackParams = new URLSearchParams({ resource: 'processed-jobs', ...baseParams })
        return await requestDetail(`/api/data?${fallbackParams.toString()}`) || normalized
    }

    const openHeroJobDetail = async (job: any) => {
        const initial = normalizeHeroJob(job)
        const isCopilotRecommendation = String(job?.source || '').includes('hero_copilot')
        if (isCopilotRecommendation) {
            trackingService.track('copilot_recommendation_click', {
                page_key: 'home',
                module: 'copilot_hero',
                source_key: 'home_hero',
                entity_type: 'job',
                entity_id: initial.id,
                job_id: initial.id,
                position: activeCard + 1,
                match_score: Number(job?.matchScore || 0),
                job_direction: jobDirection,
                position_type: positionType,
            })
        }
        setSelectedJobDetail(initial)
        try {
            const detailed = await fetchHeroJobDetail(job)
            setSelectedJobDetail((current: any) => current?.id === initial.id ? detailed : current)
        } catch {
            // keep the optimistic detail card if hydration fails
        }
    }

    const openTickerJobDetail = (job: any) => {
        openHeroJobDetail({ ...job, source: job?.source || 'hero_ticker' })
    }

    useEffect(() => {
        if (!hasHydrated || recommendations.length === 0) return

        const ids = Array.from(new Set(recommendations.map((job: any) => String(job?.id || '').trim()).filter(Boolean))).slice(0, dailyLimit)
        if (ids.length === 0) return

        const snapshotKey = ids.join('|')
        if (recommendationsFreshSnapshotKeyRef.current === snapshotKey) return
        recommendationsFreshSnapshotKeyRef.current = snapshotKey

        let cancelled = false
        const hydrateFreshSnapshots = async () => {
            try {
                const params = new URLSearchParams({
                    resource: 'processed-jobs',
                    ids: ids.join(','),
                    limit: String(ids.length),
                    skipAggregations: 'true',
                    _t: Math.floor(Date.now() / 60000).toString()
                })
                const authToken = token || localStorage.getItem('haigoo_auth_token')
                const resp = await fetch(`/api/data?${params.toString()}`, {
                    headers: {
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                    }
                })
                const data = await resp.json().catch(() => ({}))
                if (!resp.ok || !Array.isArray(data.jobs) || cancelled) return

                const latestById = new Map<string, any>(data.jobs.map((job: any) => [String(job?.id || job?.job_id || ''), job]))
                if (latestById.size === 0) return

                setRecommendations((current) => current.map((job: any) => {
                    const fresh = latestById.get(String(job?.id || ''))
                    if (!fresh) return job
                    return normalizeHeroJob({
                        ...job,
                        ...fresh,
                        source: job?.source || fresh?.source,
                        matchScore: job?.matchScore ?? fresh?.matchScore,
                        recommendationScore: job?.recommendationScore ?? fresh?.recommendationScore,
                        displayMatchScore: job?.displayMatchScore ?? fresh?.displayMatchScore,
                        goalFitScore: job?.goalFitScore ?? fresh?.goalFitScore,
                    })
                }))
            } catch {
                // Keep cached recommendations if lightweight hydration fails.
            }
        }

        void hydrateFreshSnapshots()
        return () => { cancelled = true }
    }, [dailyLimit, hasHydrated, recommendations, token])

    // Load saved form data from local storage for guest/returning users
    useEffect(() => {
        if (hasHydrated || authLoading) return

        const primaryCacheKey = isAuthenticated && userId ? getHeroCacheKey(userId) : getHeroCacheKey()
        const guestHeroCacheKey = getHeroCacheKey()
        const applyHeroCache = (raw: string | null) => {
            if (!raw) return false
            try {
                const data = JSON.parse(raw)
                const cacheTimestamp = data.lastUpdatedAt || data.timestamp
                if (!cacheTimestamp || Date.now() - cacheTimestamp >= HERO_CACHE_TTL) {
                    return false
                }

                setLastUpdatedAt(cacheTimestamp)
                setRecommendationHistory(normalizeHeroRecommendationHistory(data.recommendationHistory))
                if (data.jobDirection) setJobDirection(data.jobDirection)
                if (data.positionType) setPositionType(data.positionType)
                if (Array.isArray(data.recommendations)) {
                    setRecommendations(data.recommendations)
                    setHasResults(Boolean(data.hasResults || data.recommendations.length > 0))
                } else if (data.hasResults) {
                    setHasResults(true)
                }
                return true
            } catch {
                return false
            }
        }

        const cached = localStorage.getItem(primaryCacheKey)
        let hydratedFromCache = applyHeroCache(cached)

        if (!hydratedFromCache && isAuthenticated && userId && primaryCacheKey !== guestHeroCacheKey) {
            const guestCached = localStorage.getItem(guestHeroCacheKey)
            hydratedFromCache = applyHeroCache(guestCached)
            if (hydratedFromCache && guestCached) {
                localStorage.setItem(primaryCacheKey, guestCached)
            }
        }

        if (!isAuthenticated || !hydratedFromCache) {
            const saved = localStorage.getItem('copilot_guest_cache')
            if (saved) {
                try {
                    const data = JSON.parse(saved)
                    if (Date.now() - data.timestamp < 10 * 60 * 1000) {
                        if (data.jobDirection) setJobDirection(data.jobDirection)
                        if (data.positionType) setPositionType(data.positionType)
                    }
                } catch {
                    // ignore
                }
            }
        }

        const pendingGuestResume = readPendingGuestResume()
        if (pendingGuestResume) {
            setResumeId('guest-temp-id')
            setResumeName(pendingGuestResume.fileName)
            setGuestResumeHints(Array.isArray(pendingGuestResume.resumeHints) ? pendingGuestResume.resumeHints : [])
            setGuestResumeFile(hydrateGuestResumeFile(pendingGuestResume))
            writeStoredHeroResumeState({
                resumeId: 'guest-temp-id',
                resumeName: pendingGuestResume.fileName,
                source: 'guest',
                dismissed: false,
                updatedAt: Date.now(),
            })
        } else {
            const storedResumeState = readStoredHeroResumeState()
            if (storedResumeState && !storedResumeState.dismissed && storedResumeState.resumeName) {
                setResumeId(storedResumeState.resumeId || null)
                setResumeName(storedResumeState.resumeName)
            }
        }
        setHasHydrated(true)
    }, [authLoading, hasHydrated, isAuthenticated, userId])

    useEffect(() => {
        if (!hasHydrated || !isAuthenticated || !userId) return
        if (accountHeroHydratedForUser.current === userId) return

        const cached = localStorage.getItem(getHeroCacheKey(userId))
        let hydratedFromUserCache = false
        if (cached) {
            try {
                const data = JSON.parse(cached)
                const cacheTimestamp = data.lastUpdatedAt || data.timestamp
                if (cacheTimestamp && Date.now() - cacheTimestamp < HERO_CACHE_TTL) {
                    setLastUpdatedAt(cacheTimestamp)
                    setRecommendationHistory(normalizeHeroRecommendationHistory(data.recommendationHistory))
                    if (data.jobDirection) setJobDirection(data.jobDirection)
                    if (data.positionType) setPositionType(data.positionType)
                    if (Array.isArray(data.recommendations)) {
                        setRecommendations(data.recommendations)
                        setHasResults(Boolean(data.hasResults || data.recommendations.length > 0))
                    } else {
                        setRecommendations([])
                        setHasResults(Boolean(data.hasResults))
                    }
                    hydratedFromUserCache = true
                }
            } catch {
                // ignore broken cache for this user
            }
        }

        if (storedTargetRole && (!hydratedFromUserCache || !jobDirection)) {
            if (!hydratedFromUserCache && normalizePlanCompareText(jobDirection) !== normalizePlanCompareText(storedTargetRole)) {
                setRecommendations([])
                setHasResults(false)
                setJobDirection(storedTargetRole)
            } else {
                setJobDirection(prev => prev || storedTargetRole)
            }
        }

        accountHeroHydratedForUser.current = userId
    }, [hasHydrated, isAuthenticated, userId, storedTargetRole, jobDirection])

    useEffect(() => {
        if (!hasHydrated || !isAuthenticated || !token) return
        if (resumeHydratedFromAccount.current) return
        if (resumeName && resumeId) return

        const storedResumeState = readStoredHeroResumeState()
        if (storedResumeState?.dismissed) {
            resumeHydratedFromAccount.current = true
            return
        }

        let mounted = true
        const hydrateLatestResume = async () => {
            try {
                const resp = await fetch('/api/resumes', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const data = await resp.json().catch(() => ({}))
                const resumes = Array.isArray(data?.data) ? data.data : Array.isArray(data?.resumes) ? data.resumes : []
                const latest = resumes[0]
                if (!mounted || !latest) return
                const linkedResumeId = latest.id || latest.resume_id || null
                const linkedResumeName = latest.fileName || latest.file_name || latest.name || 'Resume'
                setResumeId(linkedResumeId)
                setResumeName(linkedResumeName)
                setGuestResumeFile(null)
                setGuestResumeHints([])
                writeStoredHeroResumeState({
                    resumeId: linkedResumeId,
                    resumeName: linkedResumeName,
                    source: 'account',
                    dismissed: false,
                    updatedAt: Date.now(),
                })
            } catch {
                // ignore hydrate errors
            } finally {
                resumeHydratedFromAccount.current = true
            }
        }

        hydrateLatestResume()
        return () => { mounted = false }
    }, [hasHydrated, isAuthenticated, token, resumeName, resumeId])

    useEffect(() => {
        if (!hasHydrated || authLoading) return
        if (isAuthenticated && userId && accountHeroHydratedForUser.current !== userId) return
        const payload = {
            jobDirection,
            positionType,
            recommendations,
            recommendationHistory,
            hasResults,
            lastUpdatedAt,
            timestamp: Date.now()
        }
        localStorage.setItem(getHeroCacheKey(userId), JSON.stringify(payload))
    }, [jobDirection, positionType, recommendations, recommendationHistory, hasResults, hasHydrated, lastUpdatedAt, userId, authLoading, isAuthenticated])

    useEffect(() => {
        if (!hasHydrated || !isAuthenticated || !token) return
        if (pendingResumeSyncAttempted.current) return
        pendingResumeSyncAttempted.current = true
        let mounted = true

        const syncPendingResumeToUser = async () => {
            try {
                const result = await claimPendingGuestResume(token)
                if (mounted && result.claimed) {
                    setResumeId(result.resumeId || null)
                    setGuestResumeFile(null)
                    if (resumeName) {
                        writeStoredHeroResumeState({
                            resumeId: result.resumeId || null,
                            resumeName,
                            source: 'account',
                            dismissed: false,
                            updatedAt: Date.now(),
                        })
                    }
                    showSuccess('简历已同步', '已自动关联到当前账号，可在个人中心查看')
                }
            } catch {
                // ignore sync error silently to avoid interrupting推荐链路
            }
        }

        syncPendingResumeToUser()
        return () => { mounted = false }
    }, [hasHydrated, isAuthenticated, token, showSuccess])

    useEffect(() => {
        if (!isAuthenticated) {
            pendingResumeSyncAttempted.current = false
            resumeHydratedFromAccount.current = false
            accountHeroHydratedForUser.current = null
            autoRefreshAttemptKeyRef.current = ''
        }
    }, [isAuthenticated])

    useEffect(() => {
        autoRefreshAttemptKeyRef.current = ''
    }, [userId])

    useEffect(() => {
        let mounted = true
        const loadTickerJobs = async () => {
            try {
                const fetchLatestJobs = async () => {
                    let resp = await fetch('/api/home?action=ticker_jobs&limit=48')
                    let data = await resp.json().catch(() => ({}))
                    if (resp.ok && Array.isArray(data.jobs)) return data.jobs

                    const baseParams = {
                        page: '1',
                        limit: '48',
                        sortBy: 'recent',
                        skipAggregations: 'true'
                    }

                    const fallbackParams = new URLSearchParams({
                        resource: 'processed-jobs',
                        ...baseParams
                    })
                    resp = await fetch(`/api/data?${fallbackParams.toString()}`)
                    data = await resp.json().catch(() => ({}))

                    if (!resp.ok || !Array.isArray(data.jobs)) return []
                    return data.jobs
                }

                const rawJobs = await fetchLatestJobs()
                const dedupedRaw = new Map<string, any>()
                rawJobs.forEach((j: any) => {
                    const id = String(j?.id || j?.job_id || '')
                    if (id && !dedupedRaw.has(id)) dedupedRaw.set(id, j)
                })

                const normalizedTicker = Array.from(dedupedRaw.values())
                    .map((j: any) => normalizeHeroJob(j))
                    .filter((j: any) => j?.id && j?.title && (j?.company || j?.company_name))

                const getJobTimestamp = (job: any) => {
                    const raw = job?.publishedAt || job?.createdAt
                    const ts = raw ? new Date(raw).getTime() : 0
                    return Number.isFinite(ts) ? ts : 0
                }
                const sortedTicker = normalizedTicker.sort((a: any, b: any) => getJobTimestamp(b) - getJobTimestamp(a))
                const now = Date.now()
                const withinDays = (job: any, days: number) => {
                    const ts = getJobTimestamp(job)
                    if (!ts) return false
                    return now - ts <= days * 24 * 60 * 60 * 1000
                }
                let tickerCandidates = sortedTicker
                for (const windowDays of TICKER_RECENT_WINDOWS) {
                    const windowJobs = sortedTicker.filter((job: any) => withinDays(job, windowDays))
                    if (windowJobs.length >= TICKER_TARGET_MIN) {
                        tickerCandidates = windowJobs
                        break
                    }
                    if (windowDays === TICKER_RECENT_WINDOWS[TICKER_RECENT_WINDOWS.length - 1] && windowJobs.length > 0) {
                        tickerCandidates = windowJobs
                    }
                }
                if (tickerCandidates.length < 2) {
                    tickerCandidates = sortedTicker.slice(0, Math.max(TICKER_TARGET_MIN, Math.min(TICKER_TARGET_MAX, sortedTicker.length)))
                }
                if (normalizedTicker.length < TICKER_TARGET_MIN) {
                    console.warn(`[Hero] ticker jobs less than expected: ${normalizedTicker.length}/${TICKER_TARGET_MIN}`)
                }

                let dispersedTicker = spreadByCompany(tickerCandidates, 5).slice(0, TICKER_TARGET_MAX)
                if (dispersedTicker.length < 2 && sortedTicker.length > 1) {
                    dispersedTicker = spreadByCompany(sortedTicker, 5).slice(0, TICKER_TARGET_MAX)
                }
                if (mounted && dispersedTicker.length > 0) {
                    setTickerJobs(dispersedTicker)
                    const pmPreview = tickerCandidates
                        .filter((j: any) => {
                            const companyName = j.company || j.company_name || ''
                            return j?.title && companyName && /product|pm|产品/i.test(`${j.title} ${companyName}`)
                        })
                    if (pmPreview.length > 0) setPreviewJobs(spreadByCompany(pmPreview, 3).slice(0, 3))
                    return
                }
                throw new Error('empty ticker jobs')
            } catch {
                if (mounted) {
                    setTickerJobs([])
                    setPreviewJobs([])
                }
            }
        }
        const idleId = typeof window !== 'undefined' && 'requestIdleCallback' in window
            ? (window as any).requestIdleCallback(loadTickerJobs, { timeout: 3000 })
            : globalThis.setTimeout(loadTickerJobs, 1200)
        return () => {
            mounted = false
            if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
                ;(window as any).cancelIdleCallback(idleId)
            } else {
                globalThis.clearTimeout(idleId)
            }
        }
    }, [])

    const handleResumeUpload = async (file: File) => {
        if (!privacyAccepted) {
            showWarning('请同意隐私协议', '上传前请阅读并同意简历隐私使用说明')
            setHighlightPrivacyConsent(true)
            privacyConsentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }
        setUploading(true)
        try {
            const authToken = token || localStorage.getItem('haigoo_auth_token')
            if (!authToken) {
                setResumeId('guest-temp-id')
                setResumeName(file.name)
                setGuestResumeFile(file)
                let parsedHints: string[] = []
                let parsed: any = null
                try {
                    parsed = await parseResumeFileOnDemand(file)
                    parsedHints = extractParsedResumeHints(parsed)
                } catch {
                    parsedHints = []
                }
                if (!isLikelyResumePayload(parsed, file.name)) {
                    setResumeId(null)
                    setResumeName(null)
                    setGuestResumeFile(null)
                    setGuestResumeHints([])
                    showWarning('请重新上传简历', '当前文件不像简历内容，请上传 PDF 或 Word 简历。')
                    return
                }
                setGuestResumeHints(parsedHints)
                await savePendingGuestResume(file, parsedHints)
                writeStoredHeroResumeState({
                    resumeId: 'guest-temp-id',
                    resumeName: file.name,
                    source: 'guest',
                    dismissed: false,
                    updatedAt: Date.now(),
                })
                showSuccess('简历已保存', '未登录状态已保存，5分钟内登录会自动同步到个人中心')
                setPendingHeroRecommendationRefresh({
                    resumeId: 'guest-temp-id',
                    resumeHints: parsedHints
                })
                return
            }
            const fd = new FormData()
            fd.append('file', file)
            fd.append('metadata', JSON.stringify({ source: 'copilot', module: 'copilot', from: 'home_hero' }))
            const resp = await fetch('/api/resumes', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: fd
            })
            const result = await resp.json()
            if (!resp.ok || !result.success) throw new Error(result.error || '上传失败')
            if (!isLikelyResumePayload(result.data, file.name)) {
                if (result.id) {
                    fetch(`/api/resumes?id=${encodeURIComponent(result.id)}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }).catch(() => undefined)
                }
                showWarning('请重新上传简历', '当前文件不像简历内容，请上传 PDF 或 Word 简历。')
                return
            }
            setResumeId(result.id)
            setResumeName(file.name)
            setGuestResumeFile(null)
            setGuestResumeHints([])
            clearPendingGuestResume()
            writeStoredHeroResumeState({
                resumeId: result.id,
                resumeName: file.name,
                source: 'account',
                dismissed: false,
                updatedAt: Date.now(),
            })
            markMatchScoreRefresh('resume_upload')
            showSuccess('简历上传成功', '正在为你更新今日推荐')
            setPendingHeroRecommendationRefresh({ resumeId: result.id })
        } catch (error: any) {
            showError('上传失败', error.message)
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = ''
            setUploading(false)
        }
    }

    const handleRemoveResume = () => {
        setResumeName(null)
        setResumeId(null)
        setGuestResumeFile(null)
        setGuestResumeHints([])
        clearPendingGuestResume()
        writeStoredHeroResumeState({
            resumeId: null,
            resumeName: null,
            source: isAuthenticated ? 'account' : 'guest',
            dismissed: true,
            updatedAt: Date.now(),
        })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleGetRecommendations = async (options?: {
        direction?: string
        position?: string
        silent?: boolean
        skipProfileSync?: boolean
        resumeIdOverride?: string | null
        resumeHintsOverride?: string[]
    }) => {
        const nextJobDirection = String(options?.direction ?? jobDirection).trim()
        const nextPositionType = String(options?.position ?? positionType).trim() || 'full-time'
        const effectiveResumeId = options?.resumeIdOverride !== undefined ? options.resumeIdOverride : resumeId
        const effectiveResumeHints = options?.resumeHintsOverride || guestResumeHints
        const hasResumeSignal = Boolean(effectiveResumeId || guestResumeFile || resumeName || effectiveResumeHints.length > 0)
        const requestJobDirection = nextJobDirection || (hasResumeSignal ? '远程工作' : '')
        const nextContextKey = buildHeroRecommendationContextKey(requestJobDirection, nextPositionType)
        const recentRecommendationIds = getRecentRecommendationIds(recommendationHistory, nextContextKey)

        if (!requestJobDirection) {
            showWarning('信息不足', '填写职业方向或上传简历，二选一即可。')
            return
        }
        if (nextJobDirection && isInvalidJobDirectionInput(nextJobDirection)) {
            showWarning('职业方向不完整', '请填写更具体的职业方向，例如“产品经理”“前端开发”或“HR”。')
            return
        }

        setLoading(true)
        localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection: nextJobDirection, positionType: nextPositionType, timestamp: Date.now() }))
        trackingService.track('copilot_hero_submit', {
            page_key: 'home',
            module: 'copilot_hero',
            source_key: 'home_hero',
            job_direction: requestJobDirection,
            position_type: nextPositionType,
            has_resume: Boolean(effectiveResumeId || guestResumeFile || effectiveResumeHints.length > 0),
            is_authenticated: isAuthenticated,
        })

        try {
            const authToken = localStorage.getItem('haigoo_auth_token') || token
            let parsedResumeHints = effectiveResumeHints
            if (!authToken && guestResumeFile && parsedResumeHints.length === 0) {
                const parsed = await parseResumeFileOnDemand(guestResumeFile)
                parsedResumeHints = extractParsedResumeHints(parsed)
                setGuestResumeHints(parsedResumeHints)
            }
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                },
                body: JSON.stringify({
                    action: 'hero-recommend',
                    jobDirection: requestJobDirection,
                    positionType: nextPositionType,
                    resumeId: effectiveResumeId,
                    resumeHints: authToken ? undefined : parsedResumeHints,
                    recentRecommendationIds,
                    limit: dailyLimit
                })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !Array.isArray(data.matches)) {
                throw new Error(data.error || '获取推荐失败')
            }
            const normalized = data.matches.map((j: any) => normalizeHeroJob({
                ...j,
                company_intro: j.companyIntro || j.company_intro || j.companyDescription || ''
            }))
            const capped = normalized.slice(0, dailyLimit)
            if (capped.length === 0) {
                throw new Error('当前未检索到匹配岗位')
            }
            const updatedAt = data?.generatedAt ? new Date(data.generatedAt).getTime() : Date.now()
            const todayDateKey = getLocalDateKey(updatedAt)
            const nextHistoryEntry: HeroRecommendationHistoryEntry = {
                contextKey: nextContextKey,
                dateKey: todayDateKey,
                jobIds: Array.from(new Set(capped.map((job: any) => String(job?.id || '')).filter(Boolean))),
                updatedAt,
            }
            trackingService.track('copilot_hero_success', {
                page_key: 'home',
                module: 'copilot_hero',
                source_key: 'home_hero',
                job_direction: requestJobDirection,
                position_type: nextPositionType,
                has_resume: Boolean(effectiveResumeId || guestResumeFile || parsedResumeHints.length > 0),
                result_count: capped.length,
            })
            if (jobDirection !== nextJobDirection) setJobDirection(nextJobDirection)
            if (positionType !== nextPositionType) setPositionType(nextPositionType)
            setRecommendations(capped)
            setRecommendationHistory((prev) => mergeHeroRecommendationHistory(prev, nextHistoryEntry))
            setActiveCard(0)
            setHasResults(true)
            setIsEditingPreferences(false)
            setLastUpdatedAt(updatedAt)
            const loginEventStamp = String(localStorage.getItem(LOGIN_EVENT_KEY) || '')
            autoRefreshAttemptKeyRef.current = buildHeroAutoRefreshAttemptKey(
                userId,
                nextContextKey,
                todayDateKey,
                loginEventStamp
            )
            if (isAuthenticated && nextJobDirection && !options?.skipProfileSync) {
                const normalizedCurrentTargetRole = normalizePlanCompareText(storedTargetRole)
                const normalizedNextTargetRole = normalizePlanCompareText(nextJobDirection)
                if (normalizedCurrentTargetRole !== normalizedNextTargetRole) {
                    updateProfile({ targetRole: nextJobDirection }).catch(() => false)
                }
            }
            if (!options?.silent) {
                showSuccess('匹配完成', `已为您找到 ${capped.length} 个相关岗位`)
            }

        } catch (error: any) {
            console.error(error)
            if (!options?.silent) {
                setRecommendations([])
                setHasResults(false)
            }
            if (!options?.silent) {
                showError('获取推荐失败', error?.message || '请稍后重试')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!pendingHeroRecommendationRefresh) return
        const pending = pendingHeroRecommendationRefresh
        setPendingHeroRecommendationRefresh(null)
        void handleGetRecommendations({
            direction: jobDirection,
            position: positionType,
            silent: true,
            skipProfileSync: true,
            resumeIdOverride: pending.resumeId,
            resumeHintsOverride: pending.resumeHints
        })
        // handleGetRecommendations intentionally reads current component state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingHeroRecommendationRefresh])

    useEffect(() => {
        if (!hasHydrated || !isAuthenticated) return
        if (loading) return
        if (isEditingPreferences) return

        const loginEventStamp = String(localStorage.getItem(LOGIN_EVENT_KEY) || '').trim()
        const loginEventAt = Number.parseInt(loginEventStamp, 10) || 0
        const autoRefreshAttemptKey = buildHeroAutoRefreshAttemptKey(
            userId,
            recommendationContextKey,
            todayDateKey,
            loginEventStamp
        )
        if (autoRefreshAttemptKeyRef.current === autoRefreshAttemptKey) return
        if (!effectiveJobDirection) return

        const directionMatchesProfile = !storedTargetRole || normalizePlanCompareText(effectiveJobDirection) === normalizePlanCompareText(storedTargetRole)
        const isRecommendationStaleForToday = latestRecommendationDateKey !== todayDateKey || !hasRecommendationForToday
        const shouldRefresh = directionMatchesProfile && (
            !hasResults ||
            recommendations.length === 0 ||
            recommendations.length < dailyLimit ||
            isRecommendationStaleForToday ||
            (loginEventAt > 0 && loginEventAt > lastUpdatedAt)
        )

        if (!shouldRefresh) {
            autoRefreshAttemptKeyRef.current = autoRefreshAttemptKey
            return
        }

        autoRefreshAttemptKeyRef.current = autoRefreshAttemptKey
        void handleGetRecommendations({
            direction: effectiveJobDirection,
            position: positionType,
            silent: true,
            skipProfileSync: true
        })
    }, [hasHydrated, isAuthenticated, loading, isEditingPreferences, effectiveJobDirection, storedTargetRole, hasResults, recommendations.length, lastUpdatedAt, positionType, dailyLimit, recommendationContextKey, todayDateKey, hasRecommendationForToday, userId])

    useEffect(() => {
        if (!highlightPrivacyConsent) return
        const timer = window.setTimeout(() => setHighlightPrivacyConsent(false), 2200)
        return () => window.clearTimeout(timer)
    }, [highlightPrivacyConsent])
    
    const handleGeneratePlan = () => {
        trackingService.track('copilot_plan_open', {
            page_key: 'home',
            module: 'copilot_hero',
            source_key: 'home_hero',
            job_direction: jobDirection,
            position_type: positionType,
            has_resume: Boolean(resumeId),
        })
        setKeepPlanWorkerAlive(true)
        setShowPlanModal(true)
        if (isAuthenticated) {
            setPlanStatus(prev => prev === 'ready' ? 'ready' : 'pending')
            writeStoredPlanStatus('pending')
        }
    }

    const heroCategoryItems = [
        {
            label: '产品',
            icon: '/pic_lists/Home_pics/PM-icon-transparent.webp',
            categories: ['产品经理', '项目管理', '增长黑客', '产品设计', '营销设计', '视觉设计', '平面设计', '创意设计', 'UI/UX设计', '用户研究']
        },
        {
            label: '开发',
            icon: '/pic_lists/Home_pics/dev-icon-transparent.webp',
            categories: ['前端开发', '后端开发', '全栈开发', '软件开发', '算法工程师', '测试/QA', '数据开发', '数据库工程师', '平台工程师', '移动开发', '运维/SRE', '架构师', '技术支持', '网络安全', '操作系统/内核', '服务器开发', '硬件开发', 'CTO/技术管理']
        },
        {
            label: '职能',
            icon: '/pic_lists/Home_pics/hr-icon-transparent.webp',
            categories: ['人力资源', '招聘', '行政', '会计', '财务', '法务', '管理']
        },
        {
            label: '市场',
            icon: '/pic_lists/Home_pics/mkt-icon-transparent.webp',
            categories: ['市场营销', '品牌营销', '销售', '客户经理', '商务拓展', '增长黑客']
        },
        {
            label: '运营',
            icon: '/pic_lists/Home_pics/operation-icon-transparent.webp',
            categories: ['运营', '产品运营', '活动运营', '客户服务', '内容创作', '商务拓展']
        },
        {
            label: '更多',
            icon: '/pic_lists/Home_pics/more-icon-transparent.webp',
            categories: ['数据分析', '商业分析', '数据科学', '教育培训', '咨询', '投资', '游戏', '其他']
        },
    ]
    const heroPreviewJobs = (displayRecommendations.length > 0 ? displayRecommendations : PREVIEW_PM_RECOMMENDATIONS).slice(0, 3)
    const heroCompanyCards = [
        { name: 'Loom', desc: '视频协作工具', image: '/pic_lists/Jobs_pics/card_bg1.webp' },
        { name: 'Automattic', desc: '开源与出版平台', image: '/pic_lists/Jobs_pics/card_bg2.webp' },
        { name: 'Zapier', desc: '自动化工具', image: '/pic_lists/Home_pics/background03.webp' },
    ]
    const runHeroSearch = (value?: string) => {
        const keyword = String(value || heroSearchTerm || '').trim()
        const params = new URLSearchParams()
        params.set('memberOnly', 'false')
        if (keyword) params.set('search', keyword)
        navigate(`/jobs${params.toString() ? `?${params.toString()}` : ''}`)
    }

    const openHeroCategory = (categories: string[]) => {
        const params = new URLSearchParams()
        params.set('category', categories.join(','))
        params.set('memberOnly', 'false')
        params.set('source', 'home-hero')
        navigate(`/jobs?${params.toString()}`)
    }

    const heroHighlightItems = [
        { title: '远程友好', desc: '团队分布全球', icon: '/pic_lists/Home_pics/strength-remote.webp' },
        { title: '全球福利', desc: '享受全球薪酬', icon: '/pic_lists/Home_pics/strength-global pay.webp' },
        { title: '成长机会', desc: '持续发展空间', icon: '/pic_lists/Home_pics/strength-improvement.webp' },
        { title: '热爱驱动', desc: '做你喜欢的事', icon: '/pic_lists/Home_pics/strength-passion.webp' },
    ]
    const companyFallbackImages = ['/pic_lists/Jobs_pics/card_bg1.webp', '/pic_lists/Jobs_pics/card_bg2.webp', '/pic_lists/Home_pics/background03.webp']
    const heroRecommendationPreviewLimit = isAuthenticated ? dailyLimit : 3
    const heroCaseCandidates = displayRecommendations.length > 0
        ? displayRecommendations
        : curatedJobs.length > 0
            ? curatedJobs
            : PREVIEW_PM_RECOMMENDATIONS
    const heroCaseJobs = (() => {
        const primary = heroCaseCandidates.slice(0, heroRecommendationPreviewLimit)
        if (primary.length >= heroRecommendationPreviewLimit) return primary

        const seen = new Set(primary.map((job: any) => String(job?.id || `${job?.title || ''}:${job?.company || job?.company_name || ''}`)))
        const fillers = [...curatedJobs, ...previewJobs, ...PREVIEW_PM_RECOMMENDATIONS].filter((job: any) => {
            const key = String(job?.id || `${job?.title || ''}:${job?.company || job?.company_name || ''}`)
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
        })
        return [...primary, ...fillers].slice(0, heroRecommendationPreviewLimit)
    })()
    const canRequestRecommendations = Boolean(String(jobDirection).trim() || resumeId || resumeName || guestResumeFile)
    return (
        <div className="relative overflow-hidden bg-[#fbfaf6] pt-20 text-slate-950 md:pt-24">
            <div className="pointer-events-none absolute inset-0">
                <img
                    src={HOME_HERO_BG_SRC}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="absolute inset-x-0 top-[-18px] h-[1040px] w-full origin-center scale-[1.08] object-cover object-[58%_center] opacity-95 saturate-[1.05] contrast-[1.04]"
                />
                <div className="absolute inset-x-0 top-0 h-[900px] bg-[linear-gradient(90deg,rgba(255,253,249,0.92)_0%,rgba(255,253,249,0.68)_31%,rgba(255,253,249,0.14)_64%,rgba(255,253,249,0.05)_100%),radial-gradient(circle_at_71%_48%,rgba(116,163,196,0.16),transparent_31%),linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(251,250,246,0.10)_64%,rgba(251,250,246,0.64)_86%,#fbfaf6_100%)]" />
                <div className="absolute inset-x-0 top-[640px] h-[280px] bg-[linear-gradient(180deg,rgba(251,250,246,0)_0%,rgba(251,250,246,0.72)_58%,#fbfaf6_100%)]" />
            </div>

            <section className="relative mx-auto grid max-w-[1560px] items-center gap-7 px-5 pb-8 pt-7 lg:min-h-[720px] lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:pb-10 lg:pt-0">
                {shouldShowUpgradeBanner && (
                    <div className="absolute left-5 top-3 z-30 max-w-[calc(100%-2.5rem)] lg:left-10 lg:top-10 xl:max-w-[640px]">
                        <div className="flex h-9 w-fit max-w-full items-center gap-2 rounded-full border border-[#eadfc8]/80 bg-[#fffdf8]/92 py-1 pl-1.5 pr-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_14px_34px_-30px_rgba(116,90,44,0.42)] ring-1 ring-white/60 backdrop-blur-sm">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white">
                                <img
                                    src={HOME_UPGRADE_AVATAR_SRC}
                                    alt=""
                                    className="h-6 w-6 object-contain"
                                    loading="eager"
                                    decoding="async"
                                />
                            </div>
                            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap sm:overflow-visible sm:text-clip">
                                {upgradeBannerMessage}
                            </span>
                            {!isSystemUpgradeNoticeActive ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleUpgradeBannerFeedback}
                                        className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-[#eadfc8]/80 bg-white/88 px-2 text-[12px] font-black text-[#a36b18] transition-colors hover:bg-[#fff7e8]"
                                        aria-label="我要留言"
                                    >
                                        <MessageCircle className="h-3.5 w-3.5" />
                                        <span>我要留言</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={dismissUpgradeBanner}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/76 text-slate-400 transition-colors hover:text-slate-700"
                                        aria-label="关闭提示"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
                <div className={`relative z-10 w-full min-w-0 max-w-[640px] ${shouldShowUpgradeBanner ? 'pt-11 sm:pt-0' : ''}`}>
                    <h1 className="relative max-w-[640px]" aria-label="用你喜欢的方式 工作和生活">
                        <span className="sr-only">用你喜欢的方式 工作和生活</span>
                        <picture aria-hidden="true">
                            <source
                                type="image/webp"
                                srcSet={HOME_HERO_TITLE_SRCSET}
                                sizes="(min-width: 1280px) 640px, (min-width: 640px) 560px, calc(100vw - 40px)"
                            />
                            <img
                                src={HOME_HERO_TITLE_SRC}
                                alt=""
                                width={680}
                                height={208}
                                loading="eager"
                                decoding="async"
                                className="-ml-2 block h-auto w-full max-w-[640px] select-none sm:-ml-3 lg:-ml-4"
                                draggable={false}
                            />
                        </picture>
                        <img
                            src={HOME_HERO_INLINE_LOVE_SRC}
                            alt=""
                            aria-hidden="true"
                            loading="eager"
                            decoding="async"
                            className="pointer-events-none absolute left-[64%] top-[72%] h-6 w-auto -translate-x-1/2 -translate-y-1/2 select-none object-contain sm:h-7 lg:h-8"
                            draggable={false}
                        />
                    </h1>
                    <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#6b7b90] sm:mt-5 sm:text-[18px] sm:leading-8">
                        可以全球旅居，也可以居家办公。Haigoo 帮你获得理想的远程工作，在喜欢的地方，做有价值的事。
                    </p>

                    <div className="mt-5 flex w-full max-w-xl items-center rounded-full border border-[#dce8f1] bg-white/88 p-1.5 shadow-[0_22px_54px_-38px_rgba(62,91,120,0.36)] sm:mt-7 sm:p-2">
                        <input
                            value={heroSearchTerm}
                            onChange={(event) => setHeroSearchTerm(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') runHeroSearch()
                            }}
                            placeholder="想找什么样的远程工作呢？"
                            className="min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-300 sm:px-5 sm:text-base"
                        />
                        <button
                            type="button"
                            onClick={() => runHeroSearch()}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#e7edf3] bg-white text-[#5c708d] shadow-sm transition-all hover:-translate-y-0.5 hover:text-[#2f6ed8]"
                            aria-label="搜索岗位"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="mt-5 grid w-full max-w-xl grid-cols-2 gap-2.5 sm:mt-6 sm:grid-cols-6 sm:gap-3">
                        {heroCategoryItems.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                onClick={() => openHeroCategory(item.categories)}
                                className="group flex h-[78px] flex-col items-center justify-center rounded-[18px] border border-[#eadfcf] bg-[#fffdf8] text-[13px] font-black text-[#40516a] shadow-[0_14px_32px_-30px_rgba(139,101,54,0.36)] transition-all hover:-translate-y-1 hover:border-[#dbcaa8] hover:bg-white sm:h-[92px] sm:rounded-[20px] sm:text-sm"
                            >
                                <img src={item.icon} alt="" loading="eager" decoding="async" className="mb-1.5 h-8 w-8 object-contain mix-blend-multiply drop-shadow-[0_5px_8px_rgba(139,101,54,0.14)] transition-transform group-hover:scale-105 sm:mb-2 sm:h-10 sm:w-10" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative hidden min-h-0 lg:block lg:min-h-[620px]">
                    <div className="relative z-20 flex w-full min-w-0 flex-col rounded-[26px] border border-[#eadfcf] bg-[#fffdf8] p-4 shadow-[0_24px_70px_-56px_rgba(139,101,54,0.36)] lg:absolute lg:bottom-2 lg:right-0 lg:top-3 lg:rounded-[34px] lg:p-5 xl:right-8 xl:w-[min(600px,calc(100%-120px))] xl:min-w-[520px]">
                        <div className="mb-3">
                            <h2 className="text-[20px] font-black leading-tight tracking-normal text-slate-950 sm:text-[24px]">
                                {isAuthenticated ? '每日推荐5个与你匹配的岗位' : '每日推荐5个与你匹配的岗位（需登录）'}
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <InputCard
                                label="职业方向"
                                icon={Target}
                                value={jobDirection}
                                onChange={(val) => {
                                    setJobDirection(val)
                                    localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection: val, positionType, timestamp: Date.now() }))
                                }}
                                placeholder="产品经理 / 数据分析 / 前端开发"
                            />
                            <InputCard
                                label="岗位类型"
                                icon={Briefcase}
                                value={positionType}
                                onChange={(val) => {
                                    setPositionType(val)
                                    localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection, positionType: val, timestamp: Date.now() }))
                                }}
                                options={[
                                    { value: 'full-time', label: '全职远程' },
                                    { value: 'contract', label: '合同/兼职' },
                                    { value: 'freelance', label: '自由职业' },
                                    { value: 'internship', label: '实习' },
                                ]}
                            />
                        </div>

                        <div className="mt-3 grid flex-1 content-start gap-2 overflow-hidden pr-0 sm:min-h-[190px] sm:pr-1">
                            {heroCaseJobs.map((rawJob: any) => {
                                const job = normalizeHeroJob(rawJob)
                                const salaryText = getHeroDisplaySalary(job.salary || job.salary_range)
                                const isVipJob = normalizeHeroBoolean((job as any).memberOnly ?? (job as any).member_only)
                                const translatedTitle = typeof job.translations?.title === 'string' ? job.translations.title.trim() : ''
                                const displayTitle = translatedTitle || job.title
                                const displayCompany = job.translations?.company || job.company_name || job.company || '远程企业'
                                const isNewJob = isFreshHomeJob(job)
                                const metaItems = [
                                    job.category,
                                    job.jobType,
                                    job.location || 'Remote'
                                ].map((item) => String(item || '').trim()).filter(Boolean)
                                const logoCandidates = Array.isArray(job.logo_candidates) ? job.logo_candidates : []
                                return (
                                    <button
                                        key={job.id}
                                        type="button"
                                        onClick={() => openHeroJobDetail({ ...job, source: 'home_hero_case' })}
                                        className="flex items-center gap-3 rounded-[18px] border border-[#edf1e8] bg-white px-3.5 py-2.5 text-left shadow-[0_10px_28px_-26px_rgba(139,101,54,0.28)] transition-all hover:-translate-y-0.5 hover:border-[#dbcaa8]"
                                    >
                                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-2xl border border-[#e6edf3] bg-white text-xs font-black text-[#6f63f6] shadow-[0_10px_24px_-22px_rgba(62,91,120,0.42)]">
                                            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl">
                                                <CompanyLogo companyName={displayCompany} logoCandidates={logoCandidates} className="h-full w-full object-contain p-1.5" />
                                            </span>
                                            {isVipJob ? <HomeVipBadge className="absolute -right-3 -top-1.5 z-20" /> : null}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex min-w-0 items-center gap-1.5">
                                                <span className="block truncate text-sm font-black text-slate-900" title={displayTitle}>{displayTitle}</span>
                                                {translatedTitle ? (
                                                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-black text-slate-500" title="已翻译">译</span>
                                                ) : null}
                                                {isNewJob ? <HomeNewBadge /> : null}
                                            </span>
                                            <span className="block truncate text-xs font-semibold text-slate-500">
                                                {displayCompany}{metaItems.length ? ` · ${metaItems.slice(0, 2).join(' · ')}` : ''}
                                            </span>
                                        </span>
                                        <span className="hidden shrink-0 rounded-full bg-[#fff8e8] px-2.5 py-1 text-xs font-black text-[#c48212] sm:inline-flex">
                                            {salaryText}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
                            <div
                                className={`rounded-[20px] border border-dashed p-3.5 text-center transition-all ${
                                    resumeName ? 'border-[#b9d9f5] bg-[#f6fbff]' : 'border-[#dfeaf1] bg-white/80 hover:border-[#b9d9f5]'
                                }`}
                                onClick={() => {
                                    if (resumeName) return
                                    if (!privacyAccepted) {
                                        showWarning('请先同意简历隐私使用说明', '上传前请确认简历仅用于岗位匹配分析。')
                                        setHighlightPrivacyConsent(true)
                                        return
                                    }
                                    if (fileInputRef.current) fileInputRef.current.value = ''
                                    fileInputRef.current?.click()
                                }}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    e.preventDefault()
                                    if (resumeName) return
                                    if (!privacyAccepted) {
                                        showWarning('请先同意简历隐私使用说明', '上传前请确认简历仅用于岗位匹配分析。')
                                        setHighlightPrivacyConsent(true)
                                        return
                                    }
                                    const f = e.dataTransfer.files?.[0]
                                    if (f) handleResumeUpload(f)
                                }}
                            >
                                {uploading ? (
                                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#6f63f6]">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        上传中...
                                    </div>
                                ) : resumeName ? (
                                    <div className="flex items-center justify-center gap-2 text-sm font-black text-[#2f6ed8]">
                                        <span className="max-w-[260px] truncate">{resumeName}</span>
                                        <button onClick={e => { e.stopPropagation(); handleRemoveResume() }} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-sm font-black text-slate-600">
                                        <UploadCloud className="h-4 w-4 text-[#6f63f6]" />
                                        上传简历，获得更贴近你的岗位
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => { void handleGetRecommendations() }}
                                disabled={loading || !canRequestRecommendations}
                                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[20px] bg-[#7b74ff] px-5 text-sm font-black text-white shadow-[0_18px_42px_-26px_rgba(111,99,246,0.62)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {loading ? '正在推荐...' : '查看今日推荐'}
                            </button>
                        </div>

                        <div className="mt-2">
                            <label
                                ref={privacyConsentRef}
                                className={`flex cursor-pointer items-center gap-2 px-1 text-[10px] leading-4 text-slate-500 transition-all ${highlightPrivacyConsent ? 'rounded-lg bg-[#fff7dc] px-2 py-1 ring-2 ring-[#f0d37a]' : ''}`}
                            >
                                <input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} className="h-3 w-3 shrink-0 accent-[#6f63f6]" />
                                <span>我已阅读并同意 <a href="/privacy" target="_blank" className="font-black text-[#4f46e5] underline">简历隐私使用说明</a>，仅用于岗位匹配分析。</span>
                            </label>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative isolate mx-auto max-w-[1560px] px-5 pb-14 lg:px-10">
                <div className="pointer-events-none absolute left-1/2 top-[-110px] z-0 h-[calc(100%+110px)] w-screen -translate-x-1/2 bg-[linear-gradient(180deg,rgba(251,250,246,0)_0%,#fbfaf6_9%,#fbfaf6_100%)]" />
                <div className="relative z-30 rounded-[28px] border border-[#e4e9ff] bg-[#fffefd] p-5 shadow-[0_24px_70px_-58px_rgba(84,78,180,0.26)]">
                    <div className="grid gap-4 md:grid-cols-[300px_1fr] md:items-center">
                        <div>
                            <div className="flex items-center gap-2 text-lg font-black tracking-normal text-slate-950">
                                我们为你精挑细选 ✨
                                <span className="group relative inline-flex">
                                    <button
                                        type="button"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dfe7ff] bg-white text-[#6f63f6] shadow-sm transition-all hover:-translate-y-0.5"
                                        aria-label="查看筛选规则"
                                    >
                                        <ShieldCheck className="h-4 w-4" />
                                    </button>
                                    <span className="pointer-events-none absolute left-1/2 top-full z-[90] mt-3 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[18px] border border-[#eadfcf] bg-[#fffdf8] p-4 text-left opacity-0 shadow-[0_18px_44px_-34px_rgba(139,101,54,0.34)] transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                                        <span className="block text-sm font-black text-slate-950">海狗远程俱乐部企业筛选标准</span>
                                        <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-600">优先展示经过基础信息核验、远程文化友好、岗位信息清晰的企业，符合以下 5 项筛选标准：</span>
                                        <span className="mt-2 grid gap-1.5">
                                            {HAIGOO_VERIFICATION_STANDARDS.map((item) => (
                                                <span key={item} className="flex gap-2 text-xs font-semibold leading-5 text-slate-700">
                                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                    <span>{item}</span>
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-500">所有岗位都经过人工严格筛选，请放心申请。</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {heroHighlightItems.map((item) => (
                                <div key={item.title} className="flex items-center gap-3 rounded-[20px] border border-white/80 bg-white/74 p-4">
                                    <img src={item.icon} alt="" className="h-10 w-10 object-contain" />
                                    <div>
                                        <div className="text-sm font-black text-slate-900">{item.title}</div>
                                        <div className="mt-1 text-xs font-semibold text-slate-500">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-6 rounded-[30px] border border-[#e3edf4] bg-[#fffefd] p-5 shadow-[0_24px_70px_-58px_rgba(62,91,120,0.34)]">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-[24px] font-black leading-tight tracking-normal text-slate-950 sm:text-[28px]">人工精选</h2>
                            <p className="mt-1 text-sm text-slate-500">不只帮你筛出国内可申的岗位，更帮你筛出靠谱的好机会</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {HOME_FEATURED_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveFeaturedTab(tab.id)}
                                    className={`rounded-full border px-3.5 py-2 text-xs font-black transition-all ${
                                        activeFeaturedTab === tab.id
                                            ? 'border-[#8f8afe] bg-[#f0edff] text-[#6f63f6]'
                                            : 'border-[#e1e9f1] bg-white/80 text-slate-500 hover:border-[#cfdff0] hover:text-slate-800'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {featuredTabLoading ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {[...Array(6)].map((_, index) => (
                                <div key={index} className="h-[132px] animate-pulse rounded-[22px] border border-[#edf2f6] bg-[#f7fbff]" />
                            ))}
                        </div>
                    ) : curatedJobs.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-[#dfeaf1] bg-[#f8fbff] px-6 py-10 text-center text-sm font-semibold text-slate-500">
                            这个分类暂时没有精选岗位，先看看其他方向。
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {curatedJobs.map((rawJob) => {
                                const job = normalizeHeroJob(rawJob)
                                const company = job.company_name || job.company || 'Company'
                                const logoCandidates = job.logo_candidates || resolveLogoCandidates(
                                    job.company_logo || job.logo || job.companyLogo,
                                    company,
                                    job.company_website || job.companyWebsite,
                                    job.companyId || job.company_id,
                                    job.cachedLogoUrl || job.cachedCompanyLogoUrl || job.cached_logo_url
                                )
                                const tags = Array.isArray(job.tags) ? job.tags : Array.isArray(job.skills) ? job.skills : []
                                const salaryText = getHeroDisplaySalary(job.salary || job.salary_range)
                                const ratingText = String(job.companyRating || job.company_rating || job.trustedCompanyRating || job.trusted_company_rating || job.rating || '').trim()
                                const isVipJob = normalizeHeroBoolean((job as any).memberOnly ?? (job as any).member_only)
                                const translatedTitle = typeof job.translations?.title === 'string' ? job.translations.title.trim() : ''
                                const displayTitle = translatedTitle || job.title
                                const displayCompany = job.translations?.company || company
                                const hasTranslatedTitle = Boolean(translatedTitle)
                                const isNewJob = isFreshHomeJob(job)
                                return (
                                    <button
                                        key={job.id}
                                        type="button"
                                        onClick={() => openHeroJobDetail({ ...job, source: 'home_curated_tab' })}
                                        className="group flex min-h-[132px] items-center gap-4 rounded-[22px] border border-[#e3edf4] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,252,255,0.96))] p-4 text-left shadow-[0_18px_46px_-40px_rgba(62,91,120,0.44)] transition-all hover:-translate-y-0.5 hover:border-[#c8dff0] hover:bg-white"
                                    >
                                        <div className="relative hidden h-14 w-14 shrink-0 items-center justify-center overflow-visible rounded-[18px] border border-[#e6edf3] bg-white p-1 shadow-sm sm:flex">
                                            <CompanyLogo companyName={displayCompany} logoCandidates={logoCandidates} className="h-full w-full object-contain" />
                                            {isVipJob ? <HomeVipBadge className="absolute -right-3 -top-1.5 z-20" /> : null}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <div className="line-clamp-1 min-w-0 text-base font-black text-slate-950 group-hover:text-[#2f6ed8]" title={displayTitle}>{displayTitle}</div>
                                                {hasTranslatedTitle ? (
                                                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black leading-none text-slate-500" title="已翻译">
                                                        译
                                                    </span>
                                                ) : null}
                                                {isNewJob ? <HomeNewBadge /> : null}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-500">
                                                <span className="max-w-[13ch] truncate">{displayCompany}</span>
                                                {ratingText ? (
                                                    <span className="inline-flex items-center gap-0.5 font-black text-[#c48212]">
                                                        <Star className="h-3.5 w-3.5 fill-current" />
                                                        {ratingText}
                                                    </span>
                                                ) : null}
                                                <span className="text-slate-300">·</span>
                                                <span className="max-w-[13ch] truncate">{job.location}</span>
                                                <span className="rounded-full bg-[#fff8e8] px-2 py-0.5 text-xs font-black text-[#c48212]">{salaryText}</span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {tags.slice(0, 3).map((tag: any) => (
                                                    <span key={String(tag)} className="rounded-full bg-[#eef7ff] px-2 py-1 text-[11px] font-bold text-[#2f6ed8]">{String(tag)}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#6f63f6]" />
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className={`relative z-10 mt-6 overflow-hidden rounded-[30px] border p-5 ${
                    isMember
                        ? 'border-[#ddd7ff] bg-[linear-gradient(105deg,#fbfaff_0%,#ffffff_54%,#f5f7ff_100%)] shadow-[0_24px_70px_-58px_rgba(95,99,246,0.34)]'
                        : 'border-[#f2dfb7] bg-[linear-gradient(105deg,#fffaf0_0%,#ffffff_54%,#f5f2ff_100%)]'
                }`}>
                    {isMember ? (
                        <>
                            <img src="/pic_lists/About_pics/about_bg.webp" alt="" className="pointer-events-none absolute inset-y-0 right-0 h-full w-[36%] object-cover object-right opacity-[0.12] saturate-[0.86]" />
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(216,210,255,0.28),transparent_24%),radial-gradient(circle_at_62%_90%,rgba(224,241,255,0.32),transparent_30%)]" />
                        </>
                    ) : null}
                    <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] shadow-sm ${isMember ? `${homeMemberEntitlement.iconBg} ${homeMemberEntitlement.iconText}` : 'bg-white text-[#d9951f]'}`}>
                                <Crown className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-xl font-black tracking-normal text-slate-950">
                                    {isMember ? homeMemberEntitlement.title : '加入 Haigoo Remote Club，获得更多求职支持'}
                                </div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                    {isMember
                                        ? homeMemberEntitlement.description
                                        : 'Club 会员可获得更多岗位申请支持、联系人资源、外企文化资料和英语学习工具，帮助你更高效地准备远程求职。'}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(isMember
                                        ? homeMemberEntitlement.tags
                                        : ['岗位申请支持', '联系人资源', '外企英语学习', '精选企业资料', '求职工具权限']
                                    ).map((item) => (
                                        <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white/72 px-3 py-1.5 text-xs font-black text-slate-600">
                                            <CheckCircle2 className={`h-3.5 w-3.5 ${isMember ? homeMemberEntitlement.iconText : 'text-[#6f63f6]'}`} />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(isMember ? homeMemberEntitlement.ctaHref : '/profile?tab=membership#club-service-plans')}
                            className={`relative inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-black text-white transition-all hover:-translate-y-0.5 ${isMember ? 'bg-slate-950 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.48)] hover:bg-[#6f63f6]' : 'bg-[#f0a11f] shadow-[0_18px_42px_-26px_rgba(217,149,31,0.64)]'}`}
                        >
                            {isMember ? homeMemberEntitlement.button : '了解 Club 权益'}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="relative z-10 mt-6 rounded-[30px] border border-[#e3edf4] bg-[#fffefd] p-5 shadow-[0_24px_70px_-58px_rgba(62,91,120,0.34)]">
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <h2 className="inline-flex items-center gap-1 text-[24px] font-black leading-tight tracking-normal text-slate-950 sm:text-[28px]">
                                心动的企业
                                <span className="relative -ml-1 inline-flex h-[0.78em] w-[0.82em] translate-y-[0.02em] overflow-hidden">
                                    <img src={HOME_HERO_LOVE_SRC} alt="" loading="lazy" decoding="async" className="absolute left-1/2 top-1/2 h-[1.55em] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" />
                                </span>
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">精选尊重员工、开放多元、持续成长的远程企业</p>
                        </div>
                        <button type="button" onClick={() => navigate('/trusted-companies')} className="hidden text-sm font-black text-[#6f63f6] md:inline-flex">
                            探索更多优秀公司 →
                        </button>
                    </div>

                    <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {companiesLoading ? (
                            [...Array(6)].map((_, index) => (
                                <div key={index} className="h-[250px] animate-pulse rounded-[22px] border border-[#edf2f6] bg-[#f7fbff]" />
                            ))
                        ) : displayCompanies.length === 0 ? (
                            <div className="rounded-[22px] border border-dashed border-[#dfeaf1] bg-[#f8fbff] p-8 text-sm font-semibold text-slate-500 sm:col-span-2 lg:col-span-3">
                                暂无企业数据。
                            </div>
                        ) : displayCompanies.map((company, index) => {
                            const stats = companyJobStats[company.name]
                            const fallbackImage = companyFallbackImages[index % companyFallbackImages.length]
                            const coverImage = company.coverImage || companyCoverImages[company.id] || fallbackImage
                            return (
                                <button
                                    key={company.id}
                                    type="button"
                                    onClick={() => navigate(getCompanyDetailPath(company.name))}
                                    className="group overflow-hidden rounded-[20px] border border-[#e3edf4] bg-white text-left shadow-[0_18px_46px_-40px_rgba(62,91,120,0.44)] transition-all hover:-translate-y-0.5 hover:border-[#c8dff0]"
                                >
                                    <div className="relative aspect-[16/9] overflow-hidden bg-[#f7fbff]">
                                        <img src={coverImage} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    </div>
                                    <div className="p-3.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="line-clamp-1 font-black text-slate-950">{company.name}</div>
                                            {company.industry ? <span className="shrink-0 rounded-full bg-[#eef7ff] px-2 py-1 text-[11px] font-bold text-[#2f6ed8]">{company.industry}</span> : null}
                                        </div>
                                        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-500">{company.description || company.translations?.description || '远程友好企业，持续开放全球机会。'}</p>
                                        <div className="mt-3 flex items-center justify-between border-t border-[#edf2f6] pt-3 text-xs font-bold text-slate-500">
                                            <span className="truncate">{formatHiringLine(stats?.total ?? company.jobCount ?? 0, stats?.categories)}</span>
                                            <span className="text-[#6f63f6]">查看岗位 →</span>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    <aside className="relative h-full overflow-hidden rounded-[24px] border border-[#e3edf4] bg-[#fffdf8] p-5 shadow-[0_18px_46px_-40px_rgba(62,91,120,0.28)]">
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.96)_0%,rgba(255,255,255,0.98)_100%)]" />
                        <img src="/pic_lists/About_pics/sun-transparent.webp" alt="" loading="lazy" decoding="async" className="pointer-events-none absolute right-5 top-5 h-14 w-14 object-contain opacity-20" />
                        <img src="/pic_lists/About_pics/love-transparent.webp" alt="" loading="lazy" decoding="async" className="pointer-events-none absolute right-16 top-16 h-7 w-7 object-contain opacity-30" />
                        <div className="relative flex h-full flex-col">
                            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#dbe9f2] bg-white/82 px-3 py-1 text-xs font-black text-[#6f63f6] shadow-sm">
                                <Users className="h-3.5 w-3.5" />
                                远程求职交流群
                            </div>
                            <h3 className="whitespace-nowrap text-[20px] font-black leading-tight text-slate-950 lg:text-[21px]">
                                加入 Haigoo 远程交流群
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                群里会同步更有参考价值的精选岗位、求职讨论和优先答疑，适合正在认真找机会的用户。
                            </p>

                            <div className="mt-4 grid gap-2">
                                {[
                                    { title: '每日精选岗位', desc: '固定同步重点机会', icon: Briefcase },
                                    { title: '同行交流', desc: '讨论投递和面试节奏', icon: Users },
                                    { title: '重点信息提醒', desc: '不错过重要更新', icon: Sparkles },
                                ].map((item) => (
                                    <div key={item.title} className="flex items-center gap-3 rounded-[18px] border border-[#edf2f6] bg-white/76 px-3 py-2.5">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#6f63f6]">
                                            <item.icon className="h-[18px] w-[18px]" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-black text-slate-900">{item.title}</span>
                                            <span className="mt-0.5 block text-xs font-semibold text-slate-500">{item.desc}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 rounded-[22px] border border-[#e3edf4] bg-white/86 p-3 text-center shadow-sm">
                                <img src="/Wechat_group.webp" alt="Haigoo 远程求职交流群二维码" className="mx-auto h-32 w-32 rounded-2xl object-contain" />
                                <div className="mt-2 text-sm font-black text-slate-700">微信扫一扫加群</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/jobs')}
                                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-black text-white shadow-[0_18px_42px_-28px_rgba(15,23,42,0.44)] transition-all hover:-translate-y-0.5"
                            >
                                先看看今日岗位
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </aside>
                    </div>
                </div>

                <Suspense fallback={<div className="mt-6 h-40 rounded-[34px] border border-[#e3edf4] bg-white/70" />}>
                    <LazyHaigooClubInfoCard className="mt-6" />
                </Suspense>
            </section>

            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f) }} />
            {(showPlanModal || keepPlanWorkerAlive) && (
                <CopilotPlanModal
                    visible={showPlanModal}
                    onClose={() => setShowPlanModal(false)}
                    onDispose={() => setKeepPlanWorkerAlive(false)}
                    onStatusChange={(status) => {
                        setPlanStatus(status)
                        writeStoredPlanStatus(status)
                    }}
                    jobDirection={jobDirection}
                    positionType={positionType}
                    resumeId={resumeId}
                />
            )}
            {selectedJobDetail && (
                <Suspense fallback={null}>
                    <LazyJobDetailModal
                        job={selectedJobDetail}
                        isOpen={Boolean(selectedJobDetail)}
                        onClose={() => setSelectedJobDetail(null)}
                        variant="center"
                        jobs={heroDetailJobs}
                        currentJobIndex={currentHeroJobIndex}
                        onNavigateJob={(direction) => {
                            if (!heroDetailJobs.length) return
                            const safeCurrentIndex = currentHeroJobIndex >= 0 ? currentHeroJobIndex : 0
                            const nextIndex = direction === 'prev'
                                ? (safeCurrentIndex - 1 + heroDetailJobs.length) % heroDetailJobs.length
                                : (safeCurrentIndex + 1) % heroDetailJobs.length
                            const nextJob = heroDetailJobs[nextIndex]
                            if (nextJob) openHeroJobDetail(nextJob)
                        }}
                    />
                </Suspense>
            )}
            {showUpgradeFeedbackModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="关闭留言弹窗"
                        className="absolute inset-0 bg-slate-950/38 backdrop-blur-sm"
                        onClick={() => setShowUpgradeFeedbackModal(false)}
                    />
                    <div className="relative w-full max-w-md rounded-[24px] border border-[#eadfc8] bg-[#fffdf8] p-5 shadow-[0_30px_80px_-42px_rgba(116,90,44,0.58)]">
                        <button
                            type="button"
                            onClick={() => setShowUpgradeFeedbackModal(false)}
                            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfc8] bg-white/86 text-slate-400 transition-colors hover:text-slate-700"
                            aria-label="关闭"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <div className="pr-10">
                            <div className="text-[22px] font-semibold tracking-normal text-[#a36b18]">
                                给 Haigoo 留言
                            </div>
                            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                                想聊聊远程求职体验、页面建议，或希望海狗优先完善什么，都可以写在这里。
                            </p>
                        </div>
                        <textarea
                            value={upgradeFeedbackContent}
                            onChange={(event) => setUpgradeFeedbackContent(event.target.value)}
                            rows={5}
                            maxLength={500}
                            className="mt-4 w-full resize-none rounded-[18px] border border-[#eadfc8] bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-[#d2b574]"
                            placeholder="写下你的想法、建议、遇到的问题，或想对海狗说的话..."
                            autoFocus
                        />
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowUpgradeFeedbackModal(false)}
                                className="rounded-full border border-[#eadfc8] bg-white px-4 py-2 text-sm font-black text-slate-500 transition-colors hover:bg-[#fff7e8]"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                disabled={upgradeFeedbackSubmitting}
                                onClick={submitUpgradeFeedback}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#a36b18] px-5 py-2 text-sm font-black text-white shadow-[0_14px_34px_-24px_rgba(116,90,44,0.75)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {upgradeFeedbackSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                提交留言
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


function CopilotPlanModal({
    visible,
    onClose,
    onDispose,
    onStatusChange,
    jobDirection,
    positionType,
    resumeId
}: {
    visible: boolean
    onClose: () => void
    onDispose: () => void
    onStatusChange: (status: 'idle' | 'pending' | 'ready') => void
    jobDirection: string
    positionType: string
    resumeId: string | null
}) {
    const { isAuthenticated, token, isMember } = useAuth()
    const { showInfo, showSuccess, showWarning } = useNotificationHelpers()
    const trackedPlanSuccessRef = useRef(false)
    const [planDefaults, setPlanDefaults] = useState({
        language: '中等（可借助翻译软件线上交流）',
        education: '大学本科',
        preparationTime: '1-3个月',
        weeklyHours: '5-10小时',
    })
    const [planData, setPlanData] = useState<any | null>(null)
    const [planLoading, setPlanLoading] = useState(false)
    const [planError, setPlanError] = useState('')
    const [planReloadTick, setPlanReloadTick] = useState(0)
    const backgroundNotifiedRef = useRef(false)
    const canCustomizeDefaults = isAuthenticated && isMember
    const positionTypeLabel = positionType === 'full-time'
        ? '全职远程'
        : positionType === 'contract'
            ? '合同/兼职'
            : positionType === 'freelance'
                ? '自由职业'
                : '实习'

    useEffect(() => {
        const prev = document.body.style.overflow
        if (visible) {
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.body.style.overflow = prev
        }
    }, [visible])

    useEffect(() => {
        let mounted = true
        const loadPlan = async () => {
            if (!isAuthenticated || !token) return
            setPlanLoading(true)
            setPlanError('')
            onStatusChange('pending')
            try {
                const shouldForceRefresh = planReloadTick > 0
                const currentContext = {
                    jobDirection,
                    positionTypeLabel,
                    defaults: planDefaults,
                    hasResume: Boolean(resumeId),
                }

                if (!shouldForceRefresh) {
                    const existingResp = await fetch('/api/copilot', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    const existingData = await existingResp.json().catch(() => ({}))
                    if (existingResp.ok && existingData?.plan && isStoredPlanReusable(existingData.plan, currentContext) && mounted) {
                        setPlanData(existingData.plan)
                        onStatusChange('ready')
                        return
                    }
                }

                if (resumeId) {
                    await fetch('/api/copilot', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            action: 'extract-resume',
                            resumeId
                        })
                    }).catch(() => null)
                }

                const assessResp = await fetch('/api/copilot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        action: 'assess',
                        goal: positionType,
                        timeline: mapPreparationTimelineToApi(planDefaults.preparationTime),
                        forceRefresh: shouldForceRefresh,
                        background: {
                            industry: jobDirection,
                            availability: planDefaults.weeklyHours,
                            education: planDefaults.education,
                            language: planDefaults.language,
                            preparationTime: planDefaults.preparationTime,
                            positionTypeLabel,
                        }
                    })
                })
                const assessData = await assessResp.json().catch(() => ({}))

                const planResp = await fetch('/api/copilot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        action: 'create-plan',
                        goal: positionType,
                        timeline: mapPreparationTimelineToApi(planDefaults.preparationTime),
                        forceRefresh: shouldForceRefresh,
                        background: {
                            industry: jobDirection,
                            availability: planDefaults.weeklyHours,
                            education: planDefaults.education,
                            language: planDefaults.language,
                            preparationTime: planDefaults.preparationTime,
                            positionTypeLabel,
                        }
                    })
                })
                const planResult = await planResp.json().catch(() => ({}))
                const nextPlan = planResult?.planData || planResult?.plan || null

                if (planResp.ok && nextPlan && mounted) {
                    setPlanData({
                        ...nextPlan,
                        readiness: assessData?.readinessData?.remote_readiness_score,
                        summary: nextPlan.summary || `AI 已根据你的岗位偏好生成专属求职规划，默认按 ${planDefaults.preparationTime}、每周 ${planDefaults.weeklyHours} 的投入节奏推进。`
                    })
                    onStatusChange('ready')
                    return
                }

                // 兼容旧版线上链路：直接走 legacy generate，确保方案落到 copilot_sessions 供个人中心读取
                const legacyResp = await fetch('/api/copilot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        goal: positionType,
                        timeline: mapPreparationTimelineToApi(planDefaults.preparationTime),
                        background: {
                            industry: jobDirection,
                            availability: planDefaults.weeklyHours,
                            education: planDefaults.education,
                            language: planDefaults.language,
                            preparationTime: planDefaults.preparationTime,
                            positionTypeLabel,
                        },
                        resumeId
                    })
                })
                const legacyData = await legacyResp.json().catch(() => ({}))
                if (legacyResp.ok && legacyData?.plan && mounted) {
                    setPlanData(legacyData.plan)
                    onStatusChange('ready')
                    return
                }

                const getResp = await fetch('/api/copilot', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const getData = await getResp.json().catch(() => ({}))
                if (getResp.ok && getData?.success && getData?.plan && mounted) {
                    setPlanData(getData.plan)
                    onStatusChange('ready')
                    return
                }
                if (mounted) {
                    setPlanData(null)
                    setPlanError('方案生成失败或未保存成功，请重试。')
                    onStatusChange('idle')
                }
            } catch {
                if (mounted) {
                    setPlanData(null)
                    setPlanError('加载求职方案失败，请重试。')
                    onStatusChange('idle')
                }
            } finally {
                if (mounted) setPlanLoading(false)
            }
        }
        loadPlan()
        return () => { mounted = false }
    }, [isAuthenticated, token, positionType, jobDirection, resumeId, planReloadTick, onStatusChange])

    useEffect(() => {
        if (visible) {
            backgroundNotifiedRef.current = false
            trackedPlanSuccessRef.current = false
            return
        }
        if (!planLoading && planData && !backgroundNotifiedRef.current) {
            backgroundNotifiedRef.current = true
            showSuccess('求职方案已生成', '方案已同步到个人中心，你可以稍后进入查看完整版本。')
            onDispose()
            return
        }
        if (!planLoading && planError && !backgroundNotifiedRef.current) {
            backgroundNotifiedRef.current = true
            showWarning('方案生成未完成', planError)
            onDispose()
        }
    }, [visible, planLoading, planData, planError, showSuccess, showWarning, onDispose])

    useEffect(() => {
        if (!planLoading && planData && !trackedPlanSuccessRef.current) {
            trackedPlanSuccessRef.current = true
            trackingService.track('copilot_plan_success', {
                page_key: 'home',
                module: 'copilot_plan_modal',
                source_key: 'home_hero',
                job_direction: jobDirection,
                position_type: positionType,
                has_resume: Boolean(resumeId),
            })
        }
    }, [planLoading, planData, jobDirection, positionType, resumeId])

    const handleModalClose = () => {
        if (planLoading && isAuthenticated) {
            showInfo('方案继续生成中', '预计 3-5 分钟完成，复杂情况下可能更久。你可以先去浏览岗位，生成完成后会自动提醒。')
            onClose()
            return
        }
        onClose()
        onDispose()
    }

    const guestPlan = {
        plan_version: 'copilot_plan_v3',
        defaults: {
            english_level: planDefaults.language,
            education_level: planDefaults.education,
            preparation_time: planDefaults.preparationTime,
            weekly_commitment: planDefaults.weeklyHours,
        },
        goal_context: {
            job_direction: jobDirection || '目标岗位方向',
            position_type: positionTypeLabel,
            has_resume: false,
        },
        readiness: 68,
        suitability: {
            level: 'prepare_more',
            headline: `可以开始尝试 ${jobDirection || '目标方向'}，但建议先补几项关键准备。`,
            summary: '当前预览版主要基于你的岗位偏好生成，用来帮助你先判断是否值得投入远程求职准备。登录并上传简历后，适配判断会更具体。',
            strengths: ['方向已经明确，便于快速建立岗位画像。'],
            risks: ['尚未结合真实工作背景，适配度判断偏保守。', '英语表达和英文面试能力需要进一步验证。'],
            action_focus: ['先登录并保存简历，再生成更贴合背景的完整方案。', '优先准备英文自我介绍与项目案例。'],
        },
        english_interview: {
            summary: '以下为预览版提纲。登录并上传简历后可生成 5 道更贴合你的问题。',
            question_limit: 3,
            member_maximum: 30,
            resume_personalized: false,
            questions: [
                { id: 'q1', question: 'Can you introduce yourself in one minute and explain why you want a remote role?', focus: '英文自我介绍', hint: '先讲当前角色，再讲转向远程岗位的原因。' },
                { id: 'q2', question: 'What project best shows your ability to work across teams?', focus: '项目经历', hint: '突出职责、协作对象和结果。' },
                { id: 'q3', question: 'How do you stay aligned with teammates when working remotely?', focus: '远程协作', hint: '强调异步沟通、文档和反馈节奏。' },
            ],
        },
    }

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && handleModalClose()}>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleModalClose} />
            <div className="relative w-full max-w-4xl max-h-[88vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                <div className="bg-indigo-600 text-white px-6 py-5 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">远程求职助手</h2>
                            <p className="text-indigo-100 text-xs">{isAuthenticated ? '你的求职方案' : '先看预览，登录解锁完整方案'}</p>
                        </div>
                    </div>
                    <button onClick={handleModalClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-contain flex-1 p-6 space-y-6">
                    {!isAuthenticated ? (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-bold text-indigo-900">登录获取完整方案</div>
                                <div className="text-xs text-indigo-700 mt-0.5">完整方案 + 更多推荐 + 更具体的建议</div>
                            </div>
                            <Link to="/login" onClick={onClose} className="px-4 py-2 bg-white text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors text-center">登录解锁</Link>
                        </div>
                    ) : null}

                    <div className="bg-white border border-indigo-100 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3 gap-3">
                            <div>
                                <div className="text-sm font-bold text-slate-900">默认参考项</div>
                                <div className="text-xs text-slate-500 mt-1">方案默认项</div>
                            </div>
                            {canCustomizeDefaults && (
                                <button
                                    type="button"
                                    onClick={() => setPlanReloadTick(v => v + 1)}
                                    disabled={planLoading}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                                >
                                    {planLoading ? '重新生成中...' : '按当前设置重新生成'}
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { key: 'language', label: '英语能力', options: PLAN_LANGUAGE_OPTIONS },
                                { key: 'education', label: '学历背景', options: PLAN_EDUCATION_OPTIONS },
                                { key: 'preparationTime', label: '预计准备时间', options: PLAN_TIMELINE_OPTIONS },
                                { key: 'weeklyHours', label: '每周可投入时间', options: PLAN_WEEKLY_HOUR_OPTIONS },
                            ].map((field) => (
                                <label key={field.key} className="block">
                                    <div className="text-[11px] font-medium text-slate-500 mb-1.5">{field.label}</div>
                                    <select
                                        value={planDefaults[field.key as keyof typeof planDefaults]}
                                        onChange={(e) => setPlanDefaults((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                        disabled={!canCustomizeDefaults}
                                        className={`w-full rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                                            canCustomizeDefaults
                                                ? 'border-slate-200 bg-white text-slate-800 focus:border-indigo-400 focus:outline-none'
                                                : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed'
                                        }`}
                                    >
                                        {field.options.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </label>
                            ))}
                        </div>
                        <div className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 mt-3">
                            {!isAuthenticated
                                ? '登录后生成完整方案'
                                : canCustomizeDefaults
                                    ? '可改默认项'
                                    : '会员可改默认项'}
                        </div>
                    </div>

                    {isAuthenticated ? (
                        isMember ? (
                            <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-100 rounded-2xl p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">会员能力已解锁</div>
                                        <div className="text-xs text-slate-600 mt-1">可继续完善方案和行动建议</div>
                                    </div>
                                    <Link to="/profile?tab=custom-plan" onClick={handleModalClose} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors no-underline hover:no-underline">去个人中心继续打磨</Link>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-bold text-slate-900">添加顾问了解后可继续完善方案</div>
                                    <div className="text-xs text-slate-600 mt-1">会员可修改默认项，并获得更完整的建议</div>
                                </div>
                                <Link to="/profile?tab=membership#club-service-plans" onClick={handleModalClose} className="px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors text-center no-underline hover:no-underline">查看权益方案</Link>
                            </div>
                        )
                    ) : null}

                    {planLoading && isAuthenticated ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                <span className="font-medium text-slate-700">方案生成中</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                                约 3-5 分钟，复杂情况更久。
                            </div>
                            <button
                                type="button"
                                onClick={handleModalClose}
                                className="mt-4 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                            >
                                先去看岗位
                            </button>
                        </div>
                    ) : (isAuthenticated && !planData) ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6">
                            <div className="text-sm font-semibold text-rose-700">{planError || '暂未拿到可用方案数据。'}</div>
                            <button
                                type="button"
                                onClick={() => setPlanReloadTick(v => v + 1)}
                                className="mt-3 px-4 py-2 rounded-lg border border-rose-200 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-100 transition-colors"
                            >
                                重新生成并保存
                            </button>
                        </div>
                    ) : (
                        <Suspense fallback={<div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm font-semibold text-slate-500">方案加载中...</div>}>
                            <LazyGeneratedPlanView
                                plan={normalizePlanForView(isAuthenticated ? planData : guestPlan)}
                                isGuest={!isAuthenticated}
                                openInNewTab
                                showProfileCta={isAuthenticated}
                                showSavedHint={isAuthenticated}
                            />
                        </Suspense>
                    )}
                </div>
            </div>
        </div>
    )
}
