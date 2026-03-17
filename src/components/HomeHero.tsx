<<<<<<< preview-fix
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Sparkles, Upload, CheckCircle2, ArrowRight, ArrowLeft, Lock,
    Target, TrendingUp, Eye, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Send
=======
import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useRef, type CSSProperties } from 'react'
import {
    Sparkles, Target, Briefcase, Loader2, X, UploadCloud,
    ChevronLeft, ChevronRight, MapPin, DollarSign, Building2
>>>>>>> local
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import JobTickerItem from './JobTickerItem'
import GeneratedPlanView from './GeneratedPlanView'
<<<<<<< preview-fix
import { trackingService } from '../services/tracking-service'
=======
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
>>>>>>> local

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
}

<<<<<<< preview-fix
type GoalType = 'full-time' | 'side-income' | 'market-watch' | 'career-pivot' | ''
type TimelineType = 'immediately' | '1-3 months' | '3-6 months' | 'flexible' | ''

interface CopilotFormData {
    goal: GoalType
    timeline: TimelineType
    background: {
        role: string
        years: string
        education: string
        language: string
    }
}

// ── Demo Frames ──────────────────────────────────────────────────────────────
interface DemoFrame {
    phase: 'profile' | 'resume' | 'jobs' | 'interview'
    delay: number // ms to wait before starting this frame
}

const DEMO_FRAMES: DemoFrame[] = [
    { phase: 'profile', delay: 0 },
    { phase: 'resume', delay: 3200 },
    { phase: 'jobs', delay: 7800 },
    { phase: 'interview', delay: 12500 },
]

const DEMO_TOTAL_DURATION = 18000

// ── Demo Panel ────────────────────────────────────────────────────────────────
function DemoPanel({ paused, isGenerating }: { paused: boolean, isGenerating?: boolean }) {
    const [tick, setTick] = useState(0)
    const [activePhase, setActivePhase] = useState<string>('profile')
    const [matchScore, setMatchScore] = useState(0)
    const [resumeText, setResumeText] = useState('')
    const [jobChips, setJobChips] = useState<number>(0)
    const [interviewVisible, setInterviewVisible] = useState(false)
    const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

    const FULL_RESUME_TEXT = '检测到简历缺少量化数据，建议将「负责产品增长」改为「主导 3 个核心功能迭代，DAU 提升 28%，留存率改善 12%」，增强竞争力。'

    const JOBS = [
        { name: 'Shopify', logo: 'shopify.com', role: '远程产品经理' },
        { name: 'GitLab', logo: 'gitlab.com', role: '高级产品经理' },
        { name: 'Figma', logo: 'figma.com', role: '增长产品经理' },
        { name: 'Notion', logo: 'notion.so', role: '产品负责人' },
    ]

    const reset = useCallback(() => {
        timerRefs.current.forEach(t => clearTimeout(t))
        timerRefs.current = []
        setActivePhase('profile')
        setMatchScore(0)
        setResumeText('')
        setJobChips(0)
        setInterviewVisible(false)
    }, [])

    useEffect(() => {
        if (paused) return
        reset()

        // Count-up match score
        let score = 0
        const scoreInterval = setInterval(() => {
            score += 3
            if (score >= 92) { clearInterval(scoreInterval); score = 92 }
            setMatchScore(score)
        }, 40)

        // Resume phase
        const t1 = setTimeout(() => {
            if (paused) return
            setActivePhase('resume')
            let i = 0
            const typeInterval = setInterval(() => {
                i += 2
                setResumeText(FULL_RESUME_TEXT.slice(0, i))
                if (i >= FULL_RESUME_TEXT.length) clearInterval(typeInterval)
            }, 25)
            timerRefs.current.push(setTimeout(() => clearInterval(typeInterval), 6000))
        }, 3200)

        // Jobs phase
        const t2 = setTimeout(() => {
            if (paused) return
            setActivePhase('jobs')
            JOBS.forEach((_, idx) => {
                const t = setTimeout(() => setJobChips(idx + 1), idx * 350)
                timerRefs.current.push(t)
            })
        }, 7800)

        // Interview phase
        const t3 = setTimeout(() => {
            if (paused) return
            setActivePhase('interview')
            setInterviewVisible(true)
        }, 12500)

        // Reset loop
        const t4 = setTimeout(() => {
            setTick(prev => prev + 1)
        }, DEMO_TOTAL_DURATION)

        timerRefs.current.push(t1, t2, t3, t4)
        return () => {
            clearInterval(scoreInterval)
            timerRefs.current.forEach(t => clearTimeout(t))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tick, paused])

    return (
        <div className="flex flex-col h-full">
            {/* Demo Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em] mb-0.5">
                        AI Copilot · 实时演示
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {isGenerating ? "正在为您生成专属远程求职方案..." : "林晓的远程求职方案"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">产品经理 · 4 年经验 · 英语 B2</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        匹配度 {matchScore}%
                    </div>
                    <div className="text-[10px] text-slate-400">全职远程 · 3 个月内入职</div>
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-3.5 flex-1 overflow-hidden relative">
                {/* Connector line */}
                <div className="absolute left-[17px] top-6 bottom-6 w-px bg-gradient-to-b from-indigo-200 via-slate-100 to-transparent pointer-events-none" />

                {/* Step 1 - Resume */}
                <div className={`relative pl-10 transition-all duration-500 ${activePhase === 'profile' ? 'opacity-60' : 'opacity-100'}`}>
                    <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm z-10 transition-all duration-300 ${activePhase === 'profile' ? 'bg-white border-slate-200 text-slate-400' :
                        'bg-indigo-600 border-indigo-600 text-white'
                        }`}>
                        {activePhase !== 'profile' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-xs font-bold text-slate-700 mb-1.5">简历竞争力诊断</div>
                        <div className="text-xs text-slate-500 leading-relaxed min-h-[40px]">
                            {activePhase === 'profile' ? (
                                <span className="text-slate-300 italic">等待分析...</span>
                            ) : (
                                <>
                                    {resumeText}
                                    {activePhase === 'resume' && resumeText.length < FULL_RESUME_TEXT.length && (
                                        <span className="inline-block w-0.5 h-3 bg-indigo-500 ml-0.5 animate-pulse" />
                                    )}
                                </>
                            )}
                        </div>
                        {activePhase !== 'profile' && activePhase !== 'resume' && (
                            <div className="mt-2 flex items-center gap-1.5">
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium border border-indigo-100">
                                    优化建议 ×3
                                </span>
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium border border-amber-100">
                                    关键词补充 ×5
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 2 - Jobs */}
                <div className={`relative pl-10 transition-all duration-500 ${activePhase === 'profile' || activePhase === 'resume' ? 'opacity-40' : 'opacity-100'
                    }`}>
                    <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm z-10 transition-all duration-300 ${activePhase === 'jobs' || activePhase === 'interview' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                        {activePhase === 'interview' ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-xs font-bold text-slate-700 mb-2">精准岗位匹配</div>
                        <div className="flex flex-wrap gap-1.5">
                            {JOBS.slice(0, jobChips).map((job, i) => (
                                <div key={i} className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 shadow-sm animate-[fadeSlideIn_0.3s_ease-out]">
                                    <img
                                        src={`https://logo.clearbit.com/${job.logo}`}
                                        className="w-3 h-3 rounded-full opacity-80"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                        alt=""
                                    />
                                    {job.name}
                                    <span className="text-slate-400">·</span>
                                    <span className="text-indigo-500">{job.role}</span>
                                </div>
                            ))}
                            {jobChips === 0 && <span className="text-[11px] text-slate-300 italic">扫描中...</span>}
                        </div>
                    </div>
                </div>

                {/* Step 3 - Interview */}
                <div className={`relative pl-10 transition-all duration-500 ${interviewVisible ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm z-10 transition-all duration-300 ${interviewVisible ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                        3
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-xs font-bold text-slate-700 mb-1.5">英文面试模拟 & 复盘</div>
                        {interviewVisible ? (
                            <div className="space-y-1">
                                <div className="text-xs text-slate-500">「Tell me about a time you led a redesign...」</div>
                                <div className="text-[10px] text-indigo-500 font-medium">→ 英文 STAR 法则参考回答已生成</div>
                            </div>
                        ) : (
                            <span className="text-[11px] text-slate-300 italic">待解锁...</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Demo Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-pulse [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full animate-pulse [animation-delay:0.4s]" />
                    <span className="text-[10px] text-slate-400 ml-1">AI 分析中</span>
                </div>
                <div className="text-[10px] text-slate-400">
                    预计完成 <span className="text-indigo-500 font-medium">3 天准备周期</span>
                </div>
            </div>
        </div>
    )
}

// ── Generating Progress Panel ──────────────────────────────────────────────────
// Shown while AI is generating — displays user's actual inputs + animated progress steps
function GeneratingProgressPanel({ formData }: { formData: CopilotFormData }) {
    const GOAL_LABEL: Record<string, string> = {
        'full-time': '找长期远程工作',
        'side-income': '兼职/副业增收',
        'market-watch': '关注市场机会',
        'career-pivot': '职业转型',
    }
    const TIMELINE_LABEL: Record<string, string> = {
        'immediately': '尽快入职',
        '1-3 months': '1-3 个月内',
        '3-6 months': '3-6 个月内',
        'flexible': '时机合适随时',
    }

    const analysisSteps = [
        { label: '解析职业背景', detail: formData.background.role ? `方向：${formData.background.role} · ${formData.background.years}` : '正在读取...', active: true },
        { label: '制定求职路线图', detail: `目标：${GOAL_LABEL[formData.goal] || '综合匹配'} · ${TIMELINE_LABEL[formData.timeline] || '时间规划中'}`, active: true },
        { label: '匹配精选远程岗位', detail: '根据背景与目标筛选最匹配的岗位...', active: false },
        { label: '生成个性化行动计划', detail: '制定准备路径和关键里程碑...', active: false },
    ]

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em] mb-0.5">
                        AI Copilot · 专属生成中
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        正在为您生成专属求职方案...
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {formData.background.role
                            ? `${formData.background.role} · ${formData.background.years} · ${formData.background.language}`
                            : 'AI 分析中'}
                    </p>
                </div>
                <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100 flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
                    </span>
                    AI 分析中
                </div>
            </div>

            <div className="space-y-3.5 flex-1 overflow-hidden relative">
                <div className="absolute left-[17px] top-6 bottom-6 w-px bg-gradient-to-b from-indigo-200 via-slate-100 to-transparent pointer-events-none" />
                {analysisSteps.map((s, i) => (
                    <div key={i} className={`relative pl-10 transition-all duration-500 ${s.active ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm z-10 ${s.active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                            }`}>
                            {s.active
                                ? <div className="w-3 h-3 rounded-full bg-white/80 animate-pulse" />
                                : i + 1
                            }
                        </div>
                        <div className={`rounded-xl p-3 border ${s.active ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`text-xs font-bold mb-1 ${s.active ? 'text-indigo-700' : 'text-slate-400'}`}>{s.label}</div>
                            <div className="text-xs text-slate-500 leading-relaxed">{s.detail}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full animate-pulse [animation-delay:0.4s]" />
                <span className="text-[10px] text-slate-400 ml-1">AI 深度分析中，通常需要 20-40 秒</span>
=======
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
>>>>>>> local
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


<<<<<<< preview-fix
const COLOR_MAP: Record<string, string> = {
    indigo: 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-indigo-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-emerald-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-700 shadow-amber-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-700 shadow-rose-100',
}
const COLOR_IDLE = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-md'
const ICON_MAP: Record<string, string> = {
    indigo: 'text-indigo-500 bg-indigo-100',
    emerald: 'text-emerald-500 bg-emerald-100',
    amber: 'text-amber-500 bg-amber-100',
    rose: 'text-rose-500 bg-rose-100',
}

const TIMELINE_OPTIONS: Array<{ value: TimelineType; label: string; sub: string }> = [
    { value: 'immediately', label: '尽快', sub: '已准备好' },
    { value: '1-3 months', label: '1-3 个月', sub: '正在准备' },
    { value: '3-6 months', label: '3-6 个月', sub: '探索阶段' },
    { value: 'flexible', label: '随时', sub: '机会合适再动' },
]

const SENIORITY_OPTIONS = ['实习生', '初级', '中级', '高级', '专家/负责人']
const EDUCATION_OPTIONS = ['高中/职高', '大专', '本科', '硕士', '博士']
const LANGUAGE_OPTIONS = ['英语-入门 (A1/A2)', '英语-日常 (B1)', '英语-工作 (B2)', '英语-流利 (C1)', '英语-母语 (C2)']

// Map goal to API value
const GOAL_TO_API: Record<GoalType, string> = {
    'full-time': 'full-time',
    'side-income': 'part-time',
    'market-watch': 'flexible',
    'career-pivot': 'freelance',
    '': 'full-time',
}



// ── Main Component ────────────────────────────────────────────────────────────
export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated, user, sendVerificationEmail } = useAuth()
    const isVIP = (user as any)?.memberStatus === 'active' || (user as any)?.memberStatus === 'lifetime' || (user as any)?.memberStatus === 'pro'
    const { showWarning, showError } = useNotificationHelpers()
=======
export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()
>>>>>>> local

    // Background Parallax State
    const [bgPosition] = useState({ x: 50, y: 50 })

<<<<<<< preview-fix
    const handleResend = async () => {
        if (!user?.email || !sendVerificationEmail) return;
        setResending(true);
        try {
            const res = await sendVerificationEmail(user.email);
            if (res && res.success) {
                setResendMsg('验证邮件已发送，请查收');
            } else {
                setResendMsg(res?.message || '发送失败');
            }
        } catch (e) {
            setResendMsg('发送失败');
        } finally {
            setResending(false);
        }
    }

    // Wizard state
    const [step, setStep] = useState(0) // 0-3
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [animating, setAnimating] = useState(false)

    const [formData, setFormData] = useState<CopilotFormData>({
        goal: '',
        timeline: '',
        background: { role: '', years: '中级', education: '本科', language: '英语-工作 (B2)' }
    })

    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const resumeInputRef = useRef<HTMLInputElement>(null)
    const [resumeFileName, setResumeFileName] = useState<string | null>(null)
    const [resumeUploading, setResumeUploading] = useState(false)
    const [resumeId, setResumeId] = useState<string | null>(null)
    const [demoPaused, setDemoPaused] = useState(false)
    const [isWizardCollapsed, setIsWizardCollapsed] = useState(false)

    // Debug controls
    const [debugMode, setDebugMode] = useState(false)
    const [bgPosition, setBgPosition] = useState({ x: 50, y: 50 }) // Center default
    const [bgScale, setBgScale] = useState(100) // 100%
    const [bgOpacity, setBgOpacity] = useState(90) // Percentage

    // AI Generation Plan State
    const [generatedPlan, setGeneratedPlan] = useState<any>(null)

    // Load previous plan on mount (authenticated users only, no guest cache)
=======
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
>>>>>>> local
    useEffect(() => {
        const cached = localStorage.getItem(HERO_CACHE_KEY)
        if (cached) {
            try {
<<<<<<< preview-fix
                const token = localStorage.getItem('haigoo_auth_token')
                if (!token) return;
                const res = await fetch('/api/copilot', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const data = await res.json()
                if (res.ok && data.plan) {
                    setGeneratedPlan(data.plan)
                    setStep(3);
=======
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
>>>>>>> local
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

<<<<<<< preview-fix
    const goTo = (nextStep: number, dir: 'forward' | 'back') => {
        if (animating) return
        setDirection(dir)
        setAnimating(true)
        setTimeout(() => {
            setStep(nextStep)
            setAnimating(false)
        }, 220)
    }

    const nextStep = () => {
        if (step === 0 && !formData.goal) {
            showWarning('请选择目标', '告诉我们您希望通过远程工作达到什么目的')
            return
        }
        if (step === 1 && !formData.timeline) {
            showWarning('请选择时间', '我们需要了解您的计划时间来制定方案')
            return
        }
        if (step < 3) goTo(step + 1, 'forward')
    }

    const prevStep = () => {
        if (step > 0) goTo(step - 1, 'back')
    }

    const handleGenerate = async () => {
        // Skip role validation when regenerating (user already filled it before)
        if (!generatedPlan && !formData.background.role.trim()) {
            showWarning('请填写职业方向', 'AI 需要了解您的职业背景')
            inputRef.current?.focus()
            return
        }

        setLoading(true)
        try {
            const token = localStorage.getItem('haigoo_auth_token')
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    userId: user?.user_id,
                    goal: GOAL_TO_API[formData.goal],
                    timeline: formData.timeline,
                    background: {
                        industry: formData.background.role,
                        seniority: formData.background.years,
                        education: formData.background.education,
                        language: formData.background.language,
                    },
                    resumeId,
                })
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 401) {
                    showWarning('请先登录', '登录后即可解锁完整 AI 远程求职方案')
                    navigate('/login')
                } else if (res.status === 403) {
                    showWarning('免费次数已用完', '免费用户可生成一次方案，升级会员解锁无限次使用')
                    navigate('/membership')
                } else {
                    throw new Error(data.error || '生成失败')
                }
                return
            }

            if (data.plan) {
                setGeneratedPlan(data.plan)
                if (!isAuthenticated) {
                    showWarning('体验版方案已生成', '注册/登录后可保存方案并获取更多岗位推荐！')
                }
            }

        } catch (err: any) {
            console.error(err)
            showError('服务暂时不可用', err.message)
        } finally {
            setLoading(false)
        }
    }
=======
    useEffect(() => {
        if (!hasHydrated) return
        const payload = { jobDirection, positionType, recommendations, hasResults, timestamp: Date.now() }
        localStorage.setItem(HERO_CACHE_KEY, JSON.stringify(payload))
    }, [jobDirection, positionType, recommendations, hasResults, hasHydrated])
>>>>>>> local

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

<<<<<<< preview-fix
    const STEPS = ['选择目标', '规划时间', '职业背景', '生成方案']
=======
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
>>>>>>> local

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
<<<<<<< preview-fix

                    {/* Trust Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                        {[
                            '✓ 1k+ 国内可申的真实远程机会',
                            '✓ 500+ 精选远程企业',
                            '✓ 5k+ 远程同行人',
                        ].map((chip) => (
=======
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                        {['✓ 仅收录国内可申的全球远程工作', '✓ 所有岗位均经过人工审核', '✓ 限时免费直申中'].map((chip) => (
>>>>>>> local
                            <span key={chip} className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white/80 backdrop-blur-md border border-white/50 rounded-full shadow-sm">
                                {chip}
                            </span>
                        ))}
                    </div>
                </div>

<<<<<<< preview-fix
                {/* ── Main Panel ── */}
                <div className="w-full max-w-5xl bg-white/30 backdrop-blur-md border border-white/20 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1),_0_0_0_1px_rgba(255,255,255,0.2)] p-3 md:p-4 mt-2 relative overflow-hidden">
                    {/* Glass sheen effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none rounded-[32px]" />

                    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 relative z-10 overflow-hidden transition-all duration-700 ease-in-out origin-top ${isWizardCollapsed ? 'max-h-[600px] min-h-[600px]' : 'max-h-[3000px] opacity-100 min-h-[600px]'
                        }`}>

                        {/* ── Left: Wizard ── */}
                        <div className="lg:col-span-5 bg-white/60 backdrop-blur-xl rounded-[24px] p-8 md:p-10 flex flex-col border border-white/40 shadow-sm relative overflow-hidden">

                            {/* Header */}
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm border border-slate-100 flex-shrink-0">
                                    <img src="/copilot.webp" alt="Copilot" className="w-full h-full object-cover scale-110" />
                                </div>
=======
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
>>>>>>> local
                                <div>
                                    <h2 className="text-[32px] md:text-[34px] font-bold text-slate-900 leading-[1.12] tracking-tight">每天为你推荐一组<br/>最匹配的岗位</h2>
                                    {hasResults && (
                                        <p className="text-xs text-slate-500 mt-1.5">今日推荐岗位已于 {formattedUpdatedAt} 更新</p>
                                    )}
                                </div>
                            </div>

<<<<<<< preview-fix
                            {/* Step Indicator */}
                            <div className="flex items-center gap-1.5 mb-6">
                                {STEPS.map((label, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div className={`h-1 w-full rounded-full transition-all duration-400 ${i < step ? 'bg-indigo-500' :
                                            i === step ? 'bg-indigo-300' :
                                                'bg-slate-100'
                                            }`} />
                                        <span className={`text-[9px] font-semibold tracking-wide transition-colors ${i === step ? 'text-indigo-600' :
                                            i < step ? 'text-indigo-400' :
                                                'text-slate-300'
                                            }`}>
                                            {label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Step Panel with slide animation */}
                            <div className="flex-1 relative overflow-hidden">
                                <div
                                    key={step}
                                    className={`absolute inset-0 transition-all duration-220 ease-out ${animating
                                        ? direction === 'forward'
                                            ? 'opacity-0 translate-x-4'
                                            : 'opacity-0 -translate-x-4'
                                        : 'opacity-100 translate-x-0'
                                        }`}
                                >

                                    {/* ── Step 0: Goal ── */}
                                    {step === 0 && (
                                        <div className="flex flex-col h-full">
                                            <p className="text-sm font-semibold text-slate-700 mb-4">
                                                你希望通过远程工作达到什么目的？
                                            </p>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {GOAL_OPTIONS.map((opt) => {
                                                    const isSelected = formData.goal === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => setFormData({ ...formData, goal: opt.value })}
                                                            className={`flex flex-col items-start text-left p-3.5 rounded-xl border-2 transition-all duration-200 shadow-sm ${isSelected
                                                                ? `${COLOR_MAP[opt.color]} shadow-lg`
                                                                : COLOR_IDLE
                                                                }`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all ${isSelected ? ICON_MAP[opt.color] : 'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                {opt.icon}
                                                            </div>
                                                            <div className="text-[13px] font-bold leading-tight mb-0.5">{opt.label}</div>
                                                            <div className="text-[10px] text-current opacity-60 leading-tight">{opt.desc}</div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Step 1: Timeline ── */}
                                    {step === 1 && (
                                        <div className="flex flex-col h-full">
                                            <p className="text-sm font-semibold text-slate-700 mb-1">
                                                你预计什么时候开始？
                                            </p>
                                            <p className="text-xs text-slate-400 mb-5">AI 将根据你的时间线倒推准备计划</p>
                                            <div className="space-y-2.5">
                                                {TIMELINE_OPTIONS.map((opt) => {
                                                    const isSelected = formData.timeline === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => setFormData({ ...formData, timeline: opt.value })}
                                                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all duration-200 ${isSelected
                                                                ? 'border-indigo-400 bg-indigo-50 shadow-md shadow-indigo-100'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                                                                    }`}>
                                                                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                                </div>
                                                                <span className={`text-sm font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                                    {opt.label}
                                                                </span>
                                                            </div>
                                                            <span className={`text-xs font-medium ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                                {opt.sub}
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Step 2: Background ── */}
                                    {step === 2 && (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm font-semibold text-slate-700">
                                                简单告诉我你的职业情况
                                            </p>

                                            {/* Role */}
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">
                                                    职业方向 <span className="text-rose-400">*</span>
                                                </label>
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={formData.background.role}
                                                    onChange={(e) => setFormData({ ...formData, background: { ...formData.background, role: e.target.value } })}
                                                    placeholder="如：产品经理、UI 设计师、前端工程师..."
                                                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-sm font-medium placeholder:font-normal placeholder:text-slate-400"
                                                />
                                            </div>

                                            {/* Selects row */}
                                            <div className="grid grid-cols-3 gap-2.5">
                                                {[
                                                    { label: '资历', key: 'years', opts: SENIORITY_OPTIONS },
                                                    { label: '学历', key: 'education', opts: EDUCATION_OPTIONS },
                                                    { label: '语言', key: 'language', opts: LANGUAGE_OPTIONS },
                                                ].map(({ label, key, opts }) => (
                                                    <div key={key}>
                                                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">
                                                            {label}
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={(formData.background as any)[key]}
                                                                onChange={(e) => setFormData({ ...formData, background: { ...formData.background, [key]: e.target.value } })}
                                                                className="w-full appearance-none px-3 py-2.5 bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-xs font-semibold cursor-pointer pr-7"
                                                            >
                                                                {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                                            </select>
                                                            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Info note */}
                                            <div className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                信息填得越详细，AI 生成的方案越个性化，也更具可操作性
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Step 3: Resume + Generate ── */}
                                    {step === 3 && (
                                        <div className="flex flex-col gap-4">
                                            {/* When plan already exists, show user's info summary */}
                                            {generatedPlan && (
                                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                                    <div className="text-xs font-semibold text-indigo-700 mb-2">你的求职信息</div>
                                                    <div className="space-y-1 text-xs text-slate-600">
                                                        {formData.goal && <div>目标：{GOAL_OPTIONS.find(o => o.value === formData.goal)?.label || formData.goal}</div>}
                                                        {formData.timeline && <div>时间：{TIMELINE_OPTIONS.find(o => o.value === formData.timeline)?.label || formData.timeline}</div>}
                                                        {formData.background.role && <div>方向：{formData.background.role}</div>}
                                                    </div>
                                                    <button
                                                        onClick={() => prevStep()}
                                                        className="mt-2 text-[11px] text-indigo-500 hover:text-indigo-700 underline"
                                                    >
                                                        修改信息
                                                    </button>
                                                </div>
                                            )}

                                            <p className="text-sm font-semibold text-slate-700">
                                                上传简历（可选）让 AI 诊断更精准
                                            </p>

                                            <div className="relative border-2 border-slate-100 rounded-xl p-4 bg-white shadow-sm transition-all overflow-hidden group">
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-slate-50 border border-slate-200">
                                                        {resumeId ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Upload className="w-5 h-5 text-slate-400" />}
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-center">
                                                        <h4 className="font-bold text-slate-900 mb-0.5 flex items-center gap-2 text-sm">
                                                            {resumeId ? '简历已上传' : '上传简历诊断'}
                                                            {!isVIP && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">会员专享</span>}
                                                        </h4>
                                                        <p className="text-xs text-slate-500">
                                                            {resumeFileName
                                                                ? <span className="text-emerald-600 font-medium truncate max-w-[150px] inline-block align-bottom">{resumeFileName}</span>
                                                                : !isAuthenticated ? '需登录 · 简历深度诊断为会员功能'
                                                                    : '支持 PDF / Word · AI 自动分析'}
                                                        </p>
                                                    </div>
                                                    {(!isVIP || !isAuthenticated) && <Lock className="w-4 h-4 text-slate-300 ml-2 flex-shrink-0" />}
                                                </div>

                                                {/* Overlay interaction handling */}
                                                {isVIP && isAuthenticated && (
                                                    <input
                                                        type="file"
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                        accept=".pdf,.doc,.docx"
                                                        onChange={(e) => {
                                                            if (e.target.files?.[0]) {
                                                                handleResumeUpload(e.target.files[0])
                                                                e.target.value = ''
                                                            }
                                                        }}
                                                        disabled={resumeUploading}
                                                    />
                                                )}
                                                {isAuthenticated && !isVIP && (
                                                    <div
                                                        className="absolute inset-0 w-full h-full cursor-pointer z-20"
                                                        onClick={() => {
                                                            showWarning('会员特权', '升级会员解锁"简历深度分析"功能。');
                                                            navigate('/membership');
                                                        }}
                                                    />
                                                )}
                                                {!isAuthenticated && (
                                                    <div
                                                        className="absolute inset-0 w-full h-full cursor-pointer z-20"
                                                        onClick={() => navigate('/login')}
                                                    />
                                                )}
                                            </div>

                                            {/* Tier Info */}
                                            {isVIP ? (
                                                <div className="flex items-start gap-2 text-xs text-slate-400 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                                    <div>
                                                        <span className="font-semibold text-indigo-700">尊敬的会员，已为您解锁全部 AI 功能</span>，您可以多次上传简历迭代替换方案并获得专属定制分析。
                                                    </div>
                                                </div>
                                            ) : isAuthenticated ? (
                                                <div className="flex items-start gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                                    <div>
                                                        <span className="font-semibold text-amber-700">免费用户可生成 1 次</span> 完整 AI 方案。
                                                        简历上传诊断、无限生成等高级功能需
                                                        <button onClick={() => navigate('/membership')} className="underline text-amber-600 ml-0.5">升级会员</button>。
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                    <div>
                                                        <span className="font-semibold text-slate-600">体验版方案</span>：仅可体验 AI 简版方案。
                                                        <button onClick={() => navigate('/login')} className="underline text-indigo-600 ml-0.5">登录</button>后可保存并体验更多功能。
                                                    </div>
                                                </div>
                                            )}

                                            {/* Generate CTA */}
                                            <button
                                                onClick={() => {
                                                    trackingService.track('click_generate_copilot_plan');
                                                    handleGenerate();
                                                }}
                                                disabled={loading}
                                                className="w-full py-4 rounded-xl font-bold text-base text-white relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed transition-all hover:scale-[1.015] active:scale-[0.99] shadow-xl shadow-indigo-500/20"
                                                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                                            >
                                                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <span className="relative flex items-center justify-center gap-2.5">
                                                    {loading ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                            正在生成专属方案...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            {generatedPlan ? '重新生成方案' : '生成我的远程求职方案'}
                                                        </>
                                                    )}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* Navigation Buttons */}
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                                <button
                                    onClick={prevStep}
                                    disabled={step === 0}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-0 disabled:pointer-events-none transition-all rounded-lg hover:bg-slate-100"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    返回
                                </button>

                                {step < 3 && (
                                    <button
                                        onClick={nextStep}
                                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm shadow-indigo-300 hover:shadow-md hover:shadow-indigo-300 hover:-translate-y-0.5"
=======
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
>>>>>>> local
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

<<<<<<< preview-fix
                            {generatedPlan ? (
                                <>
                                    <GeneratedPlanView plan={generatedPlan} isGuest={!isAuthenticated} />
                                    {isWizardCollapsed && (
                                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/95 to-transparent z-10 pointer-events-none rounded-b-[24px]" />
                                    )}
                                </>
                            ) : loading ? (
                                <GeneratingProgressPanel formData={formData} />
                            ) : (
                                <DemoPanel paused={demoPaused} isGenerating={false} />
                            )}
=======
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
>>>>>>> local
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

                    <GeneratedPlanView plan={guestPlan} isGuest={!isAuthenticated} isMember={false} deepMode={false} />

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
