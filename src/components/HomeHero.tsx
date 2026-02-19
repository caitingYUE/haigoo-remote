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
        <div className="relative min-h-[900px] flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
            {/* Background - Bright & Future Feeling */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`w-full h-full object-cover object-[0%_20%] transition-opacity duration-1000 ${imageLoaded ? 'opacity-30' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                {/* Vivid Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-[#0a0a0a]/60 to-[#0a0a0a]"></div>
                
                {/* Aurora / Glow Effects */}
                <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
                <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-1000"></div>
                <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[80px] mix-blend-screen"></div>
                
                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-10">
                <div className="flex flex-col items-center justify-center text-center">
                    
                    {/* Centered Hero Content */}
                    <div className="max-w-4xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/90 text-sm font-medium mb-8 backdrop-blur-md shadow-lg shadow-indigo-500/20">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span className="bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent font-bold">AI Remote Career Copilot 2.0</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight drop-shadow-2xl">
                            理想生活，<br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-purple-300 filter drop-shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                                从远程工作开始
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-light">
                            不只是找工作。Haigoo Copilot 为您提供从简历评估、岗位匹配到面试策略的全流程 AI 辅助。
                        </p>
                    </div>

                    {/* Copilot Floating Widget (Expandable) */}
                    <div className={`relative w-full max-w-2xl mx-auto group perspective-1000 transition-all duration-500 ${isExpanded ? 'scale-100' : 'scale-95'}`}>
                         
                         {/* Main Glass Card */}
                         <div className={`relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-3 shadow-2xl shadow-black/50 transition-all duration-500 overflow-hidden ${isExpanded ? 'bg-white/15 border-white/30 ring-1 ring-white/20' : ''}`}>
                             
                             {/* Input Row */}
                             <div className="flex flex-col md:flex-row gap-3">
                                 {/* Input Area */}
                                 <div className="flex-1 bg-black/40 rounded-2xl px-5 py-4 flex items-center gap-4 border border-white/10 focus-within:border-indigo-500/50 focus-within:bg-black/50 transition-all shadow-inner">
                                     <MessageSquare className={`w-6 h-6 shrink-0 transition-colors ${isExpanded ? 'text-indigo-400' : 'text-slate-400'}`} />
                                     <input 
                                        ref={inputRef}
                                        type="text" 
                                        placeholder="告诉 Copilot 您的当前职位 (例如: 产品经理)" 
                                        className="w-full bg-transparent border-none text-white placeholder:text-slate-400 focus:ring-0 text-lg font-medium"
                                        value={formData.background.role}
                                        onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                        onFocus={handleInputFocus}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                     />
                                     {isExpanded && (
                                         <button 
                                            onClick={() => setIsExpanded(false)}
                                            className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                         >
                                             <ChevronUp className="w-5 h-5" />
                                         </button>
                                     )}
                                 </div>
                                 
                                 {/* Generate Button (Desktop) */}
                                 <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="hidden md:flex px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/30 items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
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
                             <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[300px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                                 <div className="px-2 pb-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                     
                                     {/* Goal Selector */}
                                     <div className="space-y-3">
                                         <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                             <Briefcase className="w-4 h-4 text-indigo-400" /> 求职目标
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
                                                     className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                                                         formData.goal === opt.id 
                                                         ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                                                         : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                                                     }`}
                                                 >
                                                     {opt.label}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>

                                     {/* Experience Selector */}
                                     <div className="space-y-3">
                                         <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                             <Clock className="w-4 h-4 text-purple-400" /> 工作年限
                                         </label>
                                         <select 
                                             value={formData.background.years}
                                             onChange={(e) => setFormData({...formData, background: {...formData.background, years: e.target.value}})}
                                             className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm appearance-none cursor-pointer hover:bg-white/10"
                                         >
                                             <option value="" className="bg-slate-900 text-slate-400">选择年限</option>
                                             <option value="Junior" className="bg-slate-900">1-3 年</option>
                                             <option value="Mid" className="bg-slate-900">3-5 年</option>
                                             <option value="Senior" className="bg-slate-900">5-8 年</option>
                                             <option value="Expert" className="bg-slate-900">8年 以上</option>
                                         </select>
                                     </div>
                                 </div>
                                 
                                 {/* Mobile Generate Button */}
                                 <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="md:hidden w-full mt-4 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
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
                                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/5 transition-colors whitespace-nowrap hover:border-white/20"
                                         >
                                             {tag}
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>

                         {/* Case Demo Section (Under Input) */}
                         <div className={`mt-8 transition-all duration-700 delay-100 ${isExpanded ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                             <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mb-4 text-center">Success Stories</p>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
                                 {[
                                     { role: "Senior Java Dev", company: "Atlassian", salary: "$120k", badge: "Remote" },
                                     { role: "Product Designer", company: "Linear", salary: "$90k", badge: "Async" },
                                     { role: "Growth Manager", company: "Zapier", salary: "$110k", badge: "Global" }
                                 ].map((item, i) => (
                                     <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 transition-colors cursor-default group">
                                         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-white/80 group-hover:scale-110 transition-transform">
                                             {i === 0 ? <Award className="w-5 h-5 text-yellow-400" /> : i === 1 ? <Star className="w-5 h-5 text-purple-400" /> : <TrendingUp className="w-5 h-5 text-green-400" />}
                                         </div>
                                         <div className="text-left">
                                             <div className="text-sm font-bold text-white leading-tight">{item.role}</div>
                                             <div className="text-xs text-slate-400 flex items-center gap-2">
                                                 <span>{item.company}</span>
                                                 <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                 <span className="text-indigo-300">{item.salary}</span>
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
