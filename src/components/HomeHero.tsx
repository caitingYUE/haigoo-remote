import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Sparkles, Briefcase, Clock, MessageSquare, ChevronUp, Star, Award, TrendingUp, Target, CalendarClock, GraduationCap, Languages, Upload, CheckCircle2, ArrowRight, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import { processedJobsService } from '../services/processed-jobs-service'
import type { Job } from '../types'

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
}

interface CopilotFormData {
    goal: 'full-time' | 'part-time' | 'freelance' | ''
    timeline: 'immediately' | '1-3 months' | '3-6 months' | 'flexible' | ''
    purpose: 'career-change' | 'remote-first' | 'income-up' | 'flexibility' | ''
    background: {
        role: string
        years: string
        education: string
        language: string
    }
}

export default function HomeHero({ stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated, user } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()
    
    // Copilot State
    const [loading, setLoading] = useState(false)
    const [loadingStep, setLoadingStep] = useState(0)
    const [formData, setFormData] = useState<CopilotFormData>({
        goal: 'full-time',
        timeline: 'immediately',
        purpose: 'remote-first',
        background: { role: '', years: 'Mid', education: 'Bachelor', language: 'Fluent' }
    })
    
    const inputRef = useRef<HTMLInputElement>(null)
    const [imageLoaded, setImageLoaded] = useState(false)
    const resumeInputRef = useRef<HTMLInputElement>(null)
    const [resumeFileName, setResumeFileName] = useState<string | null>(null)
    const [resumeUploading, setResumeUploading] = useState(false)
    const [resumeId, setResumeId] = useState<string | null>(null)
    const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([])
    const [jobsLoading, setJobsLoading] = useState(true)
    const [jobsError, setJobsError] = useState<string | null>(null)

    const handleGenerate = async () => {
        if (!isAuthenticated) {
            showWarning('请先登录', '登录后即可免费使用 AI 远程求职助手')
            navigate('/login')
            return
        }

        if (!formData.background.role) {
            showWarning('请填写当前职位', 'AI 需要知道您的职业背景才能进行匹配')
            inputRef.current?.focus()
            return
        }

        setLoading(true)
        
        // Simulate AI Processing Steps
        const steps = ['正在分析您的职业画像...', '正在扫描全球远程机会...', '正在生成个性化策略...']
        let stepIdx = 0
        setLoadingStep(0)
        
        const stepInterval = setInterval(() => {
            stepIdx = (stepIdx + 1) % steps.length
            setLoadingStep(stepIdx)
        }, 1200)

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
                    goal: formData.goal,
                    timeline: formData.timeline,
                    purpose: formData.purpose,
                    background: {
                        industry: formData.background.role, 
                        seniority: formData.background.years,
                        education: formData.background.education, 
                        language: formData.background.language,
                        purpose: formData.purpose
                    },
                    resumeId: resumeId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 403) {
                    showWarning('试用次数已用完', '请升级会员解锁无限次使用权限')
                    navigate('/membership')
                } else {
                    throw new Error(data.error || '生成失败')
                }
                return
            }
            
            navigate(`/jobs?search=${encodeURIComponent(formData.background.role)}&type=${formData.goal === 'full-time' ? 'Full-time' : 'Contract'}`)
            
        } catch (err: any) {
            console.error(err)
            showError('服务暂时不可用', err.message)
        } finally {
            clearInterval(stepInterval)
            setLoading(false)
        }
    }

    const handleResumeUpload = async (file: File) => {
        if (!isAuthenticated) {
            showWarning('请先登录', '登录后可上传简历并进行后续优化')
            navigate('/login')
            return
        }

        if (!file) return

        setResumeUploading(true)
        setResumeFileName(file.name)

        try {
            const token = localStorage.getItem('haigoo_auth_token')
            const formData = new FormData()
            formData.append('file', file)
            formData.append('metadata', JSON.stringify({ source: 'home_hero' }))

            const uploadResp = await fetch('/api/resumes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            const uploadResult = await uploadResp.json()
            if (!uploadResp.ok || !uploadResult.success) {
                throw new Error(uploadResult.error || '上传失败')
            }

            setResumeId(uploadResult.id || null)
            showSuccess('简历上传成功', '可在生成初版方案后继续优化简历')
        } catch (error: any) {
            console.error(error)
            showError('简历上传失败', error.message || '请稍后重试')
            setResumeFileName(null)
            setResumeId(null)
        } finally {
            setResumeUploading(false)
        }
    }

    useEffect(() => {
        let isMounted = true

        const loadRecommendedJobs = async () => {
            setJobsLoading(true)
            setJobsError(null)
            try {
                const featured = await processedJobsService.getProcessedJobs(1, 3, { isFeatured: true })
                const jobs = featured?.jobs?.length ? featured.jobs : (await processedJobsService.getProcessedJobs(1, 3)).jobs
                if (isMounted) {
                    setRecommendedJobs((jobs || []).slice(0, 3))
                }
            } catch (error: any) {
                if (isMounted) {
                    setJobsError(error?.message || '推荐岗位加载失败')
                    showError('推荐岗位获取失败', error?.message)
                }
            } finally {
                if (isMounted) {
                    setJobsLoading(false)
                }
            }
        }

        loadRecommendedJobs()
        return () => {
            isMounted = false
        }
    }, [showError])

    const formatSalary = (salary: Job['salary']) => {
        if (!salary) return '薪资面议'
        if (typeof salary === 'string') {
            if (salary === 'null' || salary === 'Open' || salary === 'Competitive' || salary === 'Unspecified' || salary === '0' || salary === '0-0') return '薪资面议'
            if (salary.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(salary)
                    if (parsed && typeof parsed === 'object') {
                        return formatSalary(parsed)
                    }
                } catch (e) {
                    return salary
                }
            }
            return salary
        }
        if (salary.min === 0 && salary.max === 0) return '薪资面议'
        const formatAmount = (amount: number) => {
            if (amount >= 10000) {
                return `${(amount / 10000).toFixed(1)}万`
            }
            return amount.toLocaleString()
        }
        const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : '€'
        if (salary.min === salary.max) {
            return `${currencySymbol}${formatAmount(salary.min)}`
        }
        return `${currencySymbol}${formatAmount(salary.min)}-${formatAmount(salary.max)}`
    }

    return (
        <div className="relative min-h-[900px] flex items-center justify-center overflow-hidden bg-slate-50">
            {/* Background - Bright & Future Feeling */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`w-full h-full object-cover object-[0%_20%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-30' : 'opacity-0'} blur-[2px]`}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-slate-50/70 to-white/90"></div>
                <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-indigo-400/10 blur-[120px]"></div>
                <div className="absolute top-10 left-[-10%] h-[420px] w-[420px] rounded-full bg-blue-400/10 blur-[110px]"></div>
                <div className="absolute bottom-[-20%] left-[20%] h-[520px] w-[520px] rounded-full bg-purple-400/10 blur-[140px]"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.12] mix-blend-soft-light"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    
                    {/* Left Column: Content & Form */}
                    <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-slate-200/70 text-slate-700 text-sm font-semibold mb-6 backdrop-blur-md shadow-sm">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span className="text-slate-700">AI 远程求职 Copilot 2.0</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                            理想生活，<br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600">
                                从远程工作开始
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal mb-10">
                            不只是找工作。Haigoo Copilot 为您提供从简历评估、岗位匹配到面试策略的全流程 AI 辅助。
                        </p>

                        {/* Mad Libs Style Form */}
                        <div className="bg-white/80 backdrop-blur-md border border-slate-200/70 rounded-3xl p-6 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_25px_70px_-12px_rgba(0,0,0,0.15)] transition-all duration-300">
                            <div className="text-xl md:text-2xl leading-relaxed font-medium text-slate-700 space-y-4">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                      <span>我拥有</span>
                      <div className="relative inline-block">
                        <select
                          value={formData.background.education}
                          onChange={(e) => setFormData({...formData, background: {...formData.background, education: e.target.value}})}
                          className="appearance-none cursor-pointer inline-block bg-transparent border-b-2 border-indigo-200 text-indigo-700 font-bold px-2 py-1 pr-8 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/30 transition-all rounded-t-md"
                        >
                          <option value="Bachelor">本科学历</option>
                          <option value="Master">硕士学历</option>
                          <option value="PhD">博士学历</option>
                          <option value="Associate">大专学历</option>
                          <option value="Other">其他学历</option>
                        </select>
                        <ChevronUp className="w-4 h-4 text-indigo-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                      </div>
                      <span>和</span>
                      <div className="relative inline-block">
                        <select
                          value={formData.background.language}
                          onChange={(e) => setFormData({...formData, background: {...formData.background, language: e.target.value}})}
                          className="appearance-none cursor-pointer inline-block bg-transparent border-b-2 border-indigo-200 text-indigo-700 font-bold px-2 py-1 pr-8 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/30 transition-all rounded-t-md"
                        >
                          <option value="Native">母语水平</option>
                          <option value="Fluent">流利沟通</option>
                          <option value="Intermediate">日常交流</option>
                          <option value="Basic">基础读写</option>
                        </select>
                        <ChevronUp className="w-4 h-4 text-indigo-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                      </div>
                      <span>英语能力。</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                      <span>希望能通过远程工作实现</span>
                      <div className="relative inline-block">
                        <select
                          value={formData.purpose}
                          onChange={(e) => setFormData({...formData, purpose: e.target.value as any})}
                          className="appearance-none cursor-pointer inline-block bg-transparent border-b-2 border-indigo-200 text-indigo-700 font-bold px-2 py-1 pr-8 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/30 transition-all rounded-t-md"
                        >
                          <option value="remote-first">远程优先生活</option>
                          <option value="income-up">收入提升</option>
                          <option value="career-change">职业转型</option>
                          <option value="flexibility">时间自由</option>
                          <option value="global-exposure">全球化视野</option>
                        </select>
                        <ChevronUp className="w-4 h-4 text-indigo-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                      </div>
                      <span>。</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                      <span>我正在寻找一份</span>
                                    <div className="relative inline-block group">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={formData.background.role}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                            placeholder="输入职位名称"
                                            className="inline-block w-[180px] bg-transparent border-b-2 border-indigo-200 text-indigo-700 font-bold px-2 py-1 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/30 transition-all placeholder:text-indigo-300 placeholder:font-normal rounded-t-md"
                                        />
                                        <span className="absolute -bottom-5 left-0 text-xs text-slate-400 opacity-0 group-focus-within:opacity-100 transition-opacity">例如：产品经理</span>
                                    </div>
                                    <span>工作，</span>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                                    <span>希望</span>
                                    <div className="relative inline-block">
                                        <select
                                            value={formData.timeline}
                                            onChange={(e) => setFormData({...formData, timeline: e.target.value as any})}
                                            className="appearance-none cursor-pointer inline-block bg-transparent border-b-2 border-indigo-200 text-indigo-700 font-bold px-2 py-1 pr-8 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/30 transition-all rounded-t-md"
                                        >
                                            <option value="immediately">尽快</option>
                                            <option value="1-3 months">1-3个月内</option>
                                            <option value="3-6 months">3-6个月内</option>
                                            <option value="flexible">时间灵活</option>
                                        </select>
                                        <ChevronUp className="w-4 h-4 text-indigo-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                                    </div>
                                    <span>入职。</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                                    <span>我的经验水平是</span>
                                    <div className="relative inline-block">
                                        <select
                                            value={formData.background.years}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, years: e.target.value}})}
                                            className="appearance-none cursor-pointer inline-block bg-transparent border-b-2 border-indigo-200 text-indigo-700 font-bold px-2 py-1 pr-8 focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/30 transition-all rounded-t-md"
                                        >
                                            <option value="Junior">初级 (1-3年)</option>
                                            <option value="Mid">中级 (3-5年)</option>
                                            <option value="Senior">资深 (5-8年)</option>
                                            <option value="Expert">专家 (8年以上)</option>
                                        </select>
                                        <ChevronUp className="w-4 h-4 text-indigo-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                                    </div>
                                    <span>，</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                                    <span>这是我的</span>
                                    <button
                                        type="button"
                                        onClick={() => resumeInputRef.current?.click()}
                                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border-2 border-dashed transition-all ${
                                            resumeFileName 
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700' 
                                            : 'border-indigo-200 bg-indigo-50/30 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {resumeFileName ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="font-bold truncate max-w-[150px]">{resumeFileName}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                <span className="font-bold underline decoration-dotted underline-offset-4">上传简历 (PDF/DOCX)</span>
                                            </>
                                        )}
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
                                    <span>。</span>
                                </div>
                            </div>

                            <div className="mt-10">
                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full md:w-auto px-8 py-4 bg-[#1A365D] hover:bg-[#2A4a7F] text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-indigo-900/10 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-white/10 to-indigo-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>{loadingStep === 0 ? '正在分析简历...' : loadingStep === 1 ? '匹配岗位中...' : '生成计划中...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            生成我的远程成功计划
                                        </>
                                    )}
                                </button>
                                <p className="mt-4 text-xs text-slate-500 text-center md:text-left">
                                    AI 驱动的简历评估与个性化岗位匹配引擎
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Glass Dashboard Visual */}
                    <div className="hidden lg:block relative h-[600px] w-full perspective-[2000px]">
                        <style>{`
                            @keyframes float-slow {
                                0%, 100% { transform: translateY(0px) rotateY(-12deg) rotateX(5deg); }
                                50% { transform: translateY(-20px) rotateY(-12deg) rotateX(5deg); }
                            }
                            .animate-float-slow {
                                animation: float-slow 8s ease-in-out infinite;
                            }
                        `}</style>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 rounded-full blur-[80px]"></div>
                        
                        {/* Main Floating Card */}
                        <div className="animate-float-slow absolute inset-0 bg-white/40 backdrop-blur-xl border border-white/60 rounded-[40px] shadow-[0_40px_100px_-20px_rgba(50,50,93,0.15)] p-6 flex flex-col gap-6 transition-all duration-700 ease-out transform-style-3d hover:shadow-[0_50px_120px_-20px_rgba(50,50,93,0.2)]">
                            
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#1A365D] flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-900/20">H</div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">我的远程成功计划</div>
                                        <div className="text-xs text-slate-500">85% 已完成</div>
                                    </div>
                                </div>
                                <div className="h-2 w-24 bg-white/50 rounded-full overflow-hidden border border-white/20">
                                    <div className="h-full w-[85%] bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                </div>
                            </div>

                            {/* Top Row Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Priorities Card */}
                                <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-white/50 space-y-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">今日优先级</div>
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <div className="mt-0.5 w-4 h-4 rounded bg-indigo-500 flex items-center justify-center text-white">
                                                <CheckCircle2 className="w-3 h-3" />
                                            </div>
                                            <div className="text-xs font-medium text-slate-700 leading-snug">查看 "Product Manager at Linear"</div>
                                        </div>
                                        <div className="flex items-start gap-2 opacity-50">
                                            <div className="mt-0.5 w-4 h-4 rounded border border-slate-300"></div>
                                            <div className="text-xs font-medium text-slate-700 leading-snug">准备行为面试问题</div>
                                        </div>
                                        <div className="flex items-start gap-2 opacity-50">
                                            <div className="mt-0.5 w-4 h-4 rounded border border-slate-300"></div>
                                            <div className="text-xs font-medium text-slate-700 leading-snug">优化 LinkedIn 个人资料</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Card */}
                                <div className="bg-white/80 rounded-2xl p-4 shadow-sm border border-white/50 space-y-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">岗位匹配进度</div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                                                <span>简历评分</span>
                                                <span>92/100</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full w-[92%] bg-emerald-500 rounded-full"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                                                <span>技能匹配</span>
                                                <span>88%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full w-[88%] bg-indigo-500 rounded-full"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                                                <span>文化契合</span>
                                                <span>90%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full w-[90%] bg-purple-500 rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recommended Roles Section */}
                            <div className="bg-white/60 rounded-2xl p-4 shadow-sm border border-white/50 flex-1 overflow-hidden flex flex-col">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">推荐岗位</div>
                                <div className="space-y-3 flex-1 overflow-hidden relative">
                                    {jobsLoading ? (
                                        // Loading Skeletons
                                        [1, 2, 3].map(i => (
                                            <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-white/50 border border-white/60">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse"></div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse"></div>
                                                    <div className="h-2 w-1/2 bg-slate-100 rounded animate-pulse"></div>
                                                </div>
                                            </div>
                                        ))
                                    ) : recommendedJobs.length > 0 ? (
                                        // Real Jobs
                                        recommendedJobs.map((job) => (
                                            <div key={job.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/80 border border-white/60 shadow-sm hover:scale-[1.02] transition-transform cursor-default">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                    <Briefcase className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-800 truncate">{job.title}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{job.company || 'Unknown'} · {formatSalary(job.salary)}</div>
                                                </div>
                                                <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                    95%
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        // Fallback if no jobs
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                                            <Search className="w-6 h-6 opacity-50" />
                                            <span>暂无推荐岗位</span>
                                        </div>
                                    )}
                                    {/* Fade at bottom */}
                                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white/60 to-transparent pointer-events-none"></div>
                                </div>
                            </div>
                        </div>

                        {/* Decorative Elements */}
                        <div className="absolute -right-10 top-20 w-24 h-24 bg-purple-400 rounded-2xl rotate-12 blur-2xl opacity-40 animate-pulse"></div>
                        <div className="absolute -left-5 bottom-10 w-32 h-32 bg-indigo-400 rounded-full blur-3xl opacity-30 animate-pulse delay-700"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}