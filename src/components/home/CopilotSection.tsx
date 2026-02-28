
import React, { useState } from 'react'
import { ArrowRight, Sparkles, Zap, Clock, Briefcase, GraduationCap, Languages, Users, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotificationHelpers } from '../../components/NotificationSystem'
import { trackingService } from '../../services/tracking-service'

interface CopilotFormData {
  goal: 'full-time' | 'part-time' | 'freelance' | ''
  timeline: 'immediately' | '1-3 months' | '3-6 months' | 'flexible' | ''
  background: {
    education: string
    industry: string
    seniority: string
    language: string
  }
  resumeUrl?: string
}

interface CopilotPlan {
  resumeEval: {
    score: number
    strengths: string[]
    improvements: string[]
    summary?: string
  }
  interviewPrep: {
    focusAreas: string[]
    commonQuestions: string[]
    languageTip?: string
  }
  applicationPlan?: {
    timeline: string
    steps: { week: string | number; action: string; priority: string }[]
    strategy?: string
  }
  recommendations: {
    title: string
    company: string
    match: string
  }[]
  summary?: string // Add summary to type
}

export default function CopilotSection() {
  console.log('[CopilotSection] Version: 2026-02-21 v3 - Collapsible View');
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { showWarning, showError } = useNotificationHelpers()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CopilotPlan | null>(null)
  const [isTrial, setIsTrial] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(true) // Collapsed state for result view

  const [formData, setFormData] = useState<CopilotFormData>({
    goal: '',
    timeline: '',
    background: {
      education: '',
      industry: '',
      seniority: '',
      language: 'Work'
    }
  })

  const [demoStep, setDemoStep] = useState(0)

  // Demo Animation Cycle
  React.useEffect(() => {
    const interval = setInterval(() => {
      setDemoStep(prev => (prev + 1) % 4)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Auto-load history on mount
  React.useEffect(() => {
    if (isAuthenticated && user?.user_id) {
      const fetchHistory = async () => {
        try {
          const token = localStorage.getItem('haigoo_auth_token') // Ensure using correct token key
          const res = await fetch(`/api/copilot?userId=${user.user_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.plan) {
              setResult(data.plan)
              setIsTrial(data.isTrial)
            }
          }
        } catch (e) {
          console.error('Failed to load copilot history', e)
        }
      }
      fetchHistory()
    }
  }, [isAuthenticated, user?.user_id])

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      showWarning('请先登录', '登录后即可免费试用 AI 远程求职助手')
      navigate('/login')
      return
    }

    if (!formData.goal || !formData.timeline) {
      showWarning('请填写必填项', '求职目标和预期时间为必填项')
      return
    }

    setLoading(true)
    setLoadingStep(0)

    trackingService.track('click_generate_copilot_plan')

    const steps = ['分析个人背景...', '匹配远程机会...', '生成行动计划...', '完成']
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev >= steps.length - 1) return prev
        return prev + 1
      })
    }, 2000)

    try {
      const token = localStorage.getItem('haigoo_auth_token')
      // Ensure user ID is retrieved correctly from either user_id or id property, casting to any to bypass TS check if needed
      const userId = user?.user_id || (user as any)?.id;

      if (!userId) {
        throw new Error('User ID not found');
      }

      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userId,
          ...formData
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

      setResult(data.plan)
      setIsTrial(data.isTrial)
    } catch (err: any) {
      console.error(err)
      showError('服务暂时不可用', err.message)
    } finally {
      clearInterval(stepInterval)
      setLoading(false)
    }
  }

  const resetForm = () => {
    setResult(null)
    setFormData({
      goal: '',
      timeline: '',
      background: {
        education: '',
        industry: '',
        seniority: '',
        language: 'Work'
      }
    })
  }

  if (result) {
    return (
      <div className="py-16 border-b border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              您的专属远程求职方案
            </h2>
            <div className="flex gap-4">
              <button
                onClick={resetForm}
                className="text-sm text-slate-500 hover:text-indigo-600 underline"
              >
                重新生成
              </button>
              <button
                onClick={() => navigate('/profile?tab=custom-plan')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                查看完整版 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Content Area */}
          <div className={`space-y-6 transition-all duration-500 overflow-hidden ${isCollapsed ? 'max-h-[600px]' : 'max-h-[2000px]'}`}>

            {/* 1. Summary Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-900">分析结论</h3>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                  准备度: {result.resumeEval.score}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed text-sm">
                {result.summary || result.resumeEval.summary || "根据您的背景分析，您具备较强的远程工作潜力。"}
              </p>
            </div>

            {/* 2. Timeline Plan */}
            {result.applicationPlan && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-bold text-slate-900">关键里程碑</h3>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{result.applicationPlan.timeline}</span>
                </div>
                <div className="space-y-4">
                  {result.applicationPlan.steps.slice(0, isCollapsed ? 3 : undefined).map((step, i) => (
                    <div key={i} className="flex gap-4 items-start group">
                      <div className="w-16 shrink-0 text-right">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded block w-full text-center truncate">
                          {step.week}
                        </span>
                      </div>
                      <div className="relative pb-4 border-l-2 border-slate-100 pl-4 last:border-0 last:pb-0">
                        <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-200 group-hover:border-indigo-500 transition-colors"></div>
                        <p className="text-sm font-bold text-slate-800 mb-0.5">{step.action}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${step.priority === 'High' || step.priority === '高' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                          P{step.priority === 'High' ? '0' : step.priority === '高' ? '0' : '1'} 优先级
                        </span>
                      </div>
                    </div>
                  ))}
                  {isCollapsed && result.applicationPlan.steps.length > 3 && (
                    <div className="text-center pt-2">
                      <span className="text-xs text-slate-400">... 更多步骤请展开或前往个人中心查看</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Job Recommendations (Collapsed Preview) */}
            {!isCollapsed && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                <h3 className="font-bold text-slate-900 mb-4">定制岗位推荐</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.recommendations.map((job, i) => {
                    const matchLabel = job.match === '低匹配' ? '一般匹配' : job.match;
                    const matchColor = job.match === '高匹配' ? 'text-indigo-600' : job.match === '中匹配' ? 'text-amber-600' : 'text-slate-500';
                    return (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer border border-slate-100" onClick={() => navigate('/jobs')}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-900 text-sm truncate pr-2">{job.title}</h4>
                          <span className={`text-xs font-bold whitespace-nowrap ${matchColor}`}>{matchLabel}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{job.company}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Toggle Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            >
              {isCollapsed ? (
                <>展开详细方案 <ChevronDown className="w-4 h-4" /></>
              ) : (
                <>收起方案 <ChevronUp className="w-4 h-4" /></>
              )}
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-slate-400">
              完整版方案（含简历深度评估、面试题库、语言建议）已保存至
              <button onClick={() => navigate('/profile?tab=custom-plan')} className="text-indigo-500 hover:underline ml-1">个人中心</button>
            </p>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="py-20 border-b border-slate-100 bg-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: Input Form */}
          <div className="min-w-0 flex flex-col">
            <div className="mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                AI 远程求职助手 (Beta)
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
                定制您的 <span className="text-indigo-600">远程工作</span><br />
                全流程计划
              </h2>
              <p className="text-slate-500 text-lg">
                不只是找工作，我们为您提供从简历评估到面试准备的全方位 AI 辅助，让远程求职更简单。
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
              <div className="space-y-6">
                {/* Goal Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    您的求职目标是什么？<span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'full-time', label: '长期全职', icon: <Briefcase className="w-4 h-4" /> },
                      { value: 'part-time', label: '兼职副业', icon: <Clock className="w-4 h-4" /> },
                      { value: 'freelance', label: '自由接单', icon: <Zap className="w-4 h-4" /> }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFormData({ ...formData, goal: opt.value as any })}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${formData.goal === opt.value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                          : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                          }`}
                      >
                        {opt.icon}
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    您计划何时开始？<span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value as any })}
                    className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2.5 text-sm"
                  >
                    <option value="" disabled>请选择预期时间</option>
                    <option value="immediately">立即开始 (1个月内)</option>
                    <option value="1-3 months">1-3个月内</option>
                    <option value="3-6 months">3-6个月内</option>
                    <option value="flexible">先看看机会</option>
                  </select>
                </div>

                {/* Background (Simplified) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">职业背景 (选填)</label>
                    <span className="text-xs text-slate-400">帮助 AI 更精准匹配</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="最高学历"
                        value={formData.background.education}
                        onChange={(e) => setFormData({ ...formData, background: { ...formData.background, education: e.target.value } })}
                        className="w-full pl-9 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2 text-sm"
                      />
                    </div>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="当前行业/职位"
                        value={formData.background.industry}
                        onChange={(e) => setFormData({ ...formData, background: { ...formData.background, industry: e.target.value } })}
                        className="w-full pl-9 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2 text-sm"
                      />
                    </div>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <select
                        value={formData.background.seniority}
                        onChange={(e) => setFormData({ ...formData, background: { ...formData.background, seniority: e.target.value } })}
                        className="w-full pl-9 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2 text-sm text-slate-600"
                      >
                        <option value="">工作年限</option>
                        <option value="Junior">1-3年</option>
                        <option value="Mid">3-5年</option>
                        <option value="Senior">5-8年</option>
                        <option value="Expert">8年以上</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Languages className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <select
                        value={formData.background.language}
                        onChange={(e) => setFormData({ ...formData, background: { ...formData.background, language: e.target.value } })}
                        className="w-full pl-9 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2 text-sm text-slate-600"
                      >
                        <option value="" disabled>英语水平</option>
                        <option value="Basic">基础读写 (A1-A2)</option>
                        <option value="Conversational">日常沟通 (B1)</option>
                        <option value="Work">英语-工作 (B2)</option>
                        <option value="Fluent">流利工作 (C1)</option>
                        <option value="Native">母语水平 (C2)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {['分析个人背景...', '匹配远程机会...', '生成行动计划...'][loadingStep]}
                    </>
                  ) : (
                    <>
                      生成我的远程求职方案 <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {!isAuthenticated && (
                  <p className="text-xs text-center text-slate-400">
                    点击即代表同意 <a href="#" className="underline">服务条款</a>，首次使用需登录
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Demo Visual or Progress */}
          <div className="hidden lg:block relative">
            <div className="relative z-10 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-2 overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
              {/* Mock UI Header */}
              <div className="bg-slate-800 rounded-t-xl px-4 py-3 flex items-center gap-2 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="ml-4 text-xs font-mono text-slate-400">Copilot Workflow</div>
              </div>

              {/* Content Area */}
              <div className="bg-slate-900 p-6 space-y-6">
                {loading ? (
                  // Loading Progress View (Real-time Analysis Simulation)
                  <div className="py-6 space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                      </span>
                      <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">正在为您生成专属远程求职方案...</span>
                    </div>

                    {/* Step 1: Diagnosis */}
                    <div className={`bg-slate-800/50 rounded-xl p-4 border transition-all duration-500 ${loadingStep >= 0 ? 'border-indigo-500/50 shadow-lg shadow-indigo-900/20' : 'border-slate-800 opacity-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${loadingStep > 0 ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white'}`}>
                          {loadingStep > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-sm font-bold text-slate-200">简历竞争力诊断</div>
                          {loadingStep === 0 && (
                            <div className="space-y-1.5 animate-in fade-in duration-700">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="w-1 h-1 bg-slate-500 rounded-full" />
                                正在分析教育背景与工作年限...
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="w-1 h-1 bg-slate-500 rounded-full" />
                                正在评估远程工作适配度...
                              </div>
                              <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden mt-2">
                                <div className="h-full bg-indigo-500 animate-progress"></div>
                              </div>
                            </div>
                          )}
                          {loadingStep > 0 && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">已完成评估</span>
                              <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">发现3个亮点</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Matching */}
                    <div className={`bg-slate-800/50 rounded-xl p-4 border transition-all duration-500 ${loadingStep >= 1 ? 'border-indigo-500/50 shadow-lg shadow-indigo-900/20' : 'border-slate-800 opacity-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${loadingStep > 1 ? 'bg-green-500 text-white' : loadingStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                          {loadingStep > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : loadingStep === 1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '2'}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-sm font-bold text-slate-200">精准岗位匹配</div>
                          {loadingStep === 1 && (
                            <div className="space-y-2 animate-in fade-in duration-500">
                              <div className="flex flex-wrap gap-2">
                                {['Shopify', 'GitLab', 'Deel', 'Remote'].map((c, i) => (
                                  <span key={i} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>{c}</span>
                                ))}
                              </div>
                              <div className="text-xs text-indigo-300">正在检索全球 2000+ 远程企业数据库...</div>
                            </div>
                          )}
                          {loadingStep > 1 && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">匹配到 5+ 核心岗位</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Interview Prep */}
                    <div className={`bg-slate-800/50 rounded-xl p-4 border transition-all duration-500 ${loadingStep >= 2 ? 'border-indigo-500/50 shadow-lg shadow-indigo-900/20' : 'border-slate-800 opacity-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${loadingStep > 2 ? 'bg-green-500 text-white' : loadingStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                          {loadingStep > 2 ? <CheckCircle2 className="w-3.5 h-3.5" /> : loadingStep === 2 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '3'}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-sm font-bold text-slate-200">英文面试模拟 & 复盘</div>
                          {loadingStep === 2 && (
                            <div className="text-xs text-slate-400 animate-pulse">
                              正在生成针对性 STAR 法则回答建议...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Demo Content
                  <div className="space-y-6">
                    {/* Step 1: Analyze */}
                    <div className={`flex gap-4 transition-opacity duration-500 ${demoStep >= 0 ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${demoStep >= 0 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        1
                      </div>
                      <div className="space-y-2 w-full">
                        <div className="text-slate-300 font-medium text-sm">AI 深度解析您的背景与目标</div>
                        <div className={`h-20 w-full bg-slate-800 rounded border border-slate-700 p-3 transition-all duration-500 ${demoStep === 0 ? 'ring-2 ring-indigo-500 bg-slate-800/80' : ''}`}>
                          <div className="h-2 w-1/2 bg-slate-600 rounded mb-2" />
                          <div className="flex gap-2">
                            <div className="h-6 w-16 bg-green-500/20 rounded border border-green-500/30 text-[10px] text-green-400 flex items-center justify-center">简历评估</div>
                            <div className="h-6 w-16 bg-blue-500/20 rounded border border-blue-500/30 text-[10px] text-blue-400 flex items-center justify-center">技能分析</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Match */}
                    <div className={`flex gap-4 transition-opacity duration-500 ${demoStep >= 1 ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${demoStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        2
                      </div>
                      <div className="space-y-2 w-full">
                        <div className="text-slate-300 font-medium text-sm">精准匹配全网远程机会</div>
                        <div className={`space-y-2 transition-all duration-500 ${demoStep === 1 ? 'scale-105 origin-left' : ''}`}>
                          {[
                            { text: 'Senior React Developer', match: '98%' },
                            { text: 'Frontend Engineer (Remote)', match: '95%' },
                            { text: 'Full Stack Developer', match: '92%' }
                          ].map((job, i) => (
                            <div key={i} className={`flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-800 transition-all duration-300 ${demoStep >= 1 ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`} style={{ transitionDelay: `${i * 100}ms` }}>
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-slate-400">{job.text}</span>
                              </div>
                              <span className="text-[10px] text-green-500 font-mono">{job.match}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Plan */}
                    <div className={`flex gap-4 transition-opacity duration-500 ${demoStep >= 2 ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${demoStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        3
                      </div>
                      <div className="space-y-2 w-full">
                        <div className="text-slate-300 font-medium text-sm">生成面试策略与投递计划</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`h-20 bg-slate-800 rounded border border-slate-700 p-2 transition-all duration-500 ${demoStep === 2 ? 'bg-indigo-900/20 border-indigo-500/50' : ''}`}>
                            <div className="w-6 h-6 rounded bg-slate-700 mb-2 flex items-center justify-center">
                              <Zap className="w-3 h-3 text-amber-400" />
                            </div>
                            <div className="h-1.5 w-16 bg-slate-600 rounded" />
                          </div>
                          <div className={`h-20 bg-slate-800 rounded border border-slate-700 p-2 transition-all duration-500 ${demoStep === 2 ? 'bg-indigo-900/20 border-indigo-500/50' : ''}`}>
                            <div className="w-6 h-6 rounded bg-slate-700 mb-2 flex items-center justify-center">
                              <Clock className="w-3 h-3 text-blue-400" />
                            </div>
                            <div className="h-1.5 w-16 bg-slate-600 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating Badge */}
              {!loading && (
                <div className={`absolute bottom-8 right-8 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold flex items-center gap-2 transition-all duration-500 transform ${demoStep === 3 ? 'translate-y-0 opacity-100 scale-110' : 'translate-y-4 opacity-0 scale-90'}`}>
                  <Sparkles className="w-4 h-4" />
                  已生成个性化方案
                </div>
              )}
            </div>

            {/* Background Blob behind image */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2rem] opacity-20 blur-2xl -z-10"></div>
          </div>

        </div>
      </div>
    </div>
  )
}
