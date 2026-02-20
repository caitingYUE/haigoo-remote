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
    goal: 'full-time' | 'part-time' | 'freelance' | ''
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
        <div className="relative min-h-[900px] flex flex-col items-center justify-center overflow-hidden bg-slate-50 pt-32 pb-20">
            {/* Background - Soft Gradient & Image */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-blue-50/80 via-white to-slate-50">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${imageLoaded ? 'opacity-50' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/60 to-slate-50"></div>
                
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent"></div>
                <div className="absolute -top-40 right-[-10%] h-[600px] w-[600px] rounded-full bg-purple-200/20 blur-[100px]"></div>
                <div className="absolute top-20 left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-200/20 blur-[100px]"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
                {/* Centered Title Section */}
                <div className="text-center mb-16 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-6">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Haigoo Premium
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight font-sans">
                        理想生活，从构建您的<br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
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
                        {/* Left Side: Structured Form */}
                        <div className="lg:col-span-5 bg-white/80 rounded-[24px] p-6 md:p-8 flex flex-col justify-center border border-white/50 shadow-sm relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">Copilot</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Step 1: Goal */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</div>
                                        <label className="text-sm font-bold text-slate-700">您的目标是什么？</label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => setFormData({...formData, goal: 'full-time'})}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${formData.goal === 'full-time' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}
                                        >
                                            长期远程职业
                                        </button>
                                        <button 
                                            onClick={() => setFormData({...formData, goal: 'part-time'})}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${formData.goal === 'part-time' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'}`}
                                        >
                                            副业/兼职
                                        </button>
                                    </div>
                                </div>

                                {/* Step 2: Timeline */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</div>
                                        <label className="text-sm font-bold text-slate-700">预期入职时间</label>
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={formData.timeline}
                                            onChange={(e) => setFormData({...formData, timeline: e.target.value as any})}
                                            className="w-full appearance-none bg-white border border-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all text-sm"
                                        >
                                            <option value="immediately">ASAP (尽快)</option>
                                            <option value="1-3 months">Next 3 Months (1-3个月)</option>
                                            <option value="3-6 months">3-6 Months (3-6个月)</option>
                                            <option value="flexible">Flexible (时间灵活)</option>
                                        </select>
                                        <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Step 3: Background */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">3</div>
                                        <label className="text-sm font-bold text-slate-700">您的背景与专长</label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={formData.background.role}
                                                onChange={(e) => setFormData({...formData, background: {...formData.background, role: e.target.value}})}
                                                placeholder="职业/专业领域"
                                                className="w-full bg-white border border-slate-200 text-slate-700 font-medium px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all text-sm placeholder:font-normal"
                                            />
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={formData.background.language}
                                                onChange={(e) => setFormData({...formData, background: {...formData.background, language: e.target.value}})}
                                                className="w-full appearance-none bg-white border border-slate-200 text-slate-700 font-medium px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all text-sm"
                                            >
                                                <option value="Native">母语水平</option>
                                                <option value="Fluent">流利沟通</option>
                                                <option value="Intermediate">日常交流</option>
                                                <option value="Basic">基础读写</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 4: Resume */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">4</div>
                                        <label className="text-sm font-bold text-slate-700">上传简历，AI 即刻分析</label>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => resumeInputRef.current?.click()}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed transition-all text-sm font-medium ${
                                            resumeFileName 
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700' 
                                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/30 hover:text-indigo-600'
                                        }`}
                                    >
                                        {resumeFileName ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="truncate">{resumeFileName}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4" />
                                                <span>拖拽或点击上传 CV 文件</span>
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
                                    className="w-full mt-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>正在生成...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            生成我的职业规划
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Right Side: Cleaner Roadmap Demo */}
                        <div className="lg:col-span-7 p-6 md:p-10 flex flex-col justify-center">
                            <div className="mb-8 flex items-center justify-between">
                                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">实时预览 / Demo</div>
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                                </div>
                            </div>
                            
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-6">您的专属远程职业蓝图 (AI 预览)</h3>
                                
                                <div className="space-y-8 relative">
                                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

                                    {/* Step 1 */}
                                    <div className="relative pl-10">
                                        <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm border-4 border-white shadow-sm z-10">1</div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">第一周：深度简历审计</h4>
                                        <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                                <span>AI 分析亮点与提升建议</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <FileText className="w-3 h-3 text-indigo-500" />
                                                <span>远程岗位与关键词匹配</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="relative pl-10">
                                        <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center font-bold text-sm border-4 border-white shadow-sm z-10">2</div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">第二周：定制面试策略</h4>
                                        <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span>模拟面试与话术指导</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <Briefcase className="w-3 h-3 text-slate-400" />
                                                <span>薪资谈判策略建议</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="relative pl-10 opacity-60">
                                        <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm border-4 border-white z-10">3</div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-2">第三周：精准岗位匹配</h4>
                                        <div className="text-xs text-slate-500">为您推送全球优质远程机会...</div>
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
