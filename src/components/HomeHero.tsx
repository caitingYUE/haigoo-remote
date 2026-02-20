import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { Sparkles, ChevronUp, Upload, CheckCircle2, ArrowRight } from 'lucide-react'
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
    purpose: 'career-change' | 'remote-first' | 'income-up' | 'flexibility' | ''
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
        purpose: 'remote-first',
        background: { role: '', years: 'Mid', education: 'Bachelor', language: 'Fluent' }
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

    return (
        <div className="relative min-h-[900px] flex flex-col items-center justify-center overflow-hidden bg-slate-50 pt-20 pb-20">
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

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                {/* Centered Title Section */}
                <div className="text-center mb-16 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight font-sans">
                        理想生活，从构建您的<br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
                            远程职业生涯
                        </span>
                        开始
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
                        不仅仅是求职，Haigoo Copilot 为您提供全流程 AI 辅助，从简历优化到职业发展的每一步。
                    </p>
                </div>

                {/* Main Glass Panel */}
                <div className="w-full max-w-6xl bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_40px_100px_-20px_rgba(50,50,93,0.1)] p-2 md:p-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-2">
                        {/* Left Side: Input Form */}
                        <div className="lg:col-span-5 bg-white/60 rounded-[24px] p-6 md:p-8 flex flex-col justify-center border border-white/50 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            
                            <div className="flex items-center gap-2 mb-8 relative">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Haigoo Copilot</h2>
                                    <p className="text-xs text-slate-500 font-medium">AI 驱动的职业助手</p>
                                </div>
                            </div>

                            {/* Input Form Content */}
                            <div className="text-base leading-relaxed font-medium text-slate-700 space-y-4 relative">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                                    <span>我拥有</span>
                                    <div className="relative inline-block">
                                        <select
                                            value={formData.background.education}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, education: e.target.value}})}
                                            className="appearance-none cursor-pointer inline-block bg-white border border-slate-200 hover:border-indigo-300 text-indigo-700 font-bold px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all rounded-lg text-sm shadow-sm"
                                        >
                                            <option value="Bachelor">本科学历</option>
                                            <option value="Master">硕士学历</option>
                                            <option value="PhD">博士学历</option>
                                            <option value="Associate">大专学历</option>
                                            <option value="Other">其他学历</option>
                                        </select>
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                                    </div>
                                    <span>和</span>
                                    <div className="relative inline-block">
                                        <select
                                            value={formData.background.language}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, language: e.target.value}})}
                                            className="appearance-none cursor-pointer inline-block bg-white border border-slate-200 hover:border-indigo-300 text-indigo-700 font-bold px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all rounded-lg text-sm shadow-sm"
                                        >
                                            <option value="Native">母语水平</option>
                                            <option value="Fluent">流利沟通</option>
                                            <option value="Intermediate">日常交流</option>
                                            <option value="Basic">基础读写</option>
                                        </select>
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                                    </div>
                                    <span>英语能力。</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                                    <span>寻找一份</span>
                                    <div className="relative inline-block group flex-1 min-w-[140px]">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={formData.background.role}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                            placeholder="输入职位 (e.g. Product Manager)"
                                            className="inline-block w-full bg-white border border-slate-200 hover:border-indigo-300 text-indigo-700 font-bold px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-300 placeholder:font-normal rounded-lg text-sm shadow-sm"
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                                    <span>经验水平</span>
                                    <div className="relative inline-block">
                                        <select
                                            value={formData.background.years}
                                            onChange={(e) => setFormData({...formData, background: {...formData.background, years: e.target.value}})}
                                            className="appearance-none cursor-pointer inline-block bg-white border border-slate-200 hover:border-indigo-300 text-indigo-700 font-bold px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all rounded-lg text-sm shadow-sm"
                                        >
                                            <option value="Junior">初级 (1-3年)</option>
                                            <option value="Mid">中级 (3-5年)</option>
                                            <option value="Senior">资深 (5-8年)</option>
                                            <option value="Expert">专家 (8年以上)</option>
                                        </select>
                                        <ChevronUp className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-180 pointer-events-none" />
                                    </div>
                                    <span>。</span>
                                </div>

                                <div className="pt-4 pb-2">
                                    <button
                                        type="button"
                                        onClick={() => resumeInputRef.current?.click()}
                                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all ${
                                            resumeFileName 
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700' 
                                            : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/30 hover:text-indigo-600'
                                        }`}
                                    >
                                        {resumeFileName ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="font-bold truncate">{resumeFileName}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                <span className="font-medium text-sm">上传简历获得更精准匹配 (可选)</span>
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
                                </div>

                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full mt-4 py-4 bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-lg rounded-xl transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>{loadingStep === 0 ? '正在分析简历...' : loadingStep === 1 ? '匹配岗位中...' : '生成计划中...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 text-indigo-300" />
                                            生成我的远程成功计划
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Right Side: Roadmap Demo */}
                        <div className="lg:col-span-7 p-6 md:p-8 flex flex-col bg-white/40 rounded-[24px] overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-50">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                </div>
                            </div>

                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                实时预览 / Live Demo
                            </div>
                            
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-bl-full pointer-events-none"></div>
                                
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">您的专属远程职业蓝图</h3>
                                        <p className="text-sm text-slate-500 mt-1">基于 AI 分析生成的个性化路径</p>
                                    </div>
                                    <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
                                        Preview Mode
                                    </div>
                                </div>

                                <div className="flex-1 relative space-y-6">
                                    {/* Timeline Item 1 */}
                                    <div className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm ring-4 ring-white shadow-sm z-10 group-hover:bg-indigo-600 group-hover:text-white transition-colors">1</div>
                                            <div className="w-0.5 flex-1 bg-slate-100 group-hover:bg-indigo-100 transition-colors my-1"></div>
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-indigo-200 group-hover:bg-white group-hover:shadow-md transition-all">
                                                <h4 className="font-bold text-slate-800 text-sm mb-1">简历智能优化</h4>
                                                <p className="text-xs text-slate-500">检测到您的简历缺少 "Remote Collaboration" 相关关键词，建议增加 3 处描述...</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Item 2 */}
                                    <div className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm ring-4 ring-white shadow-sm z-10 group-hover:bg-purple-600 group-hover:text-white transition-colors">2</div>
                                            <div className="w-0.5 flex-1 bg-slate-100 group-hover:bg-purple-100 transition-colors my-1"></div>
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-purple-200 group-hover:bg-white group-hover:shadow-md transition-all">
                                                <h4 className="font-bold text-slate-800 text-sm mb-1">精准岗位匹配</h4>
                                                <div className="flex gap-2 mt-2">
                                                    <div className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium">Product Manager @ Linear</div>
                                                    <div className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-600 font-medium">Product Owner @ Shopify</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline Item 3 (Fade out) */}
                                    <div className="flex gap-4 opacity-60">
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm ring-4 ring-white z-10">3</div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 border-dashed">
                                                <h4 className="font-bold text-slate-400 text-sm mb-1">面试准备 & 薪资谈判</h4>
                                                <p className="text-xs text-slate-400">生成针对性的面试模拟题库...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Overlay Gradient */}
                                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-4">
                                    <button onClick={handleGenerate} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all">
                                        查看完整示例 <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
