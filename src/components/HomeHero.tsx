import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { Sparkles, ChevronUp, Upload, CheckCircle2, ArrowRight, Calendar, User, Briefcase, FileText } from 'lucide-react'
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
    goal: 'full-time' | 'part-time' | 'freelance' | 'internship' | ''
    timeline: 'immediately' | '1-3 months' | '3-6 months' | 'flexible' | ''
    background: {
        role: string
        years: string
        education: string
        language: string
    }
}

export default function HomeHero({ stats }: HomeHeroProps) {
    // console.log(stats) // stats is available but currently unused in this design
    const navigate = useNavigate()
    const { isAuthenticated, user } = useAuth()
    const { showWarning, showError, showSuccess } = useNotificationHelpers()
    
    // Copilot State
    const [loading, setLoading] = useState(false)
    const [loadingStep, setLoadingStep] = useState(0)
    const [formData, setFormData] = useState<CopilotFormData>({
        goal: 'full-time',
        timeline: 'immediately',
        background: { role: '', years: 'Mid', education: 'Bachelor', language: 'English' }
    })
    
    const inputRef = useRef<HTMLInputElement>(null)
    const [imageLoaded, setImageLoaded] = useState(false)
    const resumeInputRef = useRef<HTMLInputElement>(null)
    const [resumeFileName, setResumeFileName] = useState<string | null>(null)
    const [resumeUploading, setResumeUploading] = useState(false)
    const [resumeId, setResumeId] = useState<string | null>(null)

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
                        education: formData.background.education, 
                        language: formData.background.language,
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
            
            // Construct navigation URL with robust filter mapping
            let typeParam = 'Full-time'
            if (formData.goal === 'part-time') typeParam = 'Part-time'
            if (formData.goal === 'freelance') typeParam = 'Freelance' // Or Contract depending on DB
            if (formData.goal === 'internship') typeParam = 'Internship'

            navigate(`/jobs?search=${encodeURIComponent(formData.background.role)}&type=${typeParam}`)
            
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

    return (
        <div className="relative min-h-[900px] flex flex-col items-center justify-center overflow-hidden bg-slate-50 pt-40 pb-20">
            {/* Background - Soft Gradient & Image */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${imageLoaded ? 'opacity-30' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-white/40"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-slate-50"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                {/* Centered Title Section */}
                <div className="text-center mb-16 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight tracking-tight font-sans">
                        理想生活，从远程工作开始
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium tracking-wide">
                        全球精选 <span className="mx-2 text-slate-300">|</span> 人工逐条审核 <span className="mx-2 text-slate-300">|</span> 仅收录国人可申岗位
                    </p>
                </div>

                {/* Main Glass Panel */}
                <div className="w-full max-w-6xl bg-white/60 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] p-2 md:p-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-2">
                        {/* Left Side: Input Form */}
                        <div className="lg:col-span-5 bg-white/80 rounded-[24px] p-8 md:p-10 flex flex-col justify-center border border-white/50 shadow-sm relative overflow-hidden">
                            <div className="flex flex-col mb-8">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm border border-slate-100">
                                        <img src="/copilot.webp" alt="Copilot" className="w-full h-full object-cover scale-110" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Haigoo 远程工作助手</h2>
                                </div>
                                <p className="text-base text-slate-500 leading-relaxed font-medium">Haigoo 为您提供全流程辅助，从简历优化到远程工作的每一步</p>
                            </div>

                            <div className="space-y-8">
                                <div className="text-lg leading-loose text-slate-700 font-medium">
                                    我希望寻找一份
                                    <span className="relative inline-block mx-1.5 align-middle">
                                        <select
                                            value={formData.goal}
                                            onChange={(e) => setFormData({...formData, goal: e.target.value as any})}
                                            className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold py-1 px-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-indigo-100 transition-colors"
                                        >
                                            <option value="full-time">全职远程</option>
                                            <option value="part-time">兼职/副业</option>
                                            <option value="freelance">自由职业</option>
                                            <option value="internship">实习/入门</option>
                                        </select>
                                        <ChevronUp className="w-4 h-4 text-indigo-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none rotate-180" />
                                    </span>
                                    工作，
                                    <br className="hidden md:block" />
                                    预期
                                    <span className="relative inline-block mx-1.5 align-middle">
                                        <select
                                            value={formData.timeline}
                                            onChange={(e) => setFormData({...formData, timeline: e.target.value as any})}
                                            className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold py-1 px-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-indigo-100 transition-colors"
                                        >
                                            <option value="immediately">尽快</option>
                                            <option value="1-3 months">1-3个月内</option>
                                            <option value="3-6 months">3-6个月内</option>
                                            <option value="flexible">随时</option>
                                        </select>
                                        <ChevronUp className="w-4 h-4 text-indigo-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none rotate-180" />
                                    </span>
                                    入职。
                                    <br />
                                    我的专业领域是
                                    <span className="relative inline-block mx-1.5 align-middle w-32 md:w-40">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={formData.background.role}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                            placeholder="如: 产品经理"
                                            className="w-full bg-white border-b-2 border-slate-200 text-slate-900 font-bold py-1 px-1 focus:outline-none focus:border-indigo-500 transition-colors placeholder:font-normal placeholder:text-slate-400 text-center"
                                        />
                                    </span>
                                    ，
                                    <br className="hidden md:block" />
                                    具备
                                    <span className="relative inline-block mx-1.5 align-middle">
                                        <select
                                            value={formData.background.language}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, language: e.target.value}})}
                                            className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold py-1 px-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-indigo-100 transition-colors"
                                        >
                                            <option value="English">英语</option>
                                            <option value="Japanese">日语</option>
                                            <option value="Chinese">中文</option>
                                            <option value="Other">其他语言</option>
                                        </select>
                                        <ChevronUp className="w-4 h-4 text-indigo-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none rotate-180" />
                                    </span>
                                    工作能力。
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={() => resumeInputRef.current?.click()}
                                        className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all group ${
                                            resumeFileName 
                                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' 
                                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${resumeFileName ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600'} transition-colors`}>
                                                {resumeFileName ? <CheckCircle2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                                            </div>
                                            <div className="text-left">
                                                <div className={`font-bold text-sm ${resumeFileName ? 'text-emerald-800' : 'text-slate-700'}`}>
                                                    {resumeFileName ? '简历已上传' : '上传我的简历'}
                                                </div>
                                                <div className={`text-xs ${resumeFileName ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {resumeFileName ? resumeFileName : '支持 PDF / Word 格式，AI 自动分析匹配'}
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
                                </div>

                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full py-4 bg-slate-900 hover:bg-black text-white font-bold text-lg rounded-xl transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>正在分析您的职业画像...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 text-indigo-400" />
                                            生成我的远程求职方案
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Right Side: Realistic Demo */}
                        <div className="lg:col-span-7 p-6 md:p-10 flex flex-col justify-center bg-slate-50/50">
                            <div className="bg-white rounded-2xl p-8 shadow-[0_2px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100/50 relative overflow-hidden">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50/50 to-transparent rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>

                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">AI Copilot Demo</div>
                                        <h3 className="text-xl font-bold text-slate-900">张伟的远程产品经理晋升路线</h3>
                                    </div>
                                    <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100 flex items-center gap-1.5">
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        匹配度 92%
                                    </div>
                                </div>
                                
                                <div className="space-y-6 relative">
                                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-100"></div>

                                    {/* Step 1 */}
                                    <div className="relative pl-12 group">
                                        <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center font-bold text-sm border-2 border-indigo-50 shadow-sm z-10 group-hover:border-indigo-500 transition-colors">1</div>
                                        <h4 className="font-bold text-slate-800 text-base mb-1">简历竞争力诊断与优化</h4>
                                        <p className="text-sm text-slate-500 mb-3">检测到您的简历缺少 "SaaS Metrics" 相关数据支撑，建议补充 ARR/Churn Rate 等量化指标。</p>
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex gap-3">
                                            <div className="h-full w-1 bg-indigo-400 rounded-full"></div>
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold text-slate-700">优化建议：</div>
                                                <div className="text-xs text-slate-500">"负责产品迭代" → "主导核心功能重构，将用户留存率提升 15%"</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="relative pl-12 group">
                                        <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white text-slate-400 flex items-center justify-center font-bold text-sm border-2 border-slate-100 shadow-sm z-10 group-hover:border-indigo-500 group-hover:text-indigo-600 transition-colors">2</div>
                                        <h4 className="font-bold text-slate-800 text-base mb-1">目标岗位精准推送</h4>
                                        <p className="text-sm text-slate-500 mb-3">基于您的 3 年电商经验，为您筛选出 5 家正在招聘远程 PM 的出海/外企。</p>
                                        <div className="flex gap-2 overflow-hidden">
                                            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm flex items-center gap-1.5">
                                                <img src="https://logo.clearbit.com/shopify.com" className="w-3 h-3 rounded-full opacity-70" onError={(e) => e.currentTarget.style.display='none'} />
                                                Shopify
                                            </div>
                                            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm flex items-center gap-1.5">
                                                <img src="https://logo.clearbit.com/deel.com" className="w-3 h-3 rounded-full opacity-70" onError={(e) => e.currentTarget.style.display='none'} />
                                                Deel
                                            </div>
                                            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                                                +3 More
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="relative pl-12 opacity-70 group">
                                        <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white text-slate-300 flex items-center justify-center font-bold text-sm border-2 border-slate-100 shadow-sm z-10 group-hover:border-indigo-200 transition-colors">3</div>
                                        <h4 className="font-bold text-slate-800 text-base mb-1">面试全真模拟 (英语/中文)</h4>
                                        <p className="text-sm text-slate-500">针对 "Behavioral Question" 进行 1v1 模拟，提供 STAR 法则回答范例。</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
