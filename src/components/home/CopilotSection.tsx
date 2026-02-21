
import React, { useState } from 'react'
import { ArrowRight, Sparkles, Lock, Zap, Clock, Briefcase, GraduationCap, Languages, Users, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotificationHelpers } from '../../components/NotificationSystem'

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
  }
  interviewPrep: {
    focusAreas: string[]
    commonQuestions: string[]
  }
  applicationPlan?: {
    timeline: string
    steps: { week: number; action: string; priority: string }[]
    strategy: string
  }
  recommendations: {
    title: string
    company: string
    match: string
  }[]
}

export default function CopilotSection() {
  console.log('[CopilotSection] Version: 2026-02-21 v2 - Default Language Fix');
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { showWarning, showError } = useNotificationHelpers()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CopilotPlan | null>(null)
  const [isTrial, setIsTrial] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)

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
    
    // Simulate steps
    const steps = ['分析个人背景...', '匹配远程机会...', '生成行动计划...']
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % steps.length)
    }, 800)

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
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              您的专属远程求职方案
            </h2>
            <button 
              onClick={resetForm}
              className="text-sm text-slate-500 hover:text-indigo-600"
            >
              重新生成
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Resume & Interview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Resume Eval */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900">简历竞争力评估</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                    得分: {result.resumeEval.score}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-2">核心优势</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.resumeEval.strengths.map((s, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-lg">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-2">改进建议</h4>
                    <ul className="space-y-2">
                      {result.resumeEval.improvements.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Interview Prep */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4">面试准备重点</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <h4 className="text-sm font-medium text-slate-500 mb-2">关注领域</h4>
                     <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                        {result.interviewPrep.focusAreas.map((area, i) => (
                          <li key={i}>{area}</li>
                        ))}
                     </ul>
                   </div>
                   <div>
                     <h4 className="text-sm font-medium text-slate-500 mb-2">必问高频题</h4>
                     <ul className="space-y-2">
                        {result.interviewPrep.commonQuestions.map((q, i) => (
                          <li key={i} className="text-sm text-slate-700 bg-slate-50 p-2 rounded-lg">
                            "{q}"
                          </li>
                        ))}
                     </ul>
                   </div>
                </div>
              </div>
            </div>

            {/* Right Column: Application Plan & Jobs */}
            <div className="space-y-6">
              {/* Application Plan (Member Only) */}
              <div className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden ${isTrial ? 'opacity-90' : ''}`}>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-bold text-slate-900">投递行动计划</h3>
                  {isTrial && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">会员专享</span>}
                </div>
                
                {isTrial ? (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 z-10">
                    <Lock className="w-8 h-8 text-indigo-400 mb-2" />
                    <h4 className="font-bold text-slate-900 mb-1">解锁完整求职计划</h4>
                    <p className="text-sm text-slate-500 mb-4">升级会员获取详细的时间线与策略</p>
                    <button 
                      onClick={() => navigate('/membership')}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      开通会员
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">预计周期：</span> {result.applicationPlan?.timeline}
                    </div>
                    <div className="space-y-3">
                      {result.applicationPlan?.steps.map((step, i) => (
                        <div key={i} className="flex gap-3 items-start">
                           <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                             {step.week}
                           </div>
                           <div>
                             <p className="text-sm text-slate-800 font-medium">{step.action}</p>
                             <span className={`text-[10px] px-1.5 py-0.5 rounded ${step.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                               {step.priority} Priority
                             </span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Placeholder content for blur effect if trial */}
                {isTrial && (
                   <div className="space-y-4 opacity-50 blur-sm pointer-events-none" aria-hidden="true">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-12 bg-slate-100 rounded w-full"></div>
                      <div className="h-12 bg-slate-100 rounded w-full"></div>
                   </div>
                )}
              </div>

              {/* Recommended Jobs */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4">推荐岗位方向</h3>
                <div className="space-y-3">
                  {result.recommendations.map((job, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer" onClick={() => navigate('/jobs')}>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-900 text-sm">{job.title}</h4>
                        <span className="text-xs font-bold text-green-600">{job.match}</span>
                      </div>
                      <p className="text-xs text-slate-500">{job.company}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => navigate(`/jobs?search=${encodeURIComponent(formData.background.industry || '')}&type=${formData.goal === 'full-time' ? 'Full-time' : formData.goal === 'part-time' ? 'Part-time' : 'Contract'}`)} 
                  className="w-full mt-4 text-center text-sm text-indigo-600 font-medium hover:text-indigo-700"
                >
                  查看更多岗位 &rarr;
                </button>
              </div>
            </div>
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
          <div>
             <div className="mb-8">
               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-4">
                 <Sparkles className="w-3.5 h-3.5" />
                 AI 远程求职助手 (Beta)
               </span>
               <h2 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
                 定制您的 <span className="text-indigo-600">远程工作</span><br/>
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
                         onClick={() => setFormData({...formData, goal: opt.value as any})}
                         className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                           formData.goal === opt.value 
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
                     onChange={(e) => setFormData({...formData, timeline: e.target.value as any})}
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
                         onChange={(e) => setFormData({...formData, background: {...formData.background, education: e.target.value}})}
                         className="w-full pl-9 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2 text-sm"
                       />
                     </div>
                     <div className="relative">
                       <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                       <input 
                         type="text" 
                         placeholder="当前行业/职位"
                         value={formData.background.industry}
                         onChange={(e) => setFormData({...formData, background: {...formData.background, industry: e.target.value}})}
                         className="w-full pl-9 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 py-2 text-sm"
                       />
                     </div>
                     <div className="relative">
                       <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                       <select
                          value={formData.background.seniority}
                          onChange={(e) => setFormData({...formData, background: {...formData.background, seniority: e.target.value}})}
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
                          onChange={(e) => setFormData({...formData, background: {...formData.background, language: e.target.value}})}
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

          {/* Right: Demo Visual */}
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
               
               {/* Mock Content */}
               <div className="bg-slate-900 p-6 space-y-6">
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

               {/* Floating Badge */}
               <div className={`absolute bottom-8 right-8 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold flex items-center gap-2 transition-all duration-500 transform ${demoStep === 3 ? 'translate-y-0 opacity-100 scale-110' : 'translate-y-4 opacity-0 scale-90'}`}>
                  <Sparkles className="w-4 h-4" />
                  已生成个性化方案
               </div>
            </div>
            
            {/* Background Blob behind image */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[2rem] opacity-20 blur-2xl -z-10"></div>
          </div>

        </div>
      </div>
    </div>
  )
}
