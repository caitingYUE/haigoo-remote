import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
    Sparkles, Upload, CheckCircle2, ArrowRight, ArrowLeft, Lock,
    Target, TrendingUp, Eye, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Send
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import GeneratedPlanView from './GeneratedPlanView'
import { trackingService } from '../services/tracking-service'

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
}

type GoalType = 'full-time' | 'side-income' | 'market-watch' | 'career-pivot' | ''
type TimelineType = 'immediately' | '1-3 months' | '3-6 months' | 'flexible' | ''
type InvestedHoursType = '5小时以内' | '5-10小时' | '10-20小时' | '20小时以上' | ''

interface CopilotFormData {
    goal: GoalType
    timeline: TimelineType
    investedHours: InvestedHoursType
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
            </div>
        </div>
    )
}

// ── Goal Options ──────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
    {
        value: 'full-time' as GoalType,
        icon: <Target className="w-5 h-5" />,
        label: '找长期远程工作',
        desc: '替代现有工作，享有全球薪资',
        color: 'indigo',
    },
    {
        value: 'side-income' as GoalType,
        icon: <TrendingUp className="w-5 h-5" />,
        label: '兼职/副业增收',
        desc: '在现有收入基础上额外创收',
        color: 'indigo',
    },
    {
        value: 'market-watch' as GoalType,
        icon: <Eye className="w-5 h-5" />,
        label: '关注市场机会',
        desc: '观望市场，等待合适时机',
        color: 'indigo',
    },
    {
        value: 'career-pivot' as GoalType,
        icon: <RefreshCw className="w-5 h-5" />,
        label: '职业转型',
        desc: '转换赛道，向新方向发展',
        color: 'indigo',
    },
]

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
// Reverse: API value → UI GoalType (for session restore)
const API_TO_GOAL: Record<string, GoalType> = {
    'full-time': 'full-time',
    'part-time': 'side-income',
    'flexible': 'market-watch',
    'freelance': 'career-pivot',
}



// ── Main Component ────────────────────────────────────────────────────────────
export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated, isMember, user, sendVerificationEmail } = useAuth()
    const isVIP = isMember
    const { showWarning, showError, showSuccess, showInfo } = useNotificationHelpers()

    // Verification banner state
    const showVerificationWarning = !!(isAuthenticated && user && !user?.emailVerified)
    const [resending, setResending] = useState(false)
    const [resendMsg, setResendMsg] = useState('')

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
    const [step, setStep] = useState(0) // 0-4
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [animating, setAnimating] = useState(false)

    const [formData, setFormData] = useState<CopilotFormData>({
        goal: '',
        timeline: '',
        investedHours: '',
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
    const [refreshingRecommendations, setRefreshingRecommendations] = useState(false)
    const trackingSetupUrl = useMemo(() => {
        const params = new URLSearchParams({ tab: 'subscriptions' })
        const role = formData.background.role.trim()
        if (role) params.set('prefillRole', role)
        return `/profile?${params.toString()}`
    }, [formData.background.role])

    // Load previous plan on mount (authenticated users only, no guest cache)
    useEffect(() => {
        const fetchExistingPlan = async () => {
            if (!isAuthenticated) return;
            try {
                const token = localStorage.getItem('haigoo_auth_token')
                if (!token) return;
                const res = await fetch('/api/copilot', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const data = await res.json()
                if (res.ok && data.plan) {
                    setGeneratedPlan(data.plan)
                    if (data.session) {
                        setFormData({
                            goal: API_TO_GOAL[data.session.goal] || data.session.goal as GoalType || 'full-time',
                            timeline: data.session.timeline || '',
                            investedHours: data.session.investedHours || '',
                            background: {
                                role: data.session.background?.industry || data.session.background?.role || '',
                                years: data.session.background?.seniority || data.session.background?.years || '中级',
                                education: data.session.background?.education || '本科',
                                language: data.session.background?.language || '英语-工作 (B2)'
                            }
                        })
                    }
                    setStep(4);
                }
            } catch (err) {
                console.error('Failed to restore copilot session:', err)
            }
        }
        fetchExistingPlan()
    }, [isAuthenticated])

    // Toggle debug with 'Ctrl+Shift+D'
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                setDebugMode(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [])

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
        if (step === 2 && !formData.investedHours) {
            showWarning('请选择投入时间', '告诉我们您每周可安排的准备时间')
            return
        }
        if (step < 4) goTo(step + 1, 'forward')
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
                    userId: user?.user_id || (user as any)?.id,
                    goal: GOAL_TO_API[formData.goal],
                    timeline: formData.timeline,
                    investedHours: formData.investedHours,
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

    const handleResumeUpload = async (file: File) => {
        if (!isAuthenticated) {
            showWarning('请先登录', '登录后可上传简历')
            navigate('/login')
            return
        }
        setResumeUploading(true)
        setResumeFileName(file.name)
        try {
            const token = localStorage.getItem('haigoo_auth_token')
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
            setResumeId(result.id || null)
        } catch (error: any) {
            showError('简历上传失败', error.message)
            setResumeFileName(null)
            setResumeId(null)
        } finally {
            setResumeUploading(false)
        }
    }

    const handleRefreshRecommendations = async () => {
        if (!generatedPlan) return

        if (!isAuthenticated) {
            showWarning('请先登录', '登录后可刷新个性化岗位推荐')
            navigate('/login')
            return
        }

        setRefreshingRecommendations(true)
        try {
            const token = localStorage.getItem('haigoo_auth_token')
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    action: 'refresh-recommendations',
                    userId: user?.user_id || (user as any)?.id,
                    goal: GOAL_TO_API[formData.goal],
                    background: {
                        industry: formData.background.role,
                        seniority: formData.background.years,
                        education: formData.background.education,
                        language: formData.background.language
                    }
                })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.error || '刷新推荐失败')
            }

            const newRecs = data?.recommendations || []
            if (newRecs.length > 0) {
                showSuccess('刷新成功', '已为您更新专属岗位推荐')
            } else {
                showInfo('暂无更新', '没有发现更合适的岗位，请稍后再试')
            }

            setGeneratedPlan((prev: any) => ({
                ...(prev || {}),
                recommendations: newRecs.length > 0 ? newRecs : prev?.recommendations
            }))
        } catch (error: any) {
            showError('刷新失败', error?.message || '请稍后重试')
        } finally {
            setRefreshingRecommendations(false)
        }
    }

    const [refiningMilestones, setRefiningMilestones] = useState(false)
    const handleRefineMilestones = async () => {
        if (!generatedPlan) return
        if (!isAuthenticated) { showWarning('请先登录', '登录后可体验深度打磨'); navigate('/login'); return; }
        if (!isVIP) { showWarning('会员专属功能', '升级会员解锁多次深度打磨权限'); navigate('/membership'); return; }

        const currentCount = generatedPlan.refineCount || 0;
        if (currentCount >= 3) { showWarning('已达打磨上限', '该方案深度打磨次数已达 3 次'); return; }

        setRefiningMilestones(true)
        try {
            const token = localStorage.getItem('haigoo_auth_token')
            const currentMilestones = generatedPlan.plan_v2?.modules?.milestones?.content?.phases || generatedPlan.milestones || []
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    action: 'refine-milestones',
                    userId: user?.user_id || (user as any)?.id,
                    goal: GOAL_TO_API[formData.goal],
                    timeline: formData.timeline,
                    background: {
                        industry: formData.background.role,
                        seniority: formData.background.years,
                        education: formData.background.education,
                        language: formData.background.language
                    },
                    currentMilestones
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || '打磨失败，请重试')

            setGeneratedPlan((prev: any) => {
                const updated = { ...prev }
                if (updated.plan_v2?.modules?.milestones?.content) {
                    updated.plan_v2.modules.milestones.content.phases = data.milestones
                }
                updated.milestones = data.milestones
                updated.refineCount = currentCount + 1
                return updated
            })
            showSuccess('深度打磨成功', '行动路线已根据你的情况深度优化')
        } catch (error: any) {
            showError('打磨失败', error?.message || '请稍后重试')
        } finally {
            setRefiningMilestones(false)
        }
    }

    const STEPS = ['选择目标', '规划时间', '职业背景', '生成方案']

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-50 pt-32 pb-20">

            {/* ── Background Image & Overlay (Fixed Visuals - Full Body Reveal) ── */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-slate-50">
                <div
                    className="absolute inset-0 w-full h-full overflow-hidden"
                >
                    <img
                        src="/background.webp?v=2"
                        alt="Ideal remote work lifestyle"
                        fetchPriority="high"
                        width="1920"
                        height="1080"
                        style={{
                            transform: `translate(${bgPosition.x - 50}%, ${bgPosition.y - 50}%) scale(${bgScale / 100})`,
                            opacity: bgOpacity / 100
                        }}
                        className={`absolute inset-0 w-full h-full object-cover origin-center`}
                    />
                </div>
                {/* 
                    Overlay Strategy:
                    1. Top: Completely transparent to show head clearly.
                    2. Middle: Very subtle fade to start blending.
                    3. Bottom: Soft white transition to content.
                */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-slate-50" />

                {/* Side gradient to soften edges but keep central focus clear */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20" />

                {/* Edge Fading for shifted background image */}
                {/* Right edge fade - to hide hard edge when image is shifted left */}
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-slate-50 via-slate-50/50 to-transparent pointer-events-none" />
                {/* Bottom edge fade - to hide hard edge when image is shifted up */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent pointer-events-none" />

                {/* Aurora blobs */}
                <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-indigo-200/15 blur-[100px] animate-[blobFloat_12s_ease-in-out_infinite]" />
                <div className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full bg-purple-200/15 blur-[100px] animate-[blobFloat_16s_ease-in-out_infinite_reverse] [animation-delay:4s]" />
                <div className="absolute -bottom-24 left-1/3 w-[400px] h-[400px] rounded-full bg-blue-200/15 blur-[90px] animate-[blobFloat_10s_ease-in-out_infinite] [animation-delay:2s]" />
            </div>

            {/* Debug Controls */}
            {debugMode && (
                <div className="fixed top-20 right-4 z-50 bg-white/90 p-4 rounded-lg shadow-xl border border-slate-200 w-64 text-xs font-mono">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">BG Controls</span>
                        <button onClick={() => setDebugMode(false)} className="text-slate-400 hover:text-red-500">×</button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-slate-500 mb-1">Position X: {bgPosition.x}%</label>
                            <input
                                type="range" min="0" max="100"
                                value={bgPosition.x}
                                onChange={(e) => setBgPosition(p => ({ ...p, x: Number(e.target.value) }))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-500 mb-1">Position Y: {bgPosition.y}%</label>
                            <input
                                type="range" min="0" max="100"
                                value={bgPosition.y}
                                onChange={(e) => setBgPosition(p => ({ ...p, y: Number(e.target.value) }))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-500 mb-1">Scale: {bgScale}%</label>
                            <input
                                type="range" min="100" max="200"
                                value={bgScale}
                                onChange={(e) => setBgScale(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-500 mb-1">Opacity: {bgOpacity}%</label>
                            <input
                                type="range" min="0" max="100"
                                value={bgOpacity}
                                onChange={(e) => setBgOpacity(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                            Press Ctrl+Shift+D to toggle
                        </div>
                    </div>
                </div>
            )}

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">

                {/* ── Email Verification Banner ── */}
                {showVerificationWarning && (
                    <div className="w-full bg-amber-50 md:bg-amber-50/90 backdrop-blur-md border border-amber-200/50 rounded-2xl px-5 py-3.5 mb-8 shadow-sm text-amber-800 text-sm flex flex-col md:flex-row items-center justify-between gap-4 max-w-5xl transition-all">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <span className="font-medium text-center md:text-left leading-relaxed">
                                当前账号 <strong>{user?.email}</strong> 尚未验证。请尽快验证您的邮箱，否则注册 24 小时后将无法登录。
                            </span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 mt-2 md:mt-0">
                            {resendMsg ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span>
                                    {resendMsg}
                                </span>
                            ) : (
                                <button
                                    onClick={handleResend}
                                    disabled={resending}
                                    className="text-amber-700 hover:text-amber-900 flex items-center gap-1.5 font-bold transition-all disabled:opacity-50 px-4 py-1.5 bg-amber-100/50 hover:bg-amber-200/50 rounded-full border border-amber-200"
                                >
                                    {resending ? '发送中...' : '重新发送验证邮件'}
                                    {!resending && <Send className="w-3.5 h-3.5" />}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Hero Text ── */}
                <div className="text-center mb-10 max-w-5xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight drop-shadow-sm">
                        理想生活，
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-blue-500 drop-shadow-sm">
                            从远程工作开始
                        </span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis font-medium">
                        不只是找工作 — Haigoo 陪你走好从规划准备、投递面试到适应远程生活的每一步。
                    </p>

                    {/* Trust Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                        {[
                            '✓ 1k+ 国内可申的真实远程机会',
                            '✓ 500+ 精选远程企业',
                            '✓ 5k+ 远程同行人',
                        ].map((chip) => (
                            <span key={chip} className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white/80 backdrop-blur-md border border-white/50 rounded-full shadow-sm">
                                {chip}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Main Panel ── */}
                <div className="w-full max-w-5xl bg-white/30 backdrop-blur-md border border-white/20 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1),_0_0_0_1px_rgba(255,255,255,0.2)] p-3 md:p-4 mt-2 relative">
                    {/* Glass sheen effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none rounded-[32px]" />

                    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 relative z-10 transition-all duration-700 ease-in-out origin-top ${isWizardCollapsed ? 'max-h-[600px] min-h-[600px] overflow-hidden' : 'max-h-[5000px] opacity-100 min-h-[600px]'
                        }`}>

                        {/* ── Left: Wizard ── */}
                        <div className="lg:col-span-5 bg-white/60 backdrop-blur-xl rounded-[24px] p-8 md:p-10 flex flex-col border border-white/40 shadow-sm relative overflow-hidden self-start lg:sticky lg:top-24 z-20">

                            {/* Header */}
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm border border-slate-100 flex-shrink-0">
                                    <img src="/copilot.webp" alt="Copilot" className="w-full h-full object-cover scale-110" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Haigoo 远程工作助手</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">告诉我你的情况，AI 为你定制方案</p>
                                </div>
                            </div>

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
                            <div className={`relative overflow-hidden shrink-0 transition-[height] duration-300 ease-in-out ${step === 4 ? (generatedPlan ? 'h-[650px]' : 'h-[520px]') : 'h-[420px]'}`}>
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

                                    {/* ── Step 2: Invested Hours ── */}
                                    {step === 2 && (
                                        <div className="flex flex-col h-full">
                                            <p className="text-sm font-semibold text-slate-700 mb-1">
                                                每周能投入多少时间准备？
                                            </p>
                                            <p className="text-xs text-slate-400 mb-5">投入时间决定了行动计划的节奏与颗粒度</p>
                                            <div className="space-y-2.5">
                                                {[
                                                    { value: '5小时以内', label: '5小时以内', sub: '碎片化准备，稳扎稳打' },
                                                    { value: '5-10小时', label: '5 - 10 小时', sub: '标准的副业/转型准备节奏' },
                                                    { value: '10-20小时', label: '10 - 20 小时', sub: '沉浸式准备，快速突破' },
                                                    { value: '20小时以上', label: '20小时以上', sub: '全职投入，高强度冲刺' }
                                                ].map((opt) => {
                                                    const isSelected = formData.investedHours === opt.value
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => setFormData({ ...formData, investedHours: opt.value as InvestedHoursType })}
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

                                    {/* ── Step 3: Background ── */}
                                    {step === 3 && (
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

                                    {/* ── Step 4: Resume + Generate ── */}
                                    {step === 4 && (
                                        <div className="flex flex-col gap-4">
                                            {/* When plan already exists, show user's info summary */}
                                            {generatedPlan && (
                                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm mb-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="text-sm font-bold text-indigo-900">你的定制需求</div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setStep(0);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold bg-white/80 px-2.5 py-1.5 rounded-lg shadow-sm transition-all hover:bg-white hover:shadow"
                                                            title="返回第一步修改参数"
                                                        >
                                                            <ArrowLeft className="w-3.5 h-3.5" />
                                                            修改需求
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1.5 text-xs text-indigo-700/80">
                                                        {formData.goal && <div><span className="font-semibold text-indigo-800">目标：</span>{GOAL_OPTIONS.find(o => o.value === formData.goal)?.label || formData.goal}</div>}
                                                        {formData.timeline && <div><span className="font-semibold text-indigo-800">时间：</span>{TIMELINE_OPTIONS.find(o => o.value === formData.timeline)?.label || formData.timeline}</div>}
                                                        {formData.investedHours && <div><span className="font-semibold text-indigo-800">投入：</span>每周 {formData.investedHours}</div>}
                                                        {formData.background.role && <div><span className="font-semibold text-indigo-800">方向：</span>{formData.background.role}</div>}
                                                        {formData.background.years && formData.background.years !== '中级' && <div><span className="font-semibold text-indigo-800">资历：</span>{formData.background.years}</div>}
                                                        {formData.background.education && formData.background.education !== '本科' && <div><span className="font-semibold text-indigo-800">学历：</span>{formData.background.education}</div>}
                                                        {formData.background.language && formData.background.language !== '英语-工作 (B2)' && <div><span className="font-semibold text-indigo-800">语言：</span>{formData.background.language}</div>}
                                                    </div>
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

                                            {/* Privacy Disclaimer */}
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                                                <Lock className="w-3 h-3 text-slate-400" /> 方案生成完毕后简历文件将自动删除，不会存储
                                            </p>

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
                                                disabled={loading || resumeUploading}
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
                                                    ) : resumeUploading ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                            等待简历上传...
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

                                {step < 4 && (
                                    <button
                                        onClick={nextStep}
                                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm shadow-indigo-300 hover:shadow-md hover:shadow-indigo-300 hover:-translate-y-0.5"
                                    >
                                        继续
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Demo / Generating / Plan ── */}
                        <div
                            className="lg:col-span-7 p-6 md:p-10 flex flex-col justify-center bg-white/50 backdrop-blur-2xl rounded-[24px] relative overflow-hidden group border border-white/50 shadow-sm transition-all hover:bg-white/60 min-h-[500px]"
                            onMouseEnter={() => !loading && setDemoPaused(true)}
                            onMouseLeave={() => setDemoPaused(false)}
                        >
                            {/* Hover overlay only when idle (no plan, not loading) */}
                            {!generatedPlan && !loading && (
                                <div className={`absolute inset-0 rounded-[22px] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 transition-all duration-300 ${demoPaused ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                    <div className="text-center">
                                        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                                            <Sparkles className="w-7 h-7 text-indigo-600" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 mb-1">填写左侧信息</p>
                                        <p className="text-xs text-slate-500">AI 将为你生成专属版本</p>
                                    </div>
                                </div>
                            )}

                            {generatedPlan ? (
                                <>
                                    <GeneratedPlanView
                                        plan={generatedPlan}
                                        isGuest={!isAuthenticated}
                                        isMember={isVIP}
                                        trackingSetupUrl={trackingSetupUrl}
                                        onRefreshRecommendations={handleRefreshRecommendations}
                                        refreshingRecommendations={refreshingRecommendations}
                                        onRefineMilestones={handleRefineMilestones}
                                        refiningMilestones={refiningMilestones}
                                        refineCount={generatedPlan.refineCount || 0}
                                        compactMode={true}
                                    />
                                    {isWizardCollapsed && (
                                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/95 to-transparent z-10 pointer-events-none rounded-b-[24px]" />
                                    )}
                                </>
                            ) : loading ? (
                                <GeneratingProgressPanel formData={formData} />
                            ) : (
                                <DemoPanel paused={demoPaused} isGenerating={false} />
                            )}
                        </div>

                    </div>
                </div>

                {/* Collapse button — appears after plan is generated */}
                {generatedPlan && (
                    <div className="flex justify-center pt-3 pb-1 relative z-20">
                        <button
                            onClick={() => setIsWizardCollapsed(c => !c)}
                            className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white/70 hover:bg-white/95 backdrop-blur-sm border border-white/50 rounded-full shadow-sm transition-all"
                        >
                            {isWizardCollapsed
                                ? <><ChevronDown className="w-3.5 h-3.5" />展开 Copilot</>
                                : <><ChevronUp className="w-3.5 h-3.5" />收起 Copilot</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
