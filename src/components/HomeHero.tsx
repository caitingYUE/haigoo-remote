import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Sparkles, Briefcase, Clock, MessageSquare, ChevronUp, Star, Award, TrendingUp, Target, CalendarClock, GraduationCap, Languages, Upload } from 'lucide-react'
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
    const [isExpanded, setIsExpanded] = useState(false)
    const [formData, setFormData] = useState<CopilotFormData>({
        goal: 'full-time',
        timeline: 'immediately',
        purpose: 'remote-first',
        background: { role: '', years: '', education: '', language: '' }
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

    // Handle Input Focus to Expand
    const handleInputFocus = () => {
        setIsExpanded(true)
    }

    // Click outside to collapse if empty (optional, but good UX)
    // For now, we keep it simple: manual collapse or just stay expanded

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
                    }
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
                    className={`w-full h-full object-cover object-[0%_20%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-30' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-slate-50/60 to-white"></div>
                <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-indigo-400/10 blur-[120px]"></div>
                <div className="absolute top-10 left-[-10%] h-[420px] w-[420px] rounded-full bg-blue-400/10 blur-[110px]"></div>
                <div className="absolute bottom-[-20%] left-[20%] h-[520px] w-[520px] rounded-full bg-purple-400/10 blur-[140px]"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.12] mix-blend-soft-light"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-10">
                <div className="flex flex-col items-center justify-center text-center">
                    
                    {/* Centered Hero Content */}
                    <div className="max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-slate-200/70 text-slate-700 text-sm font-semibold mb-8 backdrop-blur-md shadow-sm">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span className="text-slate-700">AI 远程求职 Copilot 2.0</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                            理想生活，<br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600">
                                从远程工作开始
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
                            不只是找工作。Haigoo Copilot 为您提供从简历评估、岗位匹配到面试策略的全流程 AI 辅助。
                        </p>
                    </div>

                    {/* Copilot Floating Widget (Expandable) */}
                    <div className={`relative w-full max-w-2xl mx-auto group transition-all duration-500 ${isExpanded ? 'scale-100' : 'scale-[0.98]'}`}>
                         
                         {/* Main Glass Card */}
                         <div className={`relative bg-white/85 backdrop-blur-xl border border-slate-200/70 rounded-3xl p-3 shadow-[0_40px_120px_rgba(15,23,42,0.18)] transition-all duration-500 overflow-hidden ${isExpanded ? 'bg-white/95 border-slate-200 ring-1 ring-indigo-500/10' : ''}`}>
                             
                             {/* Input Row */}
                             <div className="flex flex-col md:flex-row gap-3">
                                 {/* Input Area */}
                                 <div className="flex-1 bg-white rounded-2xl px-5 py-4 flex items-center gap-4 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-sm">
                                     <MessageSquare className={`w-6 h-6 shrink-0 transition-colors ${isExpanded ? 'text-indigo-500' : 'text-slate-400'}`} />
                                     <input 
                                        ref={inputRef}
                                        type="text" 
                                        placeholder="告诉 Copilot 您的当前职位 (例如: 产品经理)" 
                                        className="w-full bg-transparent border-none text-slate-900 placeholder:text-slate-400 focus:ring-0 text-lg font-semibold"
                                        value={formData.background.role}
                                        onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                        onFocus={handleInputFocus}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                     />
                                     {isExpanded && (
                                         <button 
                                            onClick={() => setIsExpanded(false)}
                                            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                         >
                                             <ChevronUp className="w-5 h-5" />
                                         </button>
                                     )}
                                 </div>
                                 
                                 {/* Generate Button (Desktop) */}
                                 <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="hidden md:flex px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/30 items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                                 >
                                    {loading ? (
                                        <>
                                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                           <span className="text-base">思考中...</span>
                                        </>
                                    ) : (
                                        <>
                                           <Sparkles className="w-5 h-5" />
                                           生成方案
                                        </>
                                    )}
                                 </button>
                             </div>

                             {/* Expanded Options Area */}
                            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[520px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                                 <div className="px-2 pb-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                     
                                     {/* Goal Selector */}
                                     <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <Briefcase className="w-4 h-4 text-indigo-500" /> 求职目标
                                         </label>
                                         <div className="flex flex-wrap gap-2">
                                             {[
                                                 { id: 'full-time', label: '长期全职' },
                                                 { id: 'part-time', label: '兼职副业' },
                                                 { id: 'freelance', label: '自由接单' }
                                             ].map(opt => (
                                                 <button
                                                     key={opt.id}
                                                     onClick={() => setFormData({...formData, goal: opt.id as any})}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                                                         formData.goal === opt.id 
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                                                     }`}
                                                 >
                                                     {opt.label}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>

                                     <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <Target className="w-4 h-4 text-indigo-500" /> 求职目的
                                         </label>
                                         <select 
                                             value={formData.purpose}
                                             onChange={(e) => setFormData({...formData, purpose: e.target.value as any})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer hover:border-slate-300"
                                         >
                                            <option value="remote-first">优先远程</option>
                                            <option value="income-up">提高收入</option>
                                            <option value="flexibility">时间自由</option>
                                            <option value="career-change">转型新方向</option>
                                         </select>
                                     </div>

                                     {/* Experience Selector */}
                                     <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-indigo-500" /> 工作年限
                                         </label>
                                         <select 
                                             value={formData.background.years}
                                             onChange={(e) => setFormData({...formData, background: {...formData.background, years: e.target.value}})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer hover:border-slate-300"
                                         >
                                            <option value="">选择年限</option>
                                            <option value="Junior">1-3 年</option>
                                            <option value="Mid">3-5 年</option>
                                            <option value="Senior">5-8 年</option>
                                            <option value="Expert">8年 以上</option>
                                         </select>
                                     </div>

                                     <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <CalendarClock className="w-4 h-4 text-indigo-500" /> 预期开始时间
                                         </label>
                                         <select 
                                             value={formData.timeline}
                                             onChange={(e) => setFormData({...formData, timeline: e.target.value as any})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer hover:border-slate-300"
                                         >
                                            <option value="immediately">马上开始</option>
                                            <option value="1-3 months">1-3 个月内</option>
                                            <option value="3-6 months">3-6 个月内</option>
                                            <option value="flexible">时间灵活</option>
                                         </select>
                                     </div>

                                     <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <GraduationCap className="w-4 h-4 text-indigo-500" /> 教育背景
                                         </label>
                                         <select 
                                             value={formData.background.education}
                                             onChange={(e) => setFormData({...formData, background: {...formData.background, education: e.target.value}})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer hover:border-slate-300"
                                         >
                                            <option value="">选择学历</option>
                                            <option value="High School">高中/中专</option>
                                            <option value="Associate">大专</option>
                                            <option value="Bachelor">本科</option>
                                            <option value="Master">硕士</option>
                                            <option value="PhD">博士</option>
                                         </select>
                                     </div>

                                     <div className="space-y-3">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <Languages className="w-4 h-4 text-indigo-500" /> 语言水平
                                         </label>
                                         <select 
                                             value={formData.background.language}
                                             onChange={(e) => setFormData({...formData, background: {...formData.background, language: e.target.value}})}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all text-sm appearance-none cursor-pointer hover:border-slate-300"
                                         >
                                            <option value="">选择语言水平</option>
                                            <option value="中文为主">中文为主</option>
                                            <option value="英语读写">英语读写</option>
                                            <option value="英语沟通">英语沟通</option>
                                            <option value="英语商务">英语商务</option>
                                         </select>
                                     </div>

                                     <div className="space-y-3 md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                            <Upload className="w-4 h-4 text-indigo-500" /> 简历上传（非必填）
                                         </label>
                                         <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => resumeInputRef.current?.click()}
                                                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all"
                                                disabled={resumeUploading}
                                            >
                                                {resumeUploading ? '正在上传...' : resumeFileName ? '重新上传简历' : '上传简历'}
                                            </button>
                                            <input
                                                ref={resumeInputRef}
                                                type="file"
                                                accept=".pdf,.doc,.docx,.txt"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        handleResumeUpload(file)
                                                    }
                                                }}
                                            />
                                            <div className="text-xs text-slate-500">
                                                {resumeFileName ? `${resumeFileName}${resumeId ? '（已存档）' : ''}` : '可在生成初版方案后继续补充简历优化'}
                                            </div>
                                         </div>
                                     </div>
                                 </div>
                                 
                                 {/* Mobile Generate Button */}
                                 <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="md:hidden w-full mt-4 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
                                 >
                                    {loading ? '思考中...' : '立即生成方案'}
                                 </button>
                             </div>
                             
                             {/* Quick Tags (Visible when collapsed) */}
                             {!isExpanded && (
                                 <div className="flex gap-2 mt-3 px-2 pb-1 overflow-x-auto no-scrollbar">
                                    {['产品经理', '前端开发', 'UI设计', '增长运营'].map(tag => (
                                         <button 
                                            key={tag}
                                            onClick={() => {
                                                setFormData({...formData, background: {...formData.background, role: tag}})
                                                setIsExpanded(true)
                                            }}
                                           className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-white text-xs text-slate-600 border border-slate-200 transition-colors whitespace-nowrap hover:border-slate-300"
                                         >
                                             {tag}
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>

                         {/* Case Demo Section (Under Input) */}
                         <div className={`mt-8 transition-all duration-700 delay-100 ${isExpanded ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4 text-center">推荐岗位</p>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
                                 {jobsLoading && (
                                     Array.from({ length: 3 }).map((_, i) => (
                                         <div key={`loading-${i}`} className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-pulse">
                                            <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                                            <div className="flex-1 space-y-2">
                                                <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                            </div>
                                         </div>
                                     ))
                                 )}
                                 {!jobsLoading && jobsError && (
                                     <div className="md:col-span-3 text-center text-sm text-slate-500">
                                         暂时无法获取推荐岗位
                                     </div>
                                 )}
                                 {!jobsLoading && !jobsError && recommendedJobs.length === 0 && (
                                     <div className="md:col-span-3 text-center text-sm text-slate-500">
                                         暂无推荐岗位
                                     </div>
                                 )}
                                 {!jobsLoading && !jobsError && recommendedJobs.map((job, i) => (
                                    <div key={job.id || `${job.company}-${job.title}-${i}`} className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/jobs/${job.id}`)}>
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                                            {i === 0 ? <Award className="w-5 h-5 text-amber-500" /> : i === 1 ? <Star className="w-5 h-5 text-indigo-500" /> : <TrendingUp className="w-5 h-5 text-emerald-500" />}
                                         </div>
                                         <div className="text-left">
                                            <div className="text-sm font-bold text-slate-800 leading-tight">{job.title || '职位未命名'}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                 <span>{job.company || '公司未命名'}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="text-indigo-600">{formatSalary(job.salary) || job.location || '薪资面议'}</span>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
