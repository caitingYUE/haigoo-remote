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


export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()

    // Background Parallax State
    const [bgPosition] = useState({ x: 50, y: 50 })

    // Form State
    const [jobDirection, setJobDirection] = useState('')
    const [positionType, setPositionType] = useState('full-time')
    const [resumeId, setResumeId] = useState<string | null>(null)
    const [resumeName, setResumeName] = useState<string | null>(null)
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
    const [selectedJobDetail, setSelectedJobDetail] = useState<any | null>(null)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now())
    const displayRecommendations = hasResults && recommendations.length > 0
        ? recommendations
        : SAMPLE_RECOMMENDATIONS
    const dailyLimit = isAuthenticated ? 5 : 1
    const formattedUpdatedAt = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(lastUpdatedAt)
    
    // Mock active jobs for marquee (would be fetched from API in real app)
    const tickerJobs = [
        { id: 201, title: 'Senior Product Manager', company_name: 'ClickHouse', company_logo: '', salary: '$145k - $225k' },
        { id: 202, title: 'Sr. Full Stack Developer', company_name: 'MetroStar', company_logo: '', salary: '$101k - $147k' },
        { id: 203, title: 'Sr. Data Scientist', company_name: 'MoneyGram', company_logo: '', salary: '$130k - $185k' },
        { id: 204, title: 'UX Designer', company_name: 'PEXA Group', company_logo: '', salary: '£45k - £55k' },
        { id: 205, title: 'Remote PM (Cloud)', company_name: 'ClickHouse', company_logo: '', salary: '$145k+' },
        { id: 206, title: 'Remote Full Stack', company_name: 'MetroStar', company_logo: '', salary: '$101k+' },
    ]
    const tickerLoop = [...tickerJobs, ...tickerJobs]

    // Load saved form data from local storage for guest/returning users
    useEffect(() => {
        const cached = localStorage.getItem(HERO_CACHE_KEY)
        if (cached) {
            try {
                const data = JSON.parse(cached)
                if (Date.now() - data.timestamp < HERO_CACHE_TTL) {
                    if (data.timestamp) setLastUpdatedAt(data.timestamp)
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
        setHasHydrated(true)
    }, [])

    useEffect(() => {
        if (!hasHydrated) return
        const payload = { jobDirection, positionType, recommendations, hasResults, timestamp: Date.now() }
        localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(payload))
    }, [jobDirection, positionType, recommendations, hasResults, hasHydrated])

    const handleResumeUpload = async (file: File) => {
        if (!privacyAccepted) {
            showWarning('请同意隐私协议', '上传前请阅读并同意简历隐私使用说明')
            return
        }
        setUploading(true)
        try {
            const token = localStorage.getItem('haigoo_auth_token')
            if (!token) {
                setTimeout(() => {
                    setResumeId('guest-temp-id')
                    setResumeName(file.name)
                    setUploading(false)
                    showSuccess('简历已就绪', '可进行推荐匹配')
                }, 800)
                return
            }
            const fd = new FormData()
            fd.append('file', file)
            fd.append('metadata', JSON.stringify({ source: 'home_hero' }))
            const resp = await fetch('/api/resumes', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: fd
            })
            const result = await resp.json()
            if (!resp.ok || !result.success) throw new Error(result.error || '上传失败')
            setResumeId(result.id)
            setResumeName(file.name)
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
            const token = localStorage.getItem('haigoo_auth_token')
            // Guest (not logged in): show exactly 1 sample
            if (!token) {
                setTimeout(() => {
                    setRecommendations(SAMPLE_RECOMMENDATIONS.slice(0, 1))
                    setHasResults(true)
                    setLastUpdatedAt(Date.now())
                    setLoading(false)
                    showSuccess('找到 1 个匹配岗位', '登录后可解锁更多推荐')
                }, 1500)
                return
            }

            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'refresh-recommendations',
                    goal: positionType,
                    background: { industry: jobDirection },
                    resumeId
                })
            })

            const data = await res.json()
            if (!res.ok) {
                if (res.status === 401) {
                    showWarning('请先登录', '登录后查看更多推荐')
                    navigate('/login')
                    return
                }
                throw new Error(data.error || '获取推荐失败')
            }

            // Non-member: cap to 1 result
            const recs = data.recommendations || []
            const capped = recs.slice(0, dailyLimit)
            setRecommendations(capped)
            setHasResults(true)
            setLastUpdatedAt(Date.now())
            showSuccess('匹配完成', `已为您找到 ${capped.length} 个相关岗位`)

        } catch (error: any) {
            console.error(error)
            // Fallback for error
            const fallback = SAMPLE_RECOMMENDATIONS.slice(0, dailyLimit)
            setTimeout(() => {
                setRecommendations(fallback)
                setHasResults(true)
                setLastUpdatedAt(Date.now())
                setLoading(false)
            }, 1500)
        } finally {
            if (isAuthenticated) setLoading(false)
        }
    }
    
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
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-slate-50" />
                <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-indigo-200/20 blur-[100px] animate-pulse" />
                <div className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full bg-indigo-300/20 blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                
                {/* ── Hero Text ── */}
                <div className="text-center mb-10 max-w-5xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-5 leading-tight tracking-tight drop-shadow-sm">
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
                <div className="w-full max-w-5xl bg-gradient-to-br from-indigo-50/70 via-white to-white border border-indigo-100/50 rounded-[28px] shadow-[0_8px_28px_rgba(79,70,229,0.10)] p-5 md:p-6 mt-6 relative overflow-hidden lg:h-[600px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/30 to-transparent pointer-events-none" />
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f) }} />

                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 h-full">

                        {/* ── Left Column ── */}
                        <div className="lg:col-span-5 bg-white/80 rounded-2xl border border-indigo-100/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] p-4 flex flex-col gap-3 h-full">
                            {/* Shared title area with logo */}
                            <div className="mb-1">
                                <div>
                                    <h2 className="text-[32px] md:text-[34px] font-bold text-slate-900 leading-[1.12] tracking-tight">每天为你推荐一组<br/>最匹配的岗位</h2>
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
                                                <button onClick={e => { e.stopPropagation(); setResumeName(null); setResumeId(null) }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                                                <p className="text-xs font-semibold text-slate-600">拖拽简历到此 / 点击上传</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">PDF / Word 格式</p>
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
                                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{isAuthenticated ? '今日推荐已更新，可继续浏览 5 个精选岗位。' : '游客模式每日可获得 1 个推荐，登录后每日 5 个。'}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">当前偏好</div>
                                            <button onClick={() => { setHasResults(false); setActiveCard(0) }} className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">修改偏好</button>
                                        </div>
                                        <div className="text-sm font-semibold text-indigo-600 truncate">{jobDirection || '未填写'} · {positionType === 'full-time' ? '全职远程' : positionType === 'contract' ? '合同/兼职' : positionType === 'freelance' ? '自由职业' : '实习'}</div>
                                    </div>
                                    <div className="mt-auto pt-3">
                                    <button onClick={handleGeneratePlan}
                                        className="w-full h-[52px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-[0_8px_20px_rgba(79,70,229,0.30)] transition-all flex items-center justify-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        查看完整求职规划 →
                                    </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Right Column ── */}
                        <div className="lg:col-span-7 bg-white/80 rounded-2xl border border-indigo-100/60 flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] overflow-hidden h-full">
                            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">{hasResults ? '今日推荐' : '每日推荐预览'}</h3>
                                {hasResults && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setActiveCard(prev => Math.max(0, prev - 1))} disabled={activeCard === 0}
                                            className="w-7 h-7 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-indigo-50 transition-colors">
                                            <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                                        </button>
                                        <span className="text-xs text-slate-400">{activeCard + 1} / {displayRecommendations.length}</span>
                                        <button onClick={() => setActiveCard(prev => Math.min(displayRecommendations.length - 1, prev + 1))} disabled={activeCard >= displayRecommendations.length - 1}
                                            className="w-7 h-7 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center disabled:opacity-30 hover:bg-indigo-50 transition-colors">
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 px-5 pt-5 pb-3 flex flex-col">
                                {!hasResults ? (
                                    <div className="h-full min-h-[420px] flex flex-col gap-4 relative">
                                        {PREVIEW_PM_RECOMMENDATIONS.map((job, idx) => (
                                            <div key={job.id} className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {job.company_logo ? (
                                                            <img src={job.company_logo} alt={job.company_name} className="w-full h-full object-contain p-1.5" />
                                                        ) : (
                                                            <span className="text-sm font-bold text-indigo-500">{(job.company_name || '').slice(0, 2).toUpperCase()}</span>
                                                        )}
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
                                                        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">{job.company_intro}</p>
                                                    </div>
                                                </div>
                                                {idx < PREVIEW_PM_RECOMMENDATIONS.length - 1 && (
                                                    <div className="mt-3 border-t border-slate-100" />
                                                )}
                                            </div>
                                        ))}
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/18 to-white/12 backdrop-blur-[0.8px] flex items-center justify-center rounded-2xl">
                                            <p className="text-[20px] leading-tight font-bold text-slate-800/90 text-center px-8">Unlock your personalized daily matches after upload.</p>
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
                                        return (
                                            <div className="flex-1 flex flex-col relative">
                                                <div className="absolute inset-x-4 top-2 bottom-0 rounded-2xl border border-indigo-50 bg-white shadow-sm" />
                                                <div className="absolute inset-x-8 top-4 bottom-0 rounded-2xl border border-indigo-50 bg-white shadow-sm" />
                                                <button
                                                    onClick={() => setSelectedJobDetail({
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
                                                    })}
                                                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex-1 relative z-10 text-left hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                                                >
                                                    <h4 className="text-[30px] font-bold text-slate-900 mb-3 leading-[1.12]">{title}</h4>
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
                                                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">{companyIntro}</p>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-500 mb-1.5">岗位详情</div>
                                                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">{detail}</p>
                                                    </div>
                                                </button>
                                            </div>
                                        )
                                    })()
                                )}
                                {hasResults && (
                                    <div className="h-[52px] mt-3 relative z-10">
                                        {!isAuthenticated ? (
                                            <div className="h-full flex items-center justify-between bg-indigo-600 rounded-xl px-4">
                                                <span className="text-sm font-bold text-white">登录后解锁每日 5 个精选推荐</span>
                                                <button onClick={() => navigate('/login')} className="text-sm font-bold text-indigo-100 hover:text-white underline transition-colors">去登录</button>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-between bg-indigo-600 rounded-xl px-4">
                                                <span className="text-sm font-bold text-white">已登录，可继续查看完整推荐岗位</span>
                                                <button onClick={() => navigate('/jobs')} className="text-sm font-bold text-indigo-100 hover:text-white underline transition-colors">去申请</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* ── Copilot Plan Modal ── */}
            {showPlanModal && (
                <CopilotPlanModal onClose={() => setShowPlanModal(false)} />
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

function CopilotPlanModal({ onClose }: { onClose: () => void }) {
    const { isAuthenticated } = useAuth()
    const [timeline, setTimeline] = useState('1-3个月')
    const [weeklyHours, setWeeklyHours] = useState('5-10小时')

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [])

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
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-6 py-5 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">Copilot 求职助手</h2>
                            <p className="text-indigo-100 text-xs">未登录也可体验简版求职规划，登录后解锁完整方案与更多岗位推荐。</p>
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
                        <div className="text-sm font-bold text-slate-900 mb-3">关键行动路线设置</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-slate-500 mb-1">准备周期</div>
                                <select value={timeline} onChange={(e) => setTimeline(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                    <option value="1-3个月">1-3个月</option>
                                    <option value="3-6个月">3-6个月</option>
                                    <option value="6个月以上">6个月以上</option>
                                </select>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">每周投入时间</div>
                                <select value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                    <option value="5-10小时">5-10小时</option>
                                    <option value="10-20小时">10-20小时</option>
                                    <option value="20小时以上">20小时以上</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <GeneratedPlanView plan={guestPlan} isGuest={!isAuthenticated} />

                    <div className="text-center pt-2">
                        <Link to="/copilot" onClick={onClose} className="text-sm text-indigo-600 font-semibold hover:underline">
                            前往个人中心查看完整版 →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
