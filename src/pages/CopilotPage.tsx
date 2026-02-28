import React, { useEffect, useState } from 'react'
import {
    BarChart3, Briefcase, ListTodo, Target, Loader2, FileText,
    ChevronRight, AlertCircle, CheckCircle2, Clock, ArrowRight, RefreshCw, Sparkles,
    MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CopilotProvider, useCopilot } from '../contexts/CopilotContext'
import Layout from '../components/Layout'
import { trackingService } from '../services/tracking-service'

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
    { key: 'readiness', label: '适配度评估', icon: BarChart3 },
    { key: 'jobs', label: '岗位匹配', icon: Briefcase },
    { key: 'plan', label: '行动计划', icon: ListTodo },
    { key: 'interview', label: '面试准备', icon: MessageSquare },
] as const

type TabKey = typeof TABS[number]['key']

function CopilotPageInner() {
    const { user, token } = useAuth()
    const navigate = useNavigate()
    const { state, tasks, jobMatches, loading, error, fetchState, callAction } = useCopilot()
    const [activeTab, setActiveTab] = useState<TabKey>('readiness')
    const [initialized, setInitialized] = useState(false)

    // Persist goal/timeline across tabs for plan generation
    const [userGoal, setUserGoal] = useState('')
    const [userTimeline, setUserTimeline] = useState('')

    useEffect(() => {
        if (!user) {
            navigate('/login')
            return
        }
        if (!initialized) {
            fetchState().then(() => setInitialized(true))
        }
    }, [user, initialized])

    if (!user) return null

    // Loading skeleton
    if (!initialized && loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                            <div className="h-8 w-64 bg-white/20 rounded-lg animate-pulse" />
                            <div className="h-4 w-96 bg-white/10 rounded-lg animate-pulse mt-3" />
                        </div>
                    </div>
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
                        </div>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                        <div className="flex items-center gap-3 mb-2">
                            <Sparkles className="w-7 h-7" />
                            <h1 className="text-2xl sm:text-3xl font-bold">Copilot 求职助手</h1>
                        </div>
                        <p className="text-indigo-100 text-sm sm:text-base max-w-2xl">
                            AI 驱动的远程求职操作系统 — 从适配度评估、岗位匹配到行动推进，全程陪跑。
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="sticky top-0 bg-white border-b border-slate-200 z-20 shadow-sm">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6">
                        <nav className="flex gap-1 overflow-x-auto py-1 -mb-px">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key
                                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-none" />
                            {error}
                        </div>
                    )}

                    {activeTab === 'readiness' && <ReadinessPanel onGoalSet={(g, t) => { setUserGoal(g); setUserTimeline(t) }} />}
                    {activeTab === 'jobs' && <JobMatchPanel />}
                    {activeTab === 'plan' && <ActionPlanPanel userGoal={userGoal} userTimeline={userTimeline} />}
                    {activeTab === 'interview' && <InterviewPanel />}
                </div>
            </div>
        </Layout>
    )
}

export default function CopilotPage() {
    return (
        <CopilotProvider>
            <CopilotPageInner />
        </CopilotProvider>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Panel: Readiness Assessment (M1)
// ═══════════════════════════════════════════════════════════════════════════

function ReadinessPanel({ onGoalSet }: { onGoalSet?: (goal: string, timeline: string) => void }) {
    const { state, loading, callAction } = useCopilot()
    const readiness = state?.readinessData
    const [localLoading, setLocalLoading] = useState(false)

    // Form state for initial assessment
    const [goal, setGoal] = useState('')
    const [timeline, setTimeline] = useState('')
    const [education, setEducation] = useState('')
    const [industry, setIndustry] = useState('')
    const [seniority, setSeniority] = useState('')
    const [language, setLanguage] = useState('')

    const handleAssess = async () => {
        setLocalLoading(true)
        try {
            await callAction('assess', {
                goal,
                timeline,
                background: { education, industry, seniority, language },
            })
            // Persist goal & timeline for plan generation tab
            onGoalSet?.(goal, timeline)
        } catch (e) { }
        setLocalLoading(false)
    }

    // If we already have readiness data, show results
    if (readiness) {
        return (
            <div className="space-y-6">
                {/* Score Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900">远程适配度评估</h2>
                        <button
                            onClick={() => callAction('assess', { forceRefresh: true, goal: '', timeline: '', background: {} })}
                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            disabled={loading}
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> 重新评估
                        </button>
                    </div>
                    <div className="flex items-center gap-6 mb-8">
                        <div className="relative w-28 h-28 flex-none">
                            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="52" stroke="#E2E8F0" strokeWidth="10" fill="none" />
                                <circle
                                    cx="60" cy="60" r="52" stroke={readiness.remote_readiness_score >= 70 ? '#4F46E5' : readiness.remote_readiness_score >= 40 ? '#F59E0B' : '#EF4444'}
                                    strokeWidth="10" fill="none" strokeDasharray={`${readiness.remote_readiness_score * 3.27} 999`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-bold text-slate-900">{readiness.remote_readiness_score}</span>
                            </div>
                        </div>
                        <div>
                            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${readiness.readiness_level === 'high' ? 'bg-green-100 text-green-700' :
                                readiness.readiness_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                {readiness.readiness_level === 'high' ? '高适配度' : readiness.readiness_level === 'medium' ? '中适配度' : '一般适配'}
                            </div>
                            {readiness.estimated_timeline && (
                                <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    预估达成时间: {readiness.estimated_timeline}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Strengths */}
                    {readiness.strengths?.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">✅ 优势</h3>
                            <div className="grid gap-2">
                                {readiness.strengths.map((s: any, i: number) => (
                                    <div key={i} className="flex gap-3 p-3 bg-green-50 rounded-lg text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-none mt-0.5" />
                                        <div>
                                            <span className="font-medium text-green-800">{s.point}</span>
                                            <span className="text-green-600 ml-1">— {s.reason}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Gaps */}
                    {readiness.gaps?.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">⚠️ 差距</h3>
                            <div className="grid gap-2">
                                {readiness.gaps.map((g: any, i: number) => (
                                    <div key={i} className="flex gap-3 p-3 bg-amber-50 rounded-lg text-sm">
                                        <AlertCircle className="w-4 h-4 text-amber-600 flex-none mt-0.5" />
                                        <div>
                                            <span className="font-medium text-amber-800">{g.gap}</span>
                                            <span className="text-amber-600 ml-1">— {g.impact}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Priority Improvements */}
                    {readiness.priority_improvements?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">🎯 优先改进</h3>
                            <div className="grid gap-2">
                                {readiness.priority_improvements.map((p: any, i: number) => (
                                    <div key={i} className="flex gap-3 p-3 bg-indigo-50 rounded-lg text-sm">
                                        <Target className="w-4 h-4 text-indigo-600 flex-none mt-0.5" />
                                        <div>
                                            <span className="font-medium text-indigo-800">{p.action}</span>
                                            <span className="text-indigo-600 ml-1">→ {p.expected_benefit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Initial assessment form
    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-2">开始你的远程适配度评估</h2>
                <p className="text-sm text-slate-500 mb-6">AI 将根据你的背景信息，评估你的远程工作准备程度并给出具体建议。</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">求职目标</label>
                        <select value={goal} onChange={e => setGoal(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">请选择</option>
                            <option value="full-time">全职远程工作</option>
                            <option value="part-time">兼职/副业远程增收</option>
                            <option value="freelance">职业转型/换赛道</option>
                            <option value="market-watch">先了解远程市场</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">期望时间线</label>
                        <select value={timeline} onChange={e => setTimeline(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">请选择</option>
                            <option value="immediately">尽快入职</option>
                            <option value="1-3 months">1-3个月</option>
                            <option value="3-6 months">3-6个月</option>
                            <option value="flexible">灵活安排</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">学历</label>
                            <select value={education} onChange={e => setEducation(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">请选择</option>
                                <option value="高中及以下">高中及以下</option>
                                <option value="大专">大专</option>
                                <option value="本科">本科</option>
                                <option value="硕士">硕士</option>
                                <option value="博士">博士</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">英语水平</label>
                            <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">请选择</option>
                                <option value="基础">基础（能读写）</option>
                                <option value="日常沟通">日常沟通</option>
                                <option value="商务英语">商务英语</option>
                                <option value="流利/母语">流利/母语</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">职业方向</label>
                        <input
                            type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                            placeholder="如：产品经理、前端开发、市场营销..."
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">工作资历</label>
                        <select value={seniority} onChange={e => setSeniority(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">请选择</option>
                            <option value="应届/实习">应届/实习</option>
                            <option value="1-3年">1-3年</option>
                            <option value="3-5年">3-5年</option>
                            <option value="5-10年">5-10年</option>
                            <option value="10年以上">10年以上</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleAssess}
                    disabled={localLoading || !goal}
                    className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {localLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> AI 评估中...</>
                    ) : (
                        <><Sparkles className="w-5 h-5" /> 开始评估</>
                    )}
                </button>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Panel: Job Matching (M2)
// ═══════════════════════════════════════════════════════════════════════════

function JobMatchPanel() {
    const { state, jobMatches, loading, callAction } = useCopilot()
    const [localLoading, setLocalLoading] = useState(false)
    const [extracting, setExtracting] = useState(false)

    const handleMatch = async () => {
        setLocalLoading(true)
        try {
            await callAction('match-jobs')
        } catch (e) { }
        setLocalLoading(false)
    }

    const handleExtractResume = async () => {
        setExtracting(true)
        try {
            // This will use the user's latest resume
            await callAction('extract-resume', { resumeId: null })
        } catch (e) { }
        setExtracting(false)
    }

    const hasResume = state?.resumeStructured != null

    return (
        <div className="space-y-6">
            {/* Resume status card */}
            {!hasResume && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-amber-600 flex-none mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-medium text-amber-800 text-sm">需要先解析简历</h3>
                            <p className="text-xs text-amber-600 mt-1">岗位匹配需要你的技能和经验数据。请先在「个人中心」上传简历，然后点击下方按钮进行解析。</p>
                            <div className="flex gap-2 mt-3">
                                <Link to="/profile" className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                                    前往上传简历
                                </Link>
                                <button
                                    onClick={handleExtractResume}
                                    disabled={extracting}
                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    解析已有简历
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">智能岗位匹配</h2>
                    <button
                        onClick={handleMatch}
                        disabled={localLoading || !hasResume}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {localLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {jobMatches.length > 0 ? '刷新匹配' : '开始匹配'}
                    </button>
                </div>

                {jobMatches.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm">{hasResume ? '点击「开始匹配」查看最合适的远程岗位' : '完成简历解析后即可开始匹配'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-400">基于你的技能和背景，命中 {jobMatches.length} 个岗位</p>
                        {jobMatches.map((job: any, i: number) => (
                            <Link
                                key={job.job_id || i}
                                to={`/job/${job.job_id}`}
                                className="block p-4 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors border border-slate-100 hover:border-indigo-200"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-slate-900 truncate">{job.title}</h3>
                                        <p className="text-sm text-slate-500 mt-0.5">{job.company} · {job.location}</p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            {job.category && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{job.category}</span>}
                                            {job.salary && <span className="text-xs text-emerald-600">{job.salary}</span>}
                                        </div>
                                    </div>
                                    <div className="flex-none ml-4 text-right">
                                        <div className={`text-lg font-bold ${job.match_score >= 70 ? 'text-indigo-600' :
                                            job.match_score >= 40 ? 'text-amber-600' : 'text-slate-400'
                                            }`}>
                                            {job.match_score}%
                                        </div>
                                        <span className="text-xs text-slate-400">匹配度</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Panel: Action Plan (M3)
// ═══════════════════════════════════════════════════════════════════════════

function ActionPlanPanel({ userGoal, userTimeline }: { userGoal: string; userTimeline: string }) {
    const { state, tasks, loading, callAction } = useCopilot()
    const [localLoading, setLocalLoading] = useState(false)
    const [planGoal, setPlanGoal] = useState(userGoal || 'full-time')
    const [planTimeline, setPlanTimeline] = useState(userTimeline || '1-3 months')
    const [investedHours, setInvestedHours] = useState('')
    const [loadingStep, setLoadingStep] = useState(0)

    useEffect(() => {
        let interval: any;
        if (localLoading) {
            setLoadingStep(0)
            interval = setInterval(() => {
                setLoadingStep(s => Math.min(s + 1, 3))
            }, 1500)
        }
        return () => clearInterval(interval)
    }, [localLoading])

    const loadingSteps = ['正在分析你的求职背景...', '深入匹配全网精选远程岗位...', '正在定制专属高转化求职路线...', '最后完善细节，即将呈现...']


    const handleCreate = async () => {
        setLocalLoading(true)
        trackingService.track('click_generate_copilot_plan', { source: 'copilot_page' })
        try {
            await callAction('create-plan', {
                goal: planGoal,
                timeline: planTimeline,
                investedHours,
            })
        } catch (e) { }
        setLocalLoading(false)
    }

    const handleToggleTask = async (taskId: number, currentStatus: string) => {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
        try {
            await callAction('update-progress', { taskId, status: newStatus })
        } catch (e) { }
    }

    const planData = state?.planData
    const phases = planData?.phases || []

    // Group tasks by phase
    const tasksByPhase: Record<string, any[]> = {}
    for (const t of tasks) {
        if (!tasksByPhase[t.phase]) tasksByPhase[t.phase] = []
        tasksByPhase[t.phase].push(t)
    }

    if (!planData || phases.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                    <div className="text-center mb-6">
                        <ListTodo className="w-12 h-12 mx-auto mb-4 text-indigo-300" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">生成你的行动计划</h2>
                        <p className="text-sm text-slate-500">
                            AI 会基于你的适配度评估结果，为你量身定制分阶段的远程求职行动计划。
                        </p>
                    </div>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">求职目标</label>
                            <select value={planGoal} onChange={e => setPlanGoal(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="full-time">全职远程工作</option>
                                <option value="part-time">兼职/副业远程增收</option>
                                <option value="freelance">职业转型/换赛道</option>
                                <option value="market-watch">先了解远程市场</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">时间规划</label>
                            <select value={planTimeline} onChange={e => setPlanTimeline(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="immediately">尽快入职（4周）</option>
                                <option value="1-3 months">1-3个月（12周）</option>
                                <option value="3-6 months">3-6个月（24周）</option>
                                <option value="flexible">灵活安排（16周）</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">每周可投入时间</label>
                            <select value={investedHours} onChange={e => setInvestedHours(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="">请选择</option>
                                <option value="5小时以内">5小时以内（碎片时间）</option>
                                <option value="5-10小时">5-10小时（每天约1小时）</option>
                                <option value="10-20小时">10-20小时（每天2-3小时）</option>
                                <option value="20小时以上">20小时以上（全力冲刺）</option>
                            </select>
                        </div>
                    </div>
                    {localLoading ? (
                        <div className="text-center py-6 px-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
                            <h3 className="text-lg font-bold text-indigo-900 mb-6 relative">
                                AI 正在全速生成您的求职方案
                                <Sparkles className="w-5 h-5 text-indigo-500 absolute -top-1 -right-4 animate-pulse" />
                            </h3>
                            <div className="space-y-4 max-w-sm mx-auto">
                                {[0, 1, 2].map(stepIndex => (
                                    <div key={stepIndex} className="flex items-center gap-3">
                                        <div className="relative flex-none">
                                            {loadingStep > stepIndex ? (
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                            ) : loadingStep === stepIndex ? (
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
                                            )}
                                            {stepIndex < 2 && (
                                                <div className={`absolute top-6 left-3 w-px h-4 -translate-x-1/2 ${loadingStep > stepIndex ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                                            )}
                                        </div>
                                        <div className={`text-sm font-medium text-left transition-colors duration-300 ${loadingStep > stepIndex ? 'text-slate-600' : loadingStep === stepIndex ? 'text-indigo-700' : 'text-slate-400'}`}>
                                            {loadingSteps[stepIndex]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleCreate}
                            disabled={localLoading}
                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm hover:shadow"
                        >
                            <Sparkles className="w-5 h-5" /> 生成专属行动计划
                        </button>
                    )}
                    {!localLoading && <p className="text-xs text-slate-400 mt-3 text-center">此功能仅限高级会员体验</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {phases.map((phase: any, pi: number) => {
                const phaseTasks = tasksByPhase[phase.phase_key] || []
                const doneCount = phaseTasks.filter((t: any) => t.status === 'completed').length
                const totalCount = phaseTasks.length
                const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
                const typeColors: Record<string, string> = {
                    resume: 'bg-violet-100 text-violet-700',
                    apply: 'bg-blue-100 text-blue-700',
                    interview: 'bg-amber-100 text-amber-700',
                    network: 'bg-green-100 text-green-700',
                    english: 'bg-pink-100 text-pink-700',
                    offer: 'bg-emerald-100 text-emerald-700',
                }
                return (
                    <div key={pi} className="relative flex gap-4">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-none z-10 ${progress === 100 ? 'bg-emerald-500 text-white' : pi === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 border-2 border-slate-200'
                                }`}>{progress === 100 ? '✓' : pi + 1}</div>
                            {pi < phases.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1 mb-1" />}
                        </div>
                        {/* Phase card */}
                        <div className="flex-1 pb-6 min-w-0">
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 text-sm leading-snug">{phase.phase_name}</h3>
                                        {phase.focus && <p className="text-xs text-indigo-600 mt-0.5">🎯 {phase.focus}</p>}
                                    </div>
                                    {totalCount > 0 && (
                                        <span className="text-xs font-bold text-slate-400 ml-2 flex-none">{doneCount}/{totalCount}</span>
                                    )}
                                </div>
                                {totalCount > 0 && (
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                    </div>
                                )}
                                {phaseTasks.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {phaseTasks.map((task: any) => (
                                            <button
                                                key={task.id}
                                                onClick={() => handleToggleTask(task.id, task.status)}
                                                className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-slate-50 transition-colors"
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-none ${task.status === 'completed' ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                                                    }`}>
                                                    {task.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`text-xs flex-1 leading-snug ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'
                                                    }`}>{task.task_name}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-none ${typeColors[task.phase] || 'bg-slate-100 text-slate-500'
                                                    }`}>{task.priority === 'high' ? '高优' : task.priority === 'medium' ? '中' : '低'}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 py-2">本阶段任务加载中...</p>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Panel: Interview Prep (M6)
// ═══════════════════════════════════════════════════════════════════════════

function InterviewPanel() {
    const { state, callAction } = useCopilot()
    const { user } = useAuth()
    const [localLoading, setLocalLoading] = useState(false)
    const [questions, setQuestions] = useState<any[]>([])
    const [answerLoading, setAnswerLoading] = useState<number | null>(null)
    const [answers, setAnswers] = useState<Record<number, any>>({})
    const [expandedAnswer, setExpandedAnswer] = useState<number | null>(null)

    const resumeStructured = state?.resumeStructured
    const role = resumeStructured?.roles?.[0] || ''
    const industry = resumeStructured?.industries?.[0] || ''

    const handleGenerate = async () => {
        setLocalLoading(true)
        try {
            const res = await callAction('generate-interview-plan', {
                goal: 'full-time',
                role,
                industry,
                seniority: resumeStructured?.career_level || '',
                language: '商务英语',
            })
            if (res?.questions) setQuestions(res.questions)
        } catch (e) { }
        setLocalLoading(false)
    }

    const handleGenerateAnswer = async (q: any) => {
        setAnswerLoading(q.index)
        try {
            const res = await callAction('generate-answer', {
                question: q.question,
                questionType: q.questionType,
                questionIndex: q.index,
                role,
            })
            if (res?.sampleAnswer) {
                setAnswers(prev => ({ ...prev, [q.index]: res }))
                setExpandedAnswer(q.index)
            }
        } catch (e) { }
        setAnswerLoading(null)
    }

    const typeColor: Record<string, string> = {
        '自我介绍': 'bg-indigo-100 text-indigo-700',
        '项目经历': 'bg-blue-100 text-blue-700',
        '行为问题': 'bg-amber-100 text-amber-700',
        '专业领域': 'bg-violet-100 text-violet-700',
        '未来规划': 'bg-emerald-100 text-emerald-700',
        '反问面试官': 'bg-slate-100 text-slate-600',
    }

    const getTypeKey = (qType: string) => {
        for (const key of Object.keys(typeColor)) {
            if (qType?.includes(key)) return key
        }
        return '综合'
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">英文面试题库</h2>
                        <p className="text-xs text-slate-500 mt-0.5">根据你的简历和求职目标，AI 生成 10 道个性化英文面试题</p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={localLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {localLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {questions.length > 0 ? '重新生成' : '生成面试题'}
                    </button>
                </div>

                {!resumeStructured && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
                        💡 上传并解析简历后，面试题将更加个性化。可先在「岗位匹配」Tab 完成简历解析。
                    </div>
                )}

                {questions.length === 0 && !localLoading && (
                    <div className="text-center py-12 text-slate-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                        <p className="text-sm">点击「生成面试题」获取 10 道个性化英文面试题</p>
                    </div>
                )}

                {localLoading && (
                    <div className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">AI 正在根据你的背景生成面试题...</p>
                    </div>
                )}

                {questions.length > 0 && (
                    <div className="space-y-3">
                        {questions.map((q: any, i: number) => {
                            const typeKey = getTypeKey(q.questionType || '')
                            const colorClass = typeColor[typeKey] || 'bg-slate-100 text-slate-600'
                            const answer = answers[q.index]
                            const isExpanded = expandedAnswer === q.index
                            return (
                                <div key={q.index || i} className="border border-slate-100 rounded-xl overflow-hidden">
                                    <div className="p-4 bg-slate-50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-xs font-bold text-slate-400">Q{q.index || i + 1}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{typeKey}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-900 mb-1">{q.question}</p>
                                                {q.answerHint && <p className="text-xs text-slate-500">💡 {q.answerHint}</p>}
                                            </div>
                                            <button
                                                onClick={() => answer ? setExpandedAnswer(isExpanded ? null : q.index) : handleGenerateAnswer(q)}
                                                disabled={answerLoading === q.index}
                                                className="flex-none flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                            >
                                                {answerLoading === q.index ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                                                {answer ? (isExpanded ? '收起' : '参考回答') : '参考回答'}
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && answer && (
                                        <div className="p-4 bg-white border-t border-slate-100 animate-in fade-in duration-300">
                                            <div className="mb-3">
                                                <p className="text-xs font-semibold text-slate-500 mb-1.5">📝 英文参考回答示例</p>
                                                <p className="text-sm text-slate-800 italic bg-indigo-50 rounded-lg p-3 leading-relaxed">"{answer.sampleAnswer}"</p>
                                            </div>
                                            {answer.starBreakdown && (
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    {Object.entries(answer.starBreakdown).map(([key, val]: [string, any]) => (
                                                        <div key={key} className="bg-slate-50 rounded-lg p-2.5">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{key}</p>
                                                            <p className="text-xs text-slate-700">{val}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {answer.tips && answer.tips.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {answer.tips.map((tip: string, ti: number) => (
                                                        <span key={ti} className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">✓ {tip}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

