import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useRef, type CSSProperties } from 'react'
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
import {
    readPendingGuestResume,
    savePendingGuestResume,
    clearPendingGuestResume,
    hydrateGuestResumeFile,
    claimPendingGuestResume,
} from '../services/guest-resume-bridge'

const HERO_CACHE_KEY = 'copilot_hero_state_v2'
const HERO_CACHE_TTL = 6 * 60 * 60 * 1000

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

export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated, token, isMember } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()

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
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    // Process State
    const [loading, setLoading] = useState(false)
    const [recommendations, setRecommendations] = useState<any[]>([])
    const [hasResults, setHasResults] = useState(false)
    const [hasHydrated, setHasHydrated] = useState(false)
    const [showPlanModal, setShowPlanModal] = useState(false)
    const [activeCard, setActiveCard] = useState(0)
    const touchStartXRef = useRef<number | null>(null)
    const [selectedJobDetail, setSelectedJobDetail] = useState<any | null>(null)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now())
    const [previewJobs, setPreviewJobs] = useState<any[]>([])
    const autoRefreshedAfterLogin = useRef(false)
    const pendingResumeSyncAttempted = useRef(false)
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
    const tickerLoop = [...tickerJobs, ...tickerJobs]

    // Load saved form data from local storage for guest/returning users
    useEffect(() => {
        const cached = localStorage.getItem(HERO_CACHE_KEY)
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
                    } else if (data.hasResults) {
                        setHasResults(true)
                    }
                }
            } catch (e) {
                // ignore
            }
        }
        const saved = localStorage.getItem('copilot_guest_cache')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                if (Date.now() - data.timestamp < 10 * 60 * 1000) {
                    if (data.jobDirection) setJobDirection(data.jobDirection)
                    if (data.positionType) setPositionType(data.positionType)
                }
            } catch (e) {
                // ignore
            }
        }
        const pendingGuestResume = readPendingGuestResume()
        if (pendingGuestResume) {
            setResumeId('guest-temp-id')
            setResumeName(pendingGuestResume.fileName)
            setGuestResumeHints(Array.isArray(pendingGuestResume.resumeHints) ? pendingGuestResume.resumeHints : [])
            setGuestResumeFile(hydrateGuestResumeFile(pendingGuestResume))
        }
        setHasHydrated(true)
    }, [])

    useEffect(() => {
        if (!hasHydrated) return
        const payload = { jobDirection, positionType, recommendations, hasResults, lastUpdatedAt, timestamp: Date.now() }
        localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(payload))
    }, [jobDirection, positionType, recommendations, hasResults, hasHydrated, lastUpdatedAt])

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
        }
    }, [isAuthenticated])

    useEffect(() => {
        let mounted = true
        const loadTickerJobs = async () => {
            try {
                const fetchWindowJobs = async (days: number) => {
                    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
                    const params = new URLSearchParams({
                        resource: 'processed-jobs',
                        page: '1',
                        limit: '60',
                        sortBy: 'recent',
                        dateFrom,
                        _t: Date.now().toString()
                    })
                    const resp = await fetch(`/api/data?${params.toString()}`)
                    const data = await resp.json().catch(() => ({}))
                    if (!resp.ok || !Array.isArray(data.jobs)) return []
                    return data.jobs
                }

                const dedupedRaw = new Map<string, any>()
                for (const windowDays of TICKER_RECENT_WINDOWS) {
                    const jobs = await fetchWindowJobs(windowDays)
                    jobs.forEach((j: any) => {
                        const id = String(j?.id || j?.job_id || '')
                        if (id && !dedupedRaw.has(id)) dedupedRaw.set(id, j)
                    })
                    if (dedupedRaw.size >= TICKER_TARGET_MAX) break
                }

                const normalizedTicker = Array.from(dedupedRaw.values())
                    .filter((j: any) => j?.title && (j?.company || j?.company_name))
                    .map((j: any) => {
                        const companyName = j.company || j.company_name
                        return {
                            id: j.id || j.job_id,
                            title: j.title,
                            company_name: companyName,
                            company_logo: j.logo || '',
                            logo_candidates: resolveLogoCandidates(j.logo, companyName, j.companyWebsite || j.company_website),
                            salary: j.salary || '薪资面议'
                        }
                    })
                if (normalizedTicker.length < TICKER_TARGET_MIN) {
                    console.warn(`[Hero] ticker jobs less than expected: ${normalizedTicker.length}/${TICKER_TARGET_MIN}`)
                }

                const dispersedTicker = spreadByCompany(normalizedTicker, 5).slice(0, TICKER_TARGET_MAX)
                if (mounted && dispersedTicker.length > 0) {
                    setTickerJobs(dispersedTicker)
                    const pmPreview = Array.from(dedupedRaw.values())
                        .filter((j: any) => {
                            const companyName = j.company || j.company_name || ''
                            return j?.title && companyName && /product|pm|产品/i.test(`${j.title} ${companyName}`)
                        })
                        .map((j: any) => {
                            const companyName = j.company || j.company_name
                            return {
                                id: j.id || j.job_id,
                                title: j.title,
                                company_name: companyName,
                                company_logo: j.logo || '',
                                logo_candidates: resolveLogoCandidates(j.logo, companyName, j.companyWebsite || j.company_website),
                                location: j.location || 'Remote',
                                salary: j.salary || '薪资面议',
                                company_intro: j.companyDescription || j.description || ''
                            }
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
            showSuccess('简历上传成功', '已准备好进行精准匹配')
        } catch (error: any) {
            showError('上传失败', error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleGetRecommendations = async () => {
        if (!jobDirection) {
            showWarning('信息不足', '请填写职业方向')
            return
        }
        setLoading(true)
        localStorage.setItem('copilot_guest_cache', JSON.stringify({ jobDirection, positionType, timestamp: Date.now() }))

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
                    jobDirection,
                    positionType,
                    resumeId,
                    resumeHints: authToken ? undefined : parsedResumeHints,
                    limit: dailyLimit
                })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !Array.isArray(data.matches)) {
                throw new Error(data.error || '获取推荐失败')
            }
            const normalized = data.matches.map((j: any) => ({
                id: j.jobId || j.id,
                title: j.title,
                company_name: j.company_name || j.company,
                company: j.company_name || j.company,
                location: j.location || 'Remote',
                timezone: j.timezone || '',
                salary: j.salary || '薪酬面议',
                company_intro: j.companyIntro || j.company_intro || '',
                description: j.description || '',
                company_logo: j.logo || '',
                company_website: j.companyWebsite || j.company_website,
                logo_candidates: resolveLogoCandidates(j.logo, j.company_name || j.company, j.companyWebsite || j.company_website),
                matchScore: j.matchScore
            }))
            const capped = normalized.slice(0, dailyLimit)
            if (capped.length === 0) {
                throw new Error('当前未检索到匹配岗位')
            }
            setRecommendations(capped)
            setActiveCard(0)
            setHasResults(true)
            setLastUpdatedAt(Date.now())
            showSuccess('匹配完成', `已为您找到 ${capped.length} 个相关岗位`)

        } catch (error: any) {
            console.error(error)
            setRecommendations([])
            setHasResults(false)
            showError('获取推荐失败', error?.message || '请稍后重试')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!hasHydrated || !isAuthenticated || autoRefreshedAfterLogin.current) return
        if (jobDirection && hasResults && recommendations.length > 0 && recommendations.length < dailyLimit && !loading) {
            autoRefreshedAfterLogin.current = true
            handleGetRecommendations()
        }
    }, [hasHydrated, isAuthenticated, hasResults, recommendations.length, dailyLimit, loading, jobDirection])
    
    const handleGeneratePlan = () => {
        setShowPlanModal(true)
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
                <div className="text-center mb-10 max-w-5xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-5 leading-tight tracking-tight drop-shadow-sm">
                        理想生活，
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-blue-500">
                            从远程工作开始
                        </span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 max-w-3xl mx-auto font-medium">
                        不只是找工作 — Haigoo 陪你走好从规划准备、投递面试到适应远程生活的每一步。
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                        {['✓ 仅收录国内可申的全球远程工作', '✓ 所有岗位均经过人工审核', '✓ 限时免费直申中'].map((chip) => (
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
                            style={{ '--marquee-duration': '90s' } as CSSProperties}
                        >
                            {tickerLoop.map((job, i) => (
                                <div
                                    key={`${job.id}-${i}`}
                                    className="pointer-events-auto"
                                    aria-hidden={i >= tickerJobs.length}
                                >
                                    <JobTickerItem job={job} />
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
                                    <h2 className="text-[34px] md:text-[38px] font-bold text-slate-900 leading-[1.1] tracking-tight">每天为你推荐一组<br/>最匹配的岗位</h2>
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
                                        className={`border-2 border-dashed rounded-2xl p-3.5 text-center cursor-pointer transition-all ${
                                            resumeName ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
                                        }`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleResumeUpload(f) }}
                                    >
                                        {uploading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                                <span className="text-sm text-indigo-600">上传中...</span>
                                            </div>
                                        ) : resumeName ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-sm font-semibold text-indigo-700 truncate max-w-[180px]">{resumeName}</span>
                                                <button onClick={e => { e.stopPropagation(); setResumeName(null); setResumeId(null); setGuestResumeFile(null); setGuestResumeHints([]); clearPendingGuestResume() }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
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
                                    <label className="flex items-start gap-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} className="mt-0.5 accent-indigo-600 w-3.5 h-3.5" />
                                        <span className="text-[11px] text-slate-500 leading-relaxed">
                                            我已阅读并同意{' '}<a href="/privacy" target="_blank" className="text-indigo-500 underline">简历隐私使用说明</a>，Haigoo 仅将简历用于岗位匹配分析
                                        </span>
                                    </label>
                                    <button onClick={handleGetRecommendations} disabled={loading || !jobDirection}
                                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-[0_8px_20px_rgba(79,70,229,0.30)] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        {loading ? '获取中...' : '获取专属推荐'}
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
                                                ? (isMember ? '今日推荐已更新，会员可继续拓展方案并深度打磨求职计划。' : '今日推荐已更新，可继续浏览 5 个精选岗位，并进入完整规划查看行动建议。')
                                                : '游客模式每日可获得 1 个推荐，登录后每日 5 个。'}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">当前偏好</div>
                                            <button onClick={() => { setHasResults(false); setActiveCard(0) }} className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">修改偏好</button>
                                        </div>
                                        <div className="text-sm font-semibold text-indigo-600 truncate">{jobDirection || '未填写'} · {positionTypeLabel}</div>
                                    </div>
                                    <div className="h-[52px] mt-auto">
                                        <button onClick={handleGeneratePlan}
                                            className="w-full h-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-[0_8px_20px_rgba(79,70,229,0.30)] transition-all flex items-center justify-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            查看完整求职规划 →
                                        </button>
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
                                        const job = displayRecommendations[activeCard] || displayRecommendations[0]
                                        const title = job?.title || job?.role || '远程岗位'
                                        const company = job?.company_name || job?.company || 'Company'
                                        const location = job?.location || job?.remote_location || '远程'
                                        const timezone = job?.timezone || job?.remote_timezone || ''
                                        const salary = job?.salary || job?.salary_range || '薪酬面议'
                                        const companyIntro = job?.company_intro || job?.description || `${company} 是一家全球化远程优先军业公司，岗位面向全球中文人才开放申请。`
                                        const detail = job?.description || `该岗位聚焦${jobDirection || '核心岗位能力'}，要求跨团队协作、远程沟通与业务驱动思维，适合希望在国际化团队长期发展的候选人。`
                                        const openJobDetail = () => setSelectedJobDetail({
                                            id: String(job?.id || `hero-job-${activeCard}`),
                                            title,
                                            company,
                                            company_name: company,
                                            location,
                                            salary,
                                            timezone,
                                            description: detail,
                                            company_intro: companyIntro,
                                            source: 'hero_copilot'
                                        })
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
                                                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{companyIntro}</p>
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
            {showPlanModal && (
                <CopilotPlanModal
                    onClose={() => setShowPlanModal(false)}
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
            />
        </div>
    )
}

function CopilotPlanModal({ onClose, jobDirection, positionType, resumeId }: { onClose: () => void, jobDirection: string, positionType: string, resumeId: string | null }) {
    const { isAuthenticated, token, isMember } = useAuth()
    const [timeline] = useState('1-3个月')
    const [weeklyHours] = useState('5-10小时')
    const [planData, setPlanData] = useState<any | null>(null)
    const [planLoading, setPlanLoading] = useState(false)
    const [planError, setPlanError] = useState('')
    const [planReloadTick, setPlanReloadTick] = useState(0)

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [])

    useEffect(() => {
        let mounted = true
        const loadPlan = async () => {
            if (!isAuthenticated || !token) return
            setPlanLoading(true)
            setPlanError('')
            try {
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
                        timeline: '1-3 months',
                        background: { industry: jobDirection, availability: weeklyHours }
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
                        timeline: '1-3 months',
                        background: { industry: jobDirection, availability: weeklyHours }
                    })
                })
                const planResult = await planResp.json().catch(() => ({}))
                const nextPlan = planResult?.planData || planResult?.plan || null

                if (planResp.ok && nextPlan && mounted) {
                    setPlanData({
                        ...nextPlan,
                        readiness: assessData?.readinessData?.remote_readiness_score,
                        summary: nextPlan.summary || `AI 已根据你的岗位偏好生成专属求职规划，默认按 ${timeline}、每周 ${weeklyHours} 的投入节奏推进。`
                    })
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
                        timeline: '1-3 months',
                        background: { industry: jobDirection, availability: weeklyHours },
                        resumeId
                    })
                })
                const legacyData = await legacyResp.json().catch(() => ({}))
                if (legacyResp.ok && legacyData?.plan && mounted) {
                    setPlanData(legacyData.plan)
                    return
                }

                const getResp = await fetch('/api/copilot', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const getData = await getResp.json().catch(() => ({}))
                if (getResp.ok && getData?.success && getData?.plan && mounted) {
                    setPlanData(getData.plan)
                    return
                }
                if (mounted) {
                    setPlanData(null)
                    setPlanError('方案生成失败或未保存成功，请重试。')
                }
            } catch {
                if (mounted) {
                    setPlanData(null)
                    setPlanError('加载求职方案失败，请重试。')
                }
            } finally {
                if (mounted) setPlanLoading(false)
            }
        }
        loadPlan()
        return () => { mounted = false }
    }, [isAuthenticated, token, positionType, jobDirection, resumeId, planReloadTick])

    const guestPlan = {
        summary: '这是简版远程求职规划，用于体验核心流程。登录后可获得完整方案与更多细节分析。',
        strengths: [],
        remoteReadiness: { score: 68 },
        plan_v2: {
            goalContext: { goal: '远程产品/增长方向' },
            modules: {
                interview: { summary: '先完成 5 个高频问题的结构化回答练习。' },
                apply: { summary: '建立每周投递节奏，并复盘转化数据。' }
            }
        },
        recommendations: [
            { role: 'Senior Product Manager', company: 'TechSolutions', matchScore: 92, matchLabel: '高匹配', matchLevel: 'high', reason: '产品策略与跨团队协作要求与您的背景匹配。' },
            { role: 'Product Owner', company: 'InnovateCorp', matchScore: 86, matchLabel: '较高', matchLevel: 'medium', reason: '岗位聚焦需求管理与远程协作，适合当前方向。' }
        ],
        milestones: [
            { month: '第1周', focus: `目标拆解（准备周期 ${timeline}）`, tasks: ['定义目标岗位画像', '拆解能力差距与优先级'] },
            { month: '第2-3周', focus: `能力建设（每周投入 ${weeklyHours}）`, tasks: ['优化简历与项目表达', '完成高频题结构化练习'] },
            { month: '第4周', focus: '投递与反馈迭代', tasks: ['建立投递节奏', '复盘面试反馈并优化'] }
        ],
        applicationPlan: { steps: [] }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl max-h-[88vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                <div className="bg-indigo-600 text-white px-6 py-5 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Copilot 求职助手</h2>
                            <p className="text-indigo-100 text-xs">{isAuthenticated ? '基于你的偏好生成的专属求职规划。' : '未登录也可体验简版求职规划，登录后解锁完整方案与更多岗位推荐。'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-contain flex-1 p-6 space-y-6">
                    {!isAuthenticated ? (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-bold text-indigo-900">登录获取完整方案</div>
                                <div className="text-xs text-indigo-700 mt-0.5">登录后可解锁完整方案内容与更多推荐功能。</div>
                            </div>
                            <Link to="/login" onClick={onClose} className="px-4 py-2 bg-white text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors text-center">登录解锁</Link>
                        </div>
                    ) : null}

                    <div className="bg-white border border-indigo-100 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-bold text-slate-900">准备时间参考</div>
                        </div>
                        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                            以下方案按照准备周期<span className="font-bold text-slate-800">【1-3个月】</span>、每周投入<span className="font-bold text-slate-800">【5-10小时】</span>来设计，可供参考。
                        </div>
                    </div>

                    {isAuthenticated ? (
                        isMember ? (
                            <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-100 rounded-2xl p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">会员专属能力已解锁</div>
                                        <div className="text-xs text-slate-600 mt-1">你可以继续拓展求职方案、在 Copilot 工作台拆解行动阶段，并在个人中心深度打磨求职计划。</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Link to="/copilot" onClick={onClose} className="px-4 py-2 rounded-xl bg-white text-emerald-700 border border-emerald-200 text-sm font-semibold hover:bg-emerald-50 transition-colors no-underline hover:no-underline">拓展方案</Link>
                                        <Link to="/profile?tab=custom-plan" onClick={onClose} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors no-underline hover:no-underline">深度打磨计划</Link>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-bold text-slate-900">升级会员可继续深化方案</div>
                                    <div className="text-xs text-slate-600 mt-1">当前已可查看完整规划；升级后可继续拓展求职方案，并深度打磨执行计划。</div>
                                </div>
                                <Link to="/membership" onClick={onClose} className="px-4 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors text-center no-underline hover:no-underline">查看会员权益</Link>
                            </div>
                        )
                    ) : null}

                    {planLoading && isAuthenticated ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">正在加载你的完整求职规划...</div>
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
                        <GeneratedPlanView plan={normalizePlanForView(isAuthenticated ? planData : guestPlan)} isGuest={!isAuthenticated} openInNewTab />
                    )}
                </div>
            </div>
        </div>
    )
}
