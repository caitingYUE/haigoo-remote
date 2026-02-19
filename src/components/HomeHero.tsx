import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Sparkles, ArrowRight, Zap, Globe, Briefcase, Clock, Search, CheckCircle2, User, PlayCircle, Lock, MessageSquare, ChevronDown, ChevronUp, Star, Award, TrendingUp } from 'lucide-react'
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
    const [isExpanded, setIsExpanded] = useState(false)
    const [formData, setFormData] = useState<CopilotFormData>({
        goal: 'full-time',
        timeline: 'immediately',
        background: { role: '', years: '' }
    })
    
    const inputRef = useRef<HTMLInputElement>(null)
    const [imageLoaded, setImageLoaded] = useState(false)

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
                    background: {
                        industry: formData.background.role, 
                        seniority: formData.background.years,
                        education: '', 
                        language: ''   
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

    return (
        <div className="relative min-h-[900px] flex items-center justify-center overflow-hidden bg-slate-50">
            {/* Background - Bright & Future Feeling */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`w-full h-full object-cover object-[0%_20%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-15' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/70 to-white"></div>
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
                            <span className="text-slate-700">AI Remote Career Copilot 2.0</span>
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
                            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[320px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
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
                                     {['Product Manager', 'React Developer', 'Designer', 'Marketing'].map(tag => (
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
                            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4 text-center">真实案例</p>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
                                 {[
                                     { role: "Senior Java Dev", company: "Atlassian", salary: "$120k", badge: "Remote" },
                                     { role: "Product Designer", company: "Linear", salary: "$90k", badge: "Async" },
                                     { role: "Growth Manager", company: "Zapier", salary: "$110k", badge: "Global" }
                                 ].map((item, i) => (
                                    <div key={i} className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all cursor-default group">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                                            {i === 0 ? <Award className="w-5 h-5 text-amber-500" /> : i === 1 ? <Star className="w-5 h-5 text-indigo-500" /> : <TrendingUp className="w-5 h-5 text-emerald-500" />}
                                         </div>
                                         <div className="text-left">
                                            <div className="text-sm font-bold text-slate-800 leading-tight">{item.role}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                 <span>{item.company}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="text-indigo-600">{item.salary}</span>
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
