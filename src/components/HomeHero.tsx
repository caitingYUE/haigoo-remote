import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Sparkles, ArrowRight, Zap, Globe, Briefcase, Clock, Search, CheckCircle2, User, PlayCircle, Lock, MessageSquare } from 'lucide-react'
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
        }, 3000) 
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
                <div className="flex flex-col items-center justify-center text-center">
                    
                    {/* Centered Hero Content */}
                    <div className="max-w-4xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-6 backdrop-blur-md">
                            <Sparkles className="w-3.5 h-3.5" />
                            AI Remote Career Copilot
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                            理想生活，<br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-300">
                                从远程工作开始
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-light">
                            不只是找工作。Haigoo Copilot 为您提供从简历评估、岗位匹配到面试策略的全流程 AI 辅助。
                        </p>
                    </div>

                    {/* Copilot Floating Widget (Glassmorphism + Stacking) */}
                    <div className="relative w-full max-w-2xl mx-auto group perspective-1000">
                         {/* Back Layer - Decorative Elements (Irregular Shapes) */}
                         <div className="absolute -top-12 -left-12 w-24 h-24 bg-purple-500/30 rounded-full blur-xl animate-pulse"></div>
                         <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-indigo-500/30 rounded-full blur-xl animate-pulse delay-700"></div>

                         {/* Main Glass Card */}
                         <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl shadow-black/40 transform transition-transform duration-500 hover:scale-[1.02]">
                             <div className="flex flex-col md:flex-row gap-2">
                                 {/* Input Area */}
                                 <div className="flex-1 bg-black/20 rounded-xl px-4 py-3 flex items-center gap-3 border border-white/5 focus-within:border-indigo-500/50 focus-within:bg-black/30 transition-all">
                                     <MessageSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                                     <input 
                                        type="text" 
                                        placeholder="告诉 Copilot 您的当前职位 (例如: 产品经理)" 
                                        className="w-full bg-transparent border-none text-white placeholder:text-slate-400 focus:ring-0 text-base"
                                        value={formData.background.role}
                                        onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                     />
                                 </div>
                                 
                                 {/* Generate Button */}
                                 <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
                                 >
                                    {loading ? (
                                        <>
                                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                           <span className="text-sm">思考中...</span>
                                        </>
                                    ) : (
                                        <>
                                           <Sparkles className="w-4 h-4" />
                                           生成求职方案
                                        </>
                                    )}
                                 </button>
                             </div>
                             
                             {/* Optional Quick Tags */}
                             <div className="flex gap-2 mt-3 px-2 pb-1 overflow-x-auto no-scrollbar">
                                 {['Product Manager', 'React Developer', 'Designer', 'Marketing'].map(tag => (
                                     <button 
                                        key={tag}
                                        onClick={() => setFormData({...formData, background: {...formData.background, role: tag}})}
                                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/5 transition-colors whitespace-nowrap"
                                     >
                                         {tag}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         
                         {/* Stacked Preview Cards (Hinting at results) */}
                         <div className="absolute -z-10 top-full left-4 right-4 h-12 bg-white/5 border border-white/10 rounded-b-2xl mx-4 transform -translate-y-2 opacity-60 backdrop-blur-sm"></div>
                         <div className="absolute -z-20 top-full left-8 right-8 h-12 bg-white/5 border border-white/10 rounded-b-2xl mx-8 transform -translate-y-4 opacity-30 backdrop-blur-sm"></div>

                    </div>
                </div>
            </div>
        </div>
    )
}
