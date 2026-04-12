import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react'
import {
    Sparkles, Target, Briefcase, Loader2, X, UploadCloud,
    ChevronLeft, ChevronRight, MapPin, DollarSign, Building2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import JobTickerItem from './JobTickerItem'
import GeneratedPlanView from './GeneratedPlanView'
import JobDetailModal from './JobDetailModal'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { stripMarkdown } from '../utils/text-formatter'
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
const HERO_REFRESH_INTERVAL = 24 * 60 * 60 * 1000
const HERO_CACHE_TTL = HERO_REFRESH_INTERVAL
const HERO_RESUME_STATE_KEY = 'copilot_hero_resume_state_v1'
const HERO_PLAN_STATUS_KEY = 'copilot_plan_status_v1'

// Sample data from public remote job listings for local preview.
const SAMPLE_RECOMMENDATIONS = [
    {
        id: 'remotive-clickhouse-pm',
        title: 'Senior Product Manager, ClickHouse Cloud',
        company_name: 'ClickHouse',
        company_logo: 'https://logo.clearbit.com/clickhouse.com',
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
        company_logo: 'https://logo.clearbit.com/metrostar.com',
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
        company_logo: 'https://logo.clearbit.com/moneygram.com',
        location: 'USA (Remote)',
        timezone: 'US time zones',
        salary: '$130k - $185k USD',
        matchScore: 87,
        company_intro: 'MoneyGram 是全球汇款和支付领域的百年品牌，业务覆盖 200+ 国家，正积极推进数字化和区块链转型，数据团队在全球分布式协作。'
    },
    {
        id: 'remotive-pexa-ux',
        title: 'UX Designer',
        company_name: 'PEXA Group',
        company_logo: 'https://logo.clearbit.com/pexa.com',
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
        company_logo: 'https://logo.clearbit.com/clickhouse.com',
        location: 'USA (Remote)',
        timezone: 'US time zones',
        salary: '$145k - $225k USD',
        company_intro: '主导云数据平台产品路线，跨研发与客户团队协作，面向全球远程团队。'
    },
    {
        id: 'preview-gitlab-growth-pm',
        title: 'Senior Product Manager, Growth',
        company_name: 'GitLab',
        company_logo: 'https://logo.clearbit.com/gitlab.com',
        location: 'Global (Remote)',
        timezone: 'EU/US overlap',
        salary: '$135k - $205k USD',
        company_intro: '负责增长漏斗与转化策略，驱动 PLG 关键指标，支持多时区远程协作。'
    },
    {
        id: 'preview-zapier-ai-pm',
        title: 'Product Manager, AI Platform',
        company_name: 'Zapier',
        company_logo: 'https://logo.clearbit.com/zapier.com',
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
}

function extractHost(input?: string) {
    if (!input) return ''
    try {
        const normalized = input.startsWith('http') ? input : `https://${input}`
        return new URL(normalized).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

function resolveLogoCandidates(logo?: string, company?: string, website?: string) {
    const host = extractHost(website)
    const first = logo ? [logo] : []
    const fromWebsite = host ? [`https://logo.clearbit.com/${host}`] : []
    const fallback = company ? [`https://ui-avatars.com/api/?name=${encodeURIComponent(company)}&background=EEF2FF&color=4F46E5&size=96&bold=true&format=png`] : []
    return [...first, ...fromWebsite, ...fallback]
}

function getHeroCacheKey(userId?: string | null) {
    return userId ? `${HERO_CACHE_KEY}_${userId}` : HERO_CACHE_KEY
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
    if (!rawSalary) return '薪资Open'
    if (typeof rawSalary === 'string') {
        const normalized = rawSalary.trim()
        if (!normalized || normalized === '0' || normalized === 'null' || normalized === 'Open' || normalized === '0-0' || normalized === 'Competitive' || normalized === 'Unspecified') {
            return '薪资Open'
        }
        return normalized
    }
    if (typeof rawSalary === 'object' && rawSalary) {
        const min = Number(rawSalary.min || 0)
        const max = Number(rawSalary.max || 0)
        if (!min && !max) return '薪资Open'
    }
    return rawSalary
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

function normalizePlanCompareText(value?: string) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
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
        <div className="relative group bg-white border-2 border-slate-100 rounded-2xl transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-200 h-[72px]">
            <div className="absolute left-4 top-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide pointer-events-none select-none">
                {label} <span className="text-rose-500">*</span>
            </div>
            <Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
            
            {options ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-full pl-4 pr-12 pt-6 pb-2 bg-transparent border-none outline-none text-sm font-bold text-slate-800 appearance-none cursor-pointer"
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
                    className="w-full h-full pl-4 pr-12 pt-6 pb-2 bg-transparent border-none outline-none text-sm font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-300"
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

export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { user, isAuthenticated, token, isMember, updateProfile, isLoading: authLoading } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()
    const userId = user?.user_id || null
    const storedTargetRole = String(user?.profile?.targetRole || '').trim()

    // Background Parallax State
    const [bgPosition] = useState({ x: 50, y: 50 })

    // Form State
    const [jobDirection, setJobDirection] = useState('')
    const [positionType, setPositionType] = useState('full-time')
    const [resumeId, setResumeId] = useState<string | null>(null)
    const [resumeName, setResumeName] = useState<string | null>(null)
    const [guestResumeFile, setGuestResumeFile] = useState<File | null>(null)
    const [guestResumeHints, setGuestResumeHints] = useState<string[]>([])
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
    const [previewJobs, setPreviewJobs] = useState<any[]>([])
    const autoRefreshedAfterLogin = useRef(false)
    const pendingResumeSyncAttempted = useRef(false)
    const accountHeroHydratedForUser = useRef<string | null>(null)
    const displayRecommendations = hasResults && recommendations.length > 0
        ? (isAuthenticated ? recommendations : recommendations.slice(0, 1))
        : SAMPLE_RECOMMENDATIONS
    const dailyLimit = isAuthenticated ? 5 : 1
    const positionTypeLabel = positionType === 'full-time'
        ? '全职远程'
        : positionType === 'contract'
            ? '合同/兼职'
            : positionType === 'freelance'
                ? '自由职业'
                : '实习'
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
        const company = job?.company_name || job?.company || 'Company'
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
            translations: job?.translations || null,
            companyTranslations: job?.companyTranslations || job?.company_translations || null,
            companyId: job?.companyId || job?.company_id,
            logo: job?.logo || job?.company_logo || '',
            company_logo: job?.logo || job?.company_logo || '',
            company_website: job?.companyWebsite || job?.company_website || '',
            companyWebsite: job?.companyWebsite || job?.company_website || '',
            url: job?.url || job?.sourceUrl || '',
            sourceUrl: job?.sourceUrl || job?.url || '',
            source: job?.source || 'hero',
            publishedAt: job?.publishedAt || job?.published_at || '',
            createdAt: job?.createdAt || job?.created_at || '',
            logo_candidates: job?.logo_candidates || resolveLogoCandidates(job?.logo || job?.company_logo, company, job?.companyWebsite || job?.company_website),
        }
    }
    const heroDetailJobs = useMemo(
        () => displayRecommendations.map((job) => normalizeHeroJob(job)),
        [displayRecommendations]
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
            skipAggregations: 'true',
            _t: Date.now().toString()
        }

        const requestDetail = async (url: string) => {
            const resp = await fetch(url, {
                cache: 'no-store',
                headers: {
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    'cache-control': 'no-cache'
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
        const payload = { jobDirection, positionType, recommendations, hasResults, lastUpdatedAt, timestamp: Date.now() }
        localStorage.setItem(getHeroCacheKey(userId), JSON.stringify(payload))
    }, [jobDirection, positionType, recommendations, hasResults, hasHydrated, lastUpdatedAt, userId, authLoading, isAuthenticated])

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
            autoRefreshedAfterLogin.current = false
        }
    }, [isAuthenticated])

    useEffect(() => {
        autoRefreshedAfterLogin.current = false
    }, [userId])

    useEffect(() => {
        let mounted = true
        const loadTickerJobs = async () => {
            try {
                const fetchLatestJobs = async () => {
                    const baseParams = {
                        page: '1',
                        limit: '120',
                        sortBy: 'recent',
                        skipAggregations: 'true',
                        _t: `${Date.now()}`
                    }

                    const directParams = new URLSearchParams(baseParams)
                    let resp = await fetch(`/api/data/processed-jobs?${directParams.toString()}`, {
                        cache: 'no-store',
                        headers: { 'cache-control': 'no-cache' }
                    })
                    let data = await resp.json().catch(() => ({}))

                    if (!resp.ok || !Array.isArray(data.jobs)) {
                        const fallbackParams = new URLSearchParams({
                            resource: 'processed-jobs',
                            ...baseParams
                        })
                        resp = await fetch(`/api/data?${fallbackParams.toString()}`, {
                            cache: 'no-store',
                            headers: { 'cache-control': 'no-cache' }
                        })
                        data = await resp.json().catch(() => ({}))
                    }

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
        loadTickerJobs()
        return () => { mounted = false }
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
                try {
                    const parsed = await parseResumeFileEnhanced(file)
                    parsedHints = extractParsedResumeHints(parsed)
                } catch {
                    parsedHints = []
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
            showSuccess('简历上传成功', '岗位列表匹配度会在下次进入时自动刷新')
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
    }) => {
        const nextJobDirection = String(options?.direction ?? jobDirection).trim()
        const nextPositionType = String(options?.position ?? positionType).trim() || 'full-time'

        if (!nextJobDirection) {
            showWarning('信息不足', '请填写职业方向')
            return
        }

        setLoading(true)
        localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection: nextJobDirection, positionType: nextPositionType, timestamp: Date.now() }))
        trackingService.track('copilot_hero_submit', {
            page_key: 'home',
            module: 'copilot_hero',
            source_key: 'home_hero',
            job_direction: nextJobDirection,
            position_type: nextPositionType,
            has_resume: Boolean(resumeId || guestResumeFile),
            is_authenticated: isAuthenticated,
        })

        try {
            const authToken = localStorage.getItem('haigoo_auth_token') || token
            let parsedResumeHints = guestResumeHints
            if (!authToken && guestResumeFile && parsedResumeHints.length === 0) {
                const parsed = await parseResumeFileEnhanced(guestResumeFile)
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
                    jobDirection: nextJobDirection,
                    positionType: nextPositionType,
                    resumeId,
                    resumeHints: authToken ? undefined : parsedResumeHints,
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
            trackingService.track('copilot_hero_success', {
                page_key: 'home',
                module: 'copilot_hero',
                source_key: 'home_hero',
                job_direction: nextJobDirection,
                position_type: nextPositionType,
                has_resume: Boolean(resumeId || guestResumeFile),
                result_count: capped.length,
            })
            if (jobDirection !== nextJobDirection) setJobDirection(nextJobDirection)
            if (positionType !== nextPositionType) setPositionType(nextPositionType)
            setRecommendations(capped)
            setActiveCard(0)
            setHasResults(true)
            setIsEditingPreferences(false)
            setLastUpdatedAt(Date.now())
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
        if (!hasHydrated || !isAuthenticated || autoRefreshedAfterLogin.current) return
        if (loading) return
        if (isEditingPreferences) return

        const effectiveDirection = String(jobDirection || storedTargetRole || '').trim()
        if (!effectiveDirection) return

        const directionMatchesProfile = !storedTargetRole || normalizePlanCompareText(jobDirection || storedTargetRole) === normalizePlanCompareText(storedTargetRole)
        const cacheIsFresh = Boolean(lastUpdatedAt) && (Date.now() - lastUpdatedAt) < HERO_REFRESH_INTERVAL
        const shouldRefresh = directionMatchesProfile && (!hasResults || recommendations.length === 0 || recommendations.length < dailyLimit || !cacheIsFresh)

        if (!shouldRefresh) return

        autoRefreshedAfterLogin.current = true
        void handleGetRecommendations({
            direction: effectiveDirection,
            position: positionType,
            silent: true,
            skipProfileSync: true
        })
    }, [hasHydrated, isAuthenticated, loading, isEditingPreferences, jobDirection, storedTargetRole, hasResults, recommendations.length, lastUpdatedAt, positionType, dailyLimit])

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

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-50 pt-32 pb-20">
            {/* ── Background ── */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-slate-50">
                <div className="absolute inset-0 w-full h-full overflow-hidden">
                    <img
                        src="/background.webp?v=2"
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover opacity-90"
                        style={{ transform: `translate(${bgPosition.x - 50}px, ${bgPosition.y - 50}px)` }}
                    />
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-slate-50" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20" />
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-slate-50 via-slate-50/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent" />
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                
                {/* ── Hero Text ── */}
                <div className="text-center mb-10 w-full max-w-[1500px] mx-auto">
                    <h1 className="text-5xl md:text-[68px] xl:text-[76px] font-extrabold text-slate-900 mb-5 leading-tight tracking-tight drop-shadow-sm lg:whitespace-nowrap">
                        Haigoo 帮你获得
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-blue-500">
                            理想的远程工作
                        </span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 max-w-3xl mx-auto font-medium">
                        我们帮你筛出适合国内用户申请的靠谱岗位，
                        更为你找到了岗位 HR / 负责人等联系方式，让申请更高效和安心。
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                        {['✓ 更适合国内用户申请', '✓ 所有岗位均经过人工筛选', '✓ 部分岗位可直连招聘方', '✓ 上传简历可获取每日推荐'].map((chip) => (
                            <span key={chip} className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white/80 backdrop-blur-md border border-white/50 rounded-full shadow-sm">
                                {chip}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Marquee ── */}
                {tickerJobs.length > 0 && (
                    <div className="w-full max-w-5xl mx-auto mt-4 mb-4 overflow-hidden rounded-full opacity-90 hover:opacity-100 transition-opacity [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] relative h-[56px]">
                        <div 
                            className="hero-marquee-track absolute top-0 left-0 pointer-events-none"
                            style={{
                                '--marquee-duration': `${Math.max(36, tickerJobs.length * 8)}s`,
                                '--marquee-shift': `calc(-100% / ${Math.max(1, tickerRepeatCount)})`
                            } as CSSProperties}
                        >
                            {tickerLoop.map((job, i) => (
                                <div
                                    key={`${job.id}-${i}`}
                                    className="pointer-events-auto"
                                    aria-hidden={i >= tickerJobs.length}
                                >
                                    <JobTickerItem job={job} onOpen={openTickerJobDetail} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Copilot Card ── */}
                <div className="w-full max-w-5xl bg-white/30 backdrop-blur-md border border-white/20 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1),_0_0_0_1px_rgba(255,255,255,0.2)] p-3 md:p-4 mt-4 relative lg:h-[640px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none rounded-[32px]" />
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f) }} />

                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 h-full">

                        {/* ── Left Column ── */}
                        <div className={`lg:col-span-5 backdrop-blur-xl rounded-[24px] border p-4 flex flex-col gap-3 h-full transition-all ${
                            hasResults
                                ? 'bg-white/60 border-white/40 shadow-sm'
                                : 'bg-white/82 border-indigo-100 shadow-[0_24px_48px_-32px_rgba(79,70,229,0.35)]'
                        }`}>
                            {/* Shared title area with logo */}
                            <div className="mb-1">
                                <div>
                                    <h2 className="text-[34px] md:text-[38px] font-bold text-slate-900 leading-[1.1] tracking-tight">看看今天有哪些<br/>适合你的岗位</h2>
                                    {hasResults && (
                                        <p className="text-xs text-slate-500 mt-1.5">今日推荐岗位已于 {formattedUpdatedAt} 更新</p>
                                    )}
                                </div>
                            </div>

                            {!hasResults ? (
                                <div className="flex flex-col gap-3 h-full">
                                    <InputCard label="职业方向 JOB DIRECTION" icon={Target} value={jobDirection}
                                        onChange={(val) => { setJobDirection(val); localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection: val, positionType, timestamp: Date.now() })) }}
                                        placeholder="如：产品经理 / 数据分析 / 前端开发" />
                                    <InputCard label="职位类型 POSITION TYPE" icon={Briefcase} value={positionType}
                                        onChange={(val) => { setPositionType(val); localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection, positionType: val, timestamp: Date.now() })) }}
                                        options={[
                                            { value: 'full-time', label: '全职远程 (Full-time)' },
                                            { value: 'contract', label: '合同/兼职 (Contract)' },
                                            { value: 'freelance', label: '自由职业 (Freelance)' },
                                            { value: 'internship', label: '实习 (Internship)' },
                                        ]} />
                                    <div
                                        className={`border-2 border-dashed rounded-2xl p-3.5 text-center transition-all ${
                                            resumeName ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
                                        }`}
                                        onClick={() => {
                                            if (resumeName) return
                                            if (!privacyAccepted) {
                                                showWarning('请同意隐私协议', '上传前请阅读并同意简历隐私使用说明')
                                                setHighlightPrivacyConsent(true)
                                                privacyConsentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
                                                showWarning('请同意隐私协议', '上传前请阅读并同意简历隐私使用说明')
                                                setHighlightPrivacyConsent(true)
                                                privacyConsentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                return
                                            }
                                            const f = e.dataTransfer.files?.[0]
                                            if (f) handleResumeUpload(f)
                                        }}
                                    >
                                        {uploading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                                <span className="text-sm text-indigo-600">上传中...</span>
                                            </div>
                                        ) : resumeName ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-sm font-semibold text-indigo-700 truncate max-w-[220px]">{resumeName}</span>
                                                    <button onClick={e => { e.stopPropagation(); handleRemoveResume() }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <p className="text-[10px] text-slate-500">已关联简历。若需更换，请先手动删除后重新上传。</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-center gap-2 mb-1">
                                                    <UploadCloud className="w-5 h-5 text-indigo-400" />
                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100">简历可选</span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-600">拖拽简历到此 / 点击上传</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">PDF / Word 格式，用于后续规划补充参考</p>
                                            </>
                                        )}
                                    </div>
                                    <label
                                        ref={privacyConsentRef}
                                        className={`flex items-start gap-2 cursor-pointer select-none rounded-xl transition-all ${
                                            highlightPrivacyConsent ? 'ring-2 ring-amber-300 bg-amber-50/70 px-2 py-2 -mx-2' : ''
                                        }`}
                                    >
                                        <input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} className="mt-0.5 accent-indigo-600 w-3.5 h-3.5" />
                                        <span className="text-[11px] text-slate-500 leading-relaxed">
                                            我已阅读并同意{' '}<a href="/privacy" target="_blank" className="text-indigo-500 underline">简历隐私使用说明</a>，Haigoo 仅将简历用于岗位匹配分析
                                        </span>
                                    </label>
                                    <button onClick={() => { void handleGetRecommendations() }} disabled={loading || !jobDirection}
                                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-[0_8px_20px_rgba(79,70,229,0.30)] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        {loading ? '获取中...' : '查看今日推荐'}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 flex-1">
                                    {/* Quota card */}
                                    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">AI</div>
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">每日推荐数量</div>
                                        </div>
                                        <div className="text-[54px] font-black text-slate-900 leading-none">{Math.min(recommendations.length || 1, dailyLimit)}<span className="text-slate-300">/{dailyLimit}</span></div>
                                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                            {isAuthenticated
                                                ? '今日推荐已更新，可继续浏览 5 个精选岗位。'
                                                : '游客模式每日可获得 1 个推荐，登录后每日 5 个。'}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">当前偏好</div>
                                            <button onClick={() => { setIsEditingPreferences(true); setHasResults(false); setActiveCard(0) }} className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">修改偏好</button>
                                        </div>
                                        <div className="text-sm font-semibold text-indigo-600 truncate">{jobDirection || '未填写'} · {positionTypeLabel}</div>
                                    </div>
                                    <div className="h-[52px] mt-auto flex items-center justify-center">
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Right Column ── */}
                        <div className={`lg:col-span-7 backdrop-blur-2xl rounded-[24px] border border-white/50 flex flex-col shadow-sm overflow-hidden h-full ${
                            hasResults ? 'bg-white/50' : 'bg-white/30'
                        }`}>
                            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                                <h3 className={`${hasResults ? 'text-[24px]' : 'text-[20px]'} font-bold text-slate-800 leading-none`}>{hasResults ? '今日推荐' : '每日推荐预览'}</h3>
                                {hasResults && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setActiveCard(prev => Math.max(0, prev - 1))} disabled={activeCard === 0}
                                            className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-indigo-100 transition-colors">
                                            <ChevronLeft className="w-4 h-4 text-indigo-700" />
                                        </button>
                                        <span className="text-xs text-slate-500 font-semibold">{activeCard + 1} / {displayRecommendations.length}</span>
                                        <button onClick={() => setActiveCard(prev => Math.min(displayRecommendations.length - 1, prev + 1))} disabled={activeCard >= displayRecommendations.length - 1}
                                            className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-indigo-100 transition-colors">
                                            <ChevronRight className="w-4 h-4 text-indigo-700" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 px-5 pt-5 pb-4 flex flex-col min-h-0">
                                {!hasResults ? (
                                    <div className="flex-1 flex flex-col gap-4 relative min-h-0 overflow-hidden rounded-[28px] border border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.4)_0%,rgba(243,244,255,0.72)_100%)]">
                                        <div className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.08),transparent_36%)]" />
                                        <div className="relative z-0 select-none pointer-events-none filter blur-[10px] saturate-[0.82] opacity-52 px-4 pt-4 pb-5">
                                            {(previewDisplayJobs.length > 0 ? previewDisplayJobs : PREVIEW_PM_RECOMMENDATIONS).map((job, idx, arr) => (
                                                <div key={job.id} className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 opacity-60">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                            <CompanyLogo companyName={job.company_name} logoCandidates={job.logo_candidates || resolveLogoCandidates(job.company_logo, job.company_name, job.company_website)} className="w-full h-full object-contain p-1.5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="font-bold text-slate-900 text-[15px] leading-tight">{job.title}</div>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">Top Pick</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                                <span className="font-semibold text-slate-600">{job.company_name}</span>
                                                                <span>•</span>
                                                                <span>{job.location}</span>
                                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-semibold">Remote</span>
                                                            </div>
                                                            <div className="text-sm text-indigo-600 font-semibold mt-1">{job.salary}</div>
                                                        </div>
                                                    </div>
                                                    {idx < arr.length - 1 && (
                                                        <div className="mt-3 border-t border-slate-100" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-b from-white/34 via-white/70 to-[#f6f8ff]/94 backdrop-blur-[2px]" />
                                        <div className="absolute inset-0 z-[3] pointer-events-none flex items-center justify-center px-6">
                                            <div className="w-full max-w-[290px] rounded-2xl border border-white/90 bg-white/56 backdrop-blur-md shadow-[0_8px_24px_-20px_rgba(79,70,229,0.34)] px-4 py-3 text-center">
                                                <p className="text-[18px] sm:text-[19px] font-semibold leading-tight tracking-tight text-slate-700">解锁你的专属推荐</p>
                                                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                                                    <span className="inline-flex items-center rounded-full border border-white/90 bg-white/84 px-2.5 py-1 text-[10px] font-medium text-slate-500">游客每日 1 个推荐</span>
                                                    <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50/82 px-2.5 py-1 text-[10px] font-medium text-indigo-600">登录后每日 5 个推荐</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    (() => {
                                        const job = normalizeHeroJob(displayRecommendations[activeCard] || displayRecommendations[0])
                                        const title = job?.translations?.title || job?.title || job?.role || '远程岗位'
                                        const company = job?.company_name || job?.company || 'Company'
                                        const location = job?.translations?.location || job?.location || job?.remote_location || '远程'
                                        const timezone = job?.timezone || job?.remote_timezone || ''
                                        const salary = getHeroDisplaySalary(job?.salary || job?.salary_range)
                                        const translatedDetail = cleanHeroRichText(job?.translations?.description || '')
                                        const canonicalCompanyIntro = cleanHeroRichText(job?.companyDescription || job?.company_intro || '')
                                        const translatedCompanyIntro = cleanHeroRichText(job?.companyTranslations?.description || '')
                                        const companyIntro = canonicalCompanyIntro || translatedCompanyIntro || cleanHeroRichText(job?.description || '')
                                        const detail = translatedDetail || cleanHeroRichText(job?.description || '') || companyIntro || '点击查看完整岗位详情'
                                        const openJobDetail = () => openHeroJobDetail({ ...job, source: 'hero_copilot' })
                                        return (
                                            <div className="flex-1 min-h-0 flex flex-col relative">
                                                <div className="absolute inset-x-4 top-2 bottom-0 rounded-2xl border border-indigo-50 bg-white shadow-sm" />
                                                <div className="absolute inset-x-8 top-4 bottom-0 rounded-2xl border border-indigo-50 bg-white shadow-sm" />
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={openJobDetail}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault()
                                                            openJobDetail()
                                                        }
                                                    }}
                                                    onTouchStart={(e) => { touchStartXRef.current = e.changedTouches[0].clientX }}
                                                    onTouchEnd={(e) => {
                                                        if (touchStartXRef.current === null) return
                                                        const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
                                                        if (Math.abs(deltaX) > 40) {
                                                            if (deltaX < 0) setActiveCard(prev => Math.min(displayRecommendations.length - 1, prev + 1))
                                                            if (deltaX > 0) setActiveCard(prev => Math.max(0, prev - 1))
                                                        }
                                                        touchStartXRef.current = null
                                                    }}
                                                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1 h-[420px] relative z-10 text-left hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col"
                                                >
                                                    <h4 className="text-[30px] font-bold text-slate-900 mb-3 leading-[1.12] line-clamp-2">{title}</h4>
                                                    <div className="flex flex-col gap-1.5 mb-4">
                                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                                            <Building2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                            <span className="font-semibold text-indigo-600">{company}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                                            <MapPin className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                            <span>{location}{timezone ? `，${timezone}` : ''}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                                            <DollarSign className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                                            <span>{salary}</span>
                                                        </div>
                                                    </div>

                                                    {/* Company Intro */}
                                                    <div className="mb-3">
                                                        <div className="text-xs font-bold text-slate-500 mb-1.5">企业介绍</div>
                                                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{companyIntro || '点击查看详情，查看完整企业介绍。'}</p>
                                                    </div>
                                                    <div className="relative flex-1 overflow-hidden">
                                                        <div className="text-xs font-bold text-slate-500 mb-1.5">岗位详情</div>
                                                        <p className="text-sm text-slate-500 leading-relaxed">{detail}</p>
                                                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
                                                    </div>
                                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
                                                        {!isAuthenticated ? (
                                                            <div className="text-[11px] leading-5 text-slate-500 inline-flex items-center gap-1.5">
                                                                <span>登录后可继续浏览更多推荐。</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        navigate('/login')
                                                                    }}
                                                                    className="text-indigo-600 font-semibold underline underline-offset-2 hover:text-indigo-700 transition-colors"
                                                                >
                                                                    去登录
                                                                </button>
                                                            </div>
                                                        ) : <span />}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                openJobDetail()
                                                            }}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-600 shadow-sm whitespace-nowrap hover:bg-indigo-100 transition-colors"
                                                        >
                                                            查看详情
                                                            <span>→</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })()
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* ── Copilot Plan Modal ── */}
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
            <JobDetailModal
                job={selectedJobDetail}
                isOpen={Boolean(selectedJobDetail)}
                onClose={() => setSelectedJobDetail(null)}
                variant="center"
                jobs={heroDetailJobs}
                currentJobIndex={currentHeroJobIndex}
                onNavigateJob={(direction) => {
                    if (!heroDetailJobs.length || currentHeroJobIndex < 0) return
                    const nextIndex = direction === 'prev'
                        ? Math.max(0, currentHeroJobIndex - 1)
                        : Math.min(heroDetailJobs.length - 1, currentHeroJobIndex + 1)
                    const nextJob = heroDetailJobs[nextIndex]
                    if (nextJob) {
                        openHeroJobDetail(nextJob)
                    }
                }}
            />
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
                                    <div className="text-sm font-bold text-slate-900">开通会员可继续完善方案</div>
                                    <div className="text-xs text-slate-600 mt-1">会员可修改默认项，并获得更完整的建议</div>
                                </div>
                                <Link to="/membership" onClick={handleModalClose} className="px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors text-center no-underline hover:no-underline">查看会员方案</Link>
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
                        <GeneratedPlanView
                            plan={normalizePlanForView(isAuthenticated ? planData : guestPlan)}
                            isGuest={!isAuthenticated}
                            openInNewTab
                            showProfileCta={isAuthenticated}
                            showSavedHint={isAuthenticated}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
