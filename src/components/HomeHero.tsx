import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Sparkles, ArrowRight, Zap, Globe, Briefcase, Clock, Search, CheckCircle2, User, PlayCircle, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'

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
    background: {
        role: string
        years: string
    }
}

export default function HomeHero({ stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const { isAuthenticated, user } = useAuth()
    const { showWarning, showError } = useNotificationHelpers()
    
    // Copilot State
    const [loading, setLoading] = useState(false)
    const [loadingStep, setLoadingStep] = useState(0)
    const [formData, setFormData] = useState<CopilotFormData>({
        goal: 'full-time',
        timeline: 'immediately',
        background: { role: '', years: '' }
    })
    
    // Demo Animation State
    const [demoStep, setDemoStep] = useState(0)
    const [imageLoaded, setImageLoaded] = useState(false)

    // Demo Animation Cycle
    useEffect(() => {
        const interval = setInterval(() => {
            setDemoStep(prev => (prev + 1) % 4)
        }, 3000) // 3s per step for better readability
        return () => clearInterval(interval)
    }, [])

    const handleGenerate = async () => {
        if (!isAuthenticated) {
            showWarning('请先登录', '登录后即可免费使用 AI 远程求职助手')
            navigate('/login')
            return
        }

        if (!formData.background.role) {
            showWarning('请填写当前职位', 'AI 需要知道您的职业背景才能进行匹配')
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
                    background: {
                        industry: formData.background.role, // Mapping role to industry for backend compatibility
                        seniority: formData.background.years,
                        education: '', // Optional
                        language: ''   // Optional
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

            // Success - Redirect or Show Result
            // For Hero context, we redirect to a dedicated result view or anchor
            // Here we'll scroll to a "My Plan" section or navigate to dashboard
            // But since CopilotSection is removed, let's navigate to /dashboard/copilot if we had one
            // Or just reuse the result display logic if we want to keep it simple.
            // Let's scroll to "featured-jobs" for now and show a success toast, 
            // OR ideally, we should probably have a dedicated Copilot Page or Modal.
            // Given the constraints, let's navigate to '/jobs' with pre-filled filters as a "Plan"
            
            navigate(`/jobs?search=${encodeURIComponent(formData.background.role)}&type=${formData.goal === 'full-time' ? 'Full-time' : 'Contract'}`)
            
        } catch (err: any) {
            console.error(err)
            showError('服务暂时不可用', err.message)
        } finally {
            clearInterval(stepInterval)
            setLoading(false)
        }
    }

    return (
        <div className="relative min-h-[850px] flex items-center justify-center overflow-hidden bg-neutral-900">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`w-full h-full object-cover object-[0%_20%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-40' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-900/80 to-neutral-900/40"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    
                    {/* Left Column: Content & Copilot Form */}
                    <div className="lg:col-span-7 space-y-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-6 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
                                <Sparkles className="w-3.5 h-3.5" />
                                AI Remote Career Copilot
                            </div>
                            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-6 delay-100">
                                理想生活，<br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-300">
                                    从远程工作开始
                                </span>
                            </h1>
                            <p className="text-lg text-slate-300 mb-8 max-w-xl leading-relaxed font-light animate-in fade-in slide-in-from-bottom-8 delay-200">
                                不只是找工作。Haigoo Copilot 为您提供从简历评估、岗位匹配到面试策略的全流程 AI 辅助。
                            </p>
                        </div>

                        {/* Embedded Copilot Widget (Glassmorphism) */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 max-w-xl animate-in fade-in slide-in-from-bottom-10 delay-300 shadow-2xl shadow-black/20 relative overflow-hidden group">
                            {/* Decorative Glow */}
                            <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-colors duration-1000"></div>

                            <div className="relative space-y-6">
                                {/* Goal Selection */}
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                        <Briefcase className="w-4 h-4" /> 您的求职目标?
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
                                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                                    formData.goal === opt.id 
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Input Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                            <User className="w-4 h-4" /> 当前职位/角色
                                        </label>
                                        <input 
                                            type="text" 
                                            placeholder="例如: 产品经理, Java开发"
                                            value={formData.background.role}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> 工作年限
                                        </label>
                                        <select 
                                            value={formData.background.years}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, years: e.target.value}})}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm appearance-none cursor-pointer"
                                        >
                                            <option value="" className="bg-slate-800 text-slate-400">选择年限</option>
                                            <option value="Junior" className="bg-slate-800">1-3 年</option>
                                            <option value="Mid" className="bg-slate-800">3-5 年</option>
                                            <option value="Senior" className="bg-slate-800">5-8 年</option>
                                            <option value="Expert" className="bg-slate-800">8年 以上</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl py-4 font-bold transition-all shadow-xl shadow-indigo-900/20 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                    <div className="relative flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span className="text-sm">{['分析背景...', '全网扫描...', '生成策略...'][loadingStep]}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                立即生成远程求职方案
                                            </>
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Dynamic Demo Visual */}
                    <div className="hidden lg:block lg:col-span-5 relative">
                        {/* Abstract Device Frame */}
                        <div className="relative z-10 bg-slate-900/90 backdrop-blur-xl rounded-[2rem] border border-slate-700/50 shadow-2xl shadow-black/50 p-6 transform rotate-[-3deg] hover:rotate-0 transition-all duration-700 group">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                        AI
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">Haigoo Copilot</div>
                                        <div className="text-[10px] text-green-400 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                            Online
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 font-mono">v2.0 Beta</div>
                            </div>

                            {/* Dynamic Content Area */}
                            <div className="space-y-6 h-[320px] relative">
                                {/* Step 1: Analyze */}
                                <div className={`transition-all duration-700 absolute inset-0 ${demoStep === 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
                                    <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border-l-2 border-indigo-500">
                                        <div className="text-xs text-slate-400 mb-1">正在分析您的背景...</div>
                                        <div className="text-sm text-white font-medium flex items-center gap-2">
                                            <User className="w-4 h-4 text-indigo-400" />
                                            Senior Product Manager
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-2 bg-slate-800 rounded-full w-3/4 animate-pulse"></div>
                                        <div className="h-2 bg-slate-800 rounded-full w-1/2 animate-pulse delay-75"></div>
                                        <div className="flex gap-2 mt-4">
                                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded border border-blue-500/30">Strategy</span>
                                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30">SaaS</span>
                                            <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded border border-green-500/30">Agile</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2: Match */}
                                <div className={`transition-all duration-700 absolute inset-0 ${demoStep === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                                    <div className="text-xs text-slate-400 mb-3 flex justify-between">
                                        <span>匹配到 12 个高潜机会</span>
                                        <span className="text-indigo-400">100% Remote</span>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { role: 'Senior PM', company: 'Linear', match: '98%' },
                                            { role: 'Product Lead', company: 'Notion', match: '95%' },
                                            { role: 'Growth PM', company: 'Zapier', match: '92%' },
                                        ].map((job, i) => (
                                            <div key={i} className="bg-slate-800/80 p-3 rounded-xl border border-white/5 flex items-center justify-between group/item hover:bg-slate-700/80 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs text-white">
                                                        {job.company[0]}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-white font-bold">{job.role}</div>
                                                        <div className="text-[10px] text-slate-400">{job.company}</div>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                                                    {job.match}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Step 3: Plan */}
                                <div className={`transition-all duration-700 absolute inset-0 ${demoStep === 2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                                    <div className="text-center pt-8">
                                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-2">方案已生成</h3>
                                        <p className="text-slate-400 text-xs mb-6 px-8">
                                            包含简历优化建议、面试准备题库及 30 天投递计划
                                        </p>
                                        <button className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg font-medium shadow-lg shadow-indigo-600/30">
                                            立即查看
                                        </button>
                                    </div>
                                </div>

                                 {/* Step 4: Member (Optional/Loop) */}
                                 <div className={`transition-all duration-700 absolute inset-0 ${demoStep === 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
                                     <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-xl p-5 border border-indigo-500/30 h-full flex flex-col justify-center items-center text-center">
                                         <Lock className="w-10 h-10 text-indigo-400 mb-4" />
                                         <h4 className="text-white font-bold mb-2">解锁更多权益</h4>
                                         <ul className="text-xs text-slate-300 space-y-2 mb-6 text-left w-full px-4">
                                             <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-400"/> 无限次 AI 简历优化</li>
                                             <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-400"/> 每日自动匹配新职位</li>
                                             <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-400"/> 导师 1v1 咨询折扣</li>
                                         </ul>
                                         <div className="text-[10px] text-indigo-300">Haigoo Member Exclusive</div>
                                     </div>
                                 </div>
                            </div>
                            
                            {/* Footer Progress */}
                            <div className="mt-6 flex justify-between items-center gap-2">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= demoStep ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                                ))}
                            </div>
                        </div>

                        {/* Floating Blobs */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/30 rounded-full blur-[80px] animate-pulse"></div>
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/30 rounded-full blur-[80px] animate-pulse delay-1000"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}
