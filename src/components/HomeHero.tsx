import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Sparkles, Upload, CheckCircle2, ArrowRight, ArrowLeft,
    Target, TrendingUp, Eye, RefreshCw, ChevronDown
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
}

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
function DemoPanel({ paused }: { paused: boolean }) {
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
        { name: 'GitLab', logo: 'gitlab.com', role: '高级 PM' },
        { name: 'Figma', logo: 'figma.com', role: '增长 PM' },
        { name: 'Notion', logo: 'notion.so', role: '产品运营' },
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
                        林晓的远程求职方案
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">UI 设计师 · 4 年经验 · 英语 B2</p>
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
        color: 'emerald',
    },
    {
        value: 'market-watch' as GoalType,
        icon: <Eye className="w-5 h-5" />,
        label: '关注市场机会',
        desc: '观望市场，等待合适时机',
        color: 'amber',
    },
    {
        value: 'career-pivot' as GoalType,
        icon: <RefreshCw className="w-5 h-5" />,
        label: '职业转型',
        desc: '转换赛道，向新方向发展',
        color: 'rose',
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function HomeHero({ stats: _stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated, user } = useAuth()
    const { showWarning, showError } = useNotificationHelpers()

    // Wizard state
    const [step, setStep] = useState(0) // 0-3
    const [direction, setDirection] = useState<'forward' | 'back'>('forward')
    const [animating, setAnimating] = useState(false)

    const [formData, setFormData] = useState<CopilotFormData>({
        goal: '',
        timeline: '',
        background: { role: '', years: '中级', education: '本科', language: '英语' }
    })

    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const resumeInputRef = useRef<HTMLInputElement>(null)
    const [resumeFileName, setResumeFileName] = useState<string | null>(null)
    const [resumeUploading, setResumeUploading] = useState(false)
    const [resumeId, setResumeId] = useState<string | null>(null)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [demoPaused, setDemoPaused] = useState(false)

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
        if (!isAuthenticated) {
            showWarning('请先登录', '登录后即可免费生成一次 AI 远程求职方案')
            navigate('/login')
            return
        }
        if (!formData.background.role.trim()) {
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
                    'Authorization': `Bearer ${token}`
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
                if (res.status === 403) {
                    showWarning('免费次数已用完', '免费用户可生成一次方案，升级会员解锁无限次使用')
                    navigate('/membership')
                } else {
                    throw new Error(data.error || '生成失败')
                }
                return
            }

            const typeParam = formData.goal === 'side-income' ? 'Part-time'
                : formData.goal === 'full-time' ? 'Full-time'
                    : 'Full-time'
            navigate(`/jobs?search=${encodeURIComponent(formData.background.role)}&type=${typeParam}`)
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

    const STEPS = ['选择目标', '规划时间', '职业背景', '生成方案']

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-50 pt-32 pb-20">

            {/* ── Background ── */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <img
                    src="/src/pic2.webp"
                    alt="Haigoo Hero Background"
                    className={`absolute inset-0 w-full h-full object-cover object-[center_20%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                {/* Gradient Overlay for text readability and premium feel */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/70 to-slate-50/90" />
                
                {/* Subtle Noise Texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                
                {/* Aurora blobs - Adjusted for premium feel */}
                <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-indigo-200/20 blur-[120px] animate-[blobFloat_12s_ease-in-out_infinite]" />
                <div className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full bg-purple-200/15 blur-[120px] animate-[blobFloat_16s_ease-in-out_infinite_reverse] [animation-delay:4s]" />
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">

                {/* ── Hero Text ── */}
                <div className="text-center mb-12 max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-[68px] font-bold text-slate-900 mb-5 leading-[1.1] tracking-tight">
                        理想生活，<br className="hidden sm:block" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-500 to-purple-600">
                            从远程工作开始
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 max-w-4xl mx-auto leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis">
                        不只是找工作 — Haigoo 陪你走好从规划准备、投递面试到适应远程生活的每一步。
                    </p>

                    {/* Trust Chips */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                        {[
                            '✓ 1k+ 国内可申的真实远程机会',
                            '✓ 500+ 精选远程企业',
                            '✓ 5k+ 远程同行人',
                        ].map((chip) => (
                            <span key={chip} className="px-3 py-1 text-xs font-medium text-slate-600 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm">
                                {chip}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Main Panel ── */}
                <div className="w-full max-w-6xl bg-white/70 backdrop-blur-xl border border-white/80 rounded-[32px] shadow-[0_24px_80px_-20px_rgba(99,102,241,0.12),0_8px_32px_-8px_rgba(0,0,0,0.06)] p-2 md:p-3">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-2 min-h-[600px]">

                        {/* ── Left: Wizard ── */}
                        <div className="lg:col-span-5 bg-white/90 rounded-[24px] p-7 md:p-9 flex flex-col border border-white/60 shadow-sm relative overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm border border-slate-100 flex-shrink-0">
                                    <img src="/copilot.webp" alt="Copilot" className="w-full h-full object-cover scale-110" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Haigoo 远程助手</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">告诉我你的情况，AI 为你定制方案</p>
                                </div>
                            </div>

                            {/* Step Indicator */}
                            <div className="flex items-center gap-1.5 mb-7">
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
                                                            <div className="text-xs font-bold leading-tight mb-0.5">{opt.label}</div>
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
                                            <p className="text-sm font-semibold text-slate-700">
                                                上传简历（可选）让 AI 诊断更精准
                                            </p>

                                            {/* Resume Upload */}
                                            <button
                                                type="button"
                                                onClick={() => resumeInputRef.current?.click()}
                                                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-all group ${resumeFileName
                                                        ? 'border-emerald-300 bg-emerald-50'
                                                        : 'border-dashed border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${resumeFileName ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 group-hover:text-indigo-500 border border-slate-200'
                                                        }`}>
                                                        {resumeUploading ? (
                                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                        ) : resumeFileName ? (
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        ) : (
                                                            <Upload className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className={`text-sm font-bold ${resumeFileName ? 'text-emerald-800' : 'text-slate-600'}`}>
                                                            {resumeFileName ? '简历已上传 ✓' : '上传简历（可选）'}
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-0.5">
                                                            {resumeFileName ? resumeFileName : '支持 PDF / Word · AI 自动分析'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {!resumeFileName && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />}
                                            </button>
                                            <input
                                                ref={resumeInputRef}
                                                type="file"
                                                accept=".pdf,.doc,.docx,.txt"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleResumeUpload(file)
                                                }}
                                            />

                                            {/* Free tier note */}
                                            <div className="flex items-start gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                                <div>
                                                    <span className="font-semibold text-amber-700">免费用户可生成 1 次</span> 完整 AI 方案。
                                                    简历上传诊断、无限生成等高级功能需
                                                    <button onClick={() => navigate('/membership')} className="underline text-amber-600 ml-0.5">升级会员</button>。
                                                </div>
                                            </div>

                                            {/* Generate CTA */}
                                            <button
                                                onClick={handleGenerate}
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
                                                            生成我的远程求职方案
                                                        </>
                                                    )}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Navigation Buttons */}
                            <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
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
                                    >
                                        继续
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Right: Demo ── */}
                        <div
                            className="lg:col-span-7 p-5 md:p-8 flex flex-col justify-center bg-gradient-to-br from-slate-50/60 to-indigo-50/30 rounded-[22px] relative overflow-hidden group"
                            onMouseEnter={() => setDemoPaused(true)}
                            onMouseLeave={() => setDemoPaused(false)}
                        >
                            {/* Hover overlay */}
                            <div className={`absolute inset-0 rounded-[22px] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 transition-all duration-300 ${demoPaused ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                <div className="text-center">
                                    <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                                        <Sparkles className="w-7 h-7 text-indigo-600" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mb-1">填写左侧信息</p>
                                    <p className="text-xs text-slate-500">AI 将为你生成专属版本</p>
                                </div>
                            </div>

                            <DemoPanel paused={demoPaused} />
                        </div>

                    </div>
                </div>

                {/* Scroll hint */}
                <div className="mt-10 flex flex-col items-center gap-1.5 text-slate-400">
                    <span className="text-xs font-medium">查看精选岗位</span>
                    <ChevronDown className="w-4 h-4 animate-bounce" />
                </div>
            </div>
        </div>
    )
}
