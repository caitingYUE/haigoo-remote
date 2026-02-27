import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ArrowRight, RefreshCw, Crown, Lock, Bell, Compass, Loader2, Languages, MessageSquare, Send, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMatchLevelClassName, getMatchLevelLabel, resolveMatchLevel } from '../utils/match-display'
import { useAuth } from '../contexts/AuthContext'
import { trackingService } from '../services/tracking-service'

export default function GeneratedPlanView({
    plan,
    isGuest,
    isMember = false,
    deepMode = false,
    onModuleDataUpdate,
    trackingSetupUrl = '/profile?tab=subscriptions',
    onRefreshRecommendations,
    refreshingRecommendations = false
}: {
    plan: any
    isGuest: boolean
    isMember?: boolean
    deepMode?: boolean
    onModuleDataUpdate?: (module: 'language' | 'interview' | 'apply', data: any) => void
    trackingSetupUrl?: string
    onRefreshRecommendations?: () => void
    refreshingRecommendations?: boolean
}) {
    if (!plan) return null;

    const { token } = useAuth()
    const recommendations = useMemo(() => (Array.isArray(plan.recommendations) ? plan.recommendations : []), [plan.recommendations])
    const remoteReadiness = useMemo(() => (plan?.plan_v2?.remoteReadiness || plan?.remoteReadiness || null), [plan])
    const readinessScore = plan?.readiness ?? remoteReadiness?.score
    const copilotGoal = useMemo(() => String(plan?.plan_v2?.goalContext?.goal || '').trim(), [plan])
    const jobsBrowseUrl = useMemo(() => {
        if (!copilotGoal) return '/jobs'
        const params = new URLSearchParams({ copilotGoal })
        return `/jobs?${params.toString()}`
    }, [copilotGoal])
    const moduleSummaries = useMemo(() => ({
        language: plan?.plan_v2?.modules?.language?.summary || plan?.interviewPrep?.languageTip || '补齐语言表达短板后，远程面试与跨时区协作成功率会明显提升。',
        interview: plan?.plan_v2?.modules?.interview?.summary || (Array.isArray(plan?.interviewPrep?.commonQuestions) && plan.interviewPrep.commonQuestions.length > 0 ? `已识别 ${plan.interviewPrep.commonQuestions.length} 条高频面试问题，建议先做结构化回答演练。` : '建议先完成行为题和项目题的 STAR 结构回答准备。'),
        apply: plan?.plan_v2?.modules?.apply?.summary || plan?.applicationPlan?.timeline || '建议建立每周投递节奏并持续复盘转化数据。'
    }), [plan])
    const hasRecommendations = recommendations.length > 0
    const [genericJobs, setGenericJobs] = useState<Array<{ id: string; title: string; company?: string; location?: string }>>([])
    const [loadingGenericJobs, setLoadingGenericJobs] = useState(false)
    const [moduleResults, setModuleResults] = useState<Record<string, any>>({})
    const [moduleLoading, setModuleLoading] = useState<Record<string, boolean>>({})
    const [moduleError, setModuleError] = useState<Record<string, string>>({})
    const [moduleCollapsed, setModuleCollapsed] = useState<Record<string, boolean>>({
        language: false,
        interview: false,
        apply: false
    })

    const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set())
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
    const [progressSuggestion, setProgressSuggestion] = useState<{
        next_focus?: string;
        suggestions?: string[];
        motivation?: string;
    } | null>(null);

    const toggleTaskStatus = async (phase: string, task: string, isCompleted: boolean) => {
        if (!token || !isMember) return;

        const taskKey = `${phase}-${task}`;
        setUpdatingTasks(prev => new Set(prev).add(taskKey));

        try {
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'update-progress',
                    phase,
                    taskName: task,
                    status: isCompleted ? 'completed' : 'in_progress'
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setCompletedTasks(prev => {
                    const next = new Set(prev);
                    if (isCompleted) next.add(taskKey);
                    else next.delete(taskKey);
                    return next;
                });
                if (data.suggestion) {
                    setProgressSuggestion(data.suggestion);
                }
            }
        } catch (err) {
            console.error('Failed to update task progress', err);
        } finally {
            setUpdatingTasks(prev => {
                const next = new Set(prev);
                next.delete(taskKey);
                return next;
            });
        }
    };

    useEffect(() => {
        let mounted = true

        const fetchGenericJobs = async () => {
            if (hasRecommendations) {
                if (mounted) setGenericJobs([])
                return
            }

            setLoadingGenericJobs(true)
            try {
                const params = new URLSearchParams({
                    page: '1',
                    limit: '3',
                    location: 'Remote',
                    experienceLevel: 'entry,junior',
                    sortBy: 'recent',
                    isApproved: 'true'
                })
                const res = await fetch(`/api/data/processed-jobs?${params.toString()}`)
                const data = await res.json()
                if (!mounted) return
                const jobs = Array.isArray(data?.jobs) ? data.jobs : []
                setGenericJobs(
                    jobs.slice(0, 3).map((job: any) => ({
                        id: String(job.id),
                        title: job.title,
                        company: job.company,
                        location: job.location
                    }))
                )
            } catch (_err) {
                if (mounted) setGenericJobs([])
            } finally {
                if (mounted) setLoadingGenericJobs(false)
            }
        }

        fetchGenericJobs()
        return () => { mounted = false }
    }, [hasRecommendations])

    useEffect(() => {
        const baseModules = plan?.plan_v2?.modules
        if (!baseModules || typeof baseModules !== 'object') {
            setModuleResults({})
            return
        }
        const normalized: Record<string, any> = {}
            ; (['language', 'interview', 'apply'] as const).forEach((key) => {
                if (baseModules[key]) {
                    normalized[key] = baseModules[key]
                }
            })
        setModuleResults(normalized)
    }, [plan?.plan_v2?.modules])

    const fetchExpandedModule = async (module: 'language' | 'interview' | 'apply', intent: string, forceRefresh = false) => {
        if (!token) return
        if (!isMember) return

        const questionFromPlan = module === 'interview'
            ? (moduleResults.interview?.questions?.[0]?.question || plan?.interviewPrep?.commonQuestions?.[0] || '')
            : ''

        setModuleError(prev => ({ ...prev, [module]: '' }))
        setModuleLoading(prev => ({ ...prev, [module]: true }))
        trackingService.track('copilot_module_expand_clicked', { module, intent, source: deepMode ? 'profile_center' : 'home' })

        try {
            const response = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'expand-module',
                    module,
                    intent,
                    forceRefresh,
                    question: questionFromPlan || undefined,
                    goal: copilotGoal || undefined,
                    timeline: plan?.plan_v2?.goalContext?.timeline || undefined,
                    language: plan?.plan_v2?.goalContext?.language || undefined
                })
            })

            const data = await response.json()
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || data?.error || '模块生成失败')
            }

            const mergedData = {
                ...(data?.moduleData || {}),
                generatedAt: data?.generatedAt || new Date().toISOString(),
                lastIntent: intent
            }
            setModuleResults(prev => ({
                ...prev,
                [module]: {
                    ...(prev[module] || {}),
                    ...mergedData
                }
            }))
            onModuleDataUpdate?.(module, mergedData)
        } catch (err: any) {
            setModuleError(prev => ({ ...prev, [module]: err?.message || '生成失败，请稍后重试' }))
        } finally {
            setModuleLoading(prev => ({ ...prev, [module]: false }))
        }
    }

    const toggleModuleCollapsed = (module: 'language' | 'interview' | 'apply') => {
        setModuleCollapsed(prev => ({ ...prev, [module]: !prev[module] }))
    }

    return (
        <div className="flex flex-col h-full overflow-hidden relative z-30">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em] mb-0.5">
                        AI Copilot · 专属方案
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        你的远程求职准备计划
                    </h3>
                </div>
                {readinessScore !== undefined && readinessScore !== null && (
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            准备度 {readinessScore}%
                        </div>
                    </div>
                )}
            </div>

            {/* Scrollable Timeline Steps */}
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar relative pr-2 pb-4">
                {/* Connector line (shared absolute bg) */}
                <div className="absolute left-[15px] top-6 bottom-6 w-px bg-gradient-to-b from-indigo-200 via-slate-100 to-transparent pointer-events-none z-0" />

                {/* Step 1 - Diagnosis / Summary */}
                <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.4s_ease-out]">
                    <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                        <div className="text-sm font-bold text-slate-800 mb-2">背景与竞争力诊断</div>
                        {remoteReadiness?.summary && (
                            <div className="mb-2.5 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-2 leading-relaxed">
                                <span className="font-semibold mr-1">远程适配结论：</span>
                                {remoteReadiness.summary}
                            </div>
                        )}
                        <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                            {plan.summary || "AI 已成功为您生成求职诊断分析。"}
                        </div>
                        {(!plan.strengths || plan.strengths.length === 0) && (
                            <div className="mt-3 text-[11px] text-slate-400 italic">
                                提示：未上传简历或数据不足，当前仅提供通用职业基础分析。
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 2 - Recommendations */}
                {(
                    <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.5s_ease-out]">
                        <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="text-sm font-bold text-slate-800">高匹配度方向推荐</div>
                                {onRefreshRecommendations && (
                                    <button
                                        onClick={onRefreshRecommendations}
                                        disabled={refreshingRecommendations}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-white border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-60"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingRecommendations ? 'animate-spin' : ''}`} />
                                        刷新岗位
                                    </button>
                                )}
                            </div>
                            <div className={`flex flex-col gap-2 transition-opacity duration-300 ${refreshingRecommendations ? 'opacity-40 pointer-events-none' : ''}`}>
                                {hasRecommendations ? recommendations.map((rec: any, i: number) => (
                                    <div key={i} className="flex flex-col p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <span>{rec.role || rec.title}</span>
                                                {rec.aiRecommended && (
                                                    <span className="px-1.5 py-0.5 rounded border border-indigo-100 bg-indigo-50 text-indigo-600 text-[10px] font-semibold">
                                                        AI推荐
                                                    </span>
                                                )}
                                            </div>
                                            {(rec.company || rec.matchLevel || rec.matchScore || rec.matchLabel) && (
                                                <div className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    {rec.company}
                                                    {(() => {
                                                        const numericScore = Number(String(rec.matchScore || '').replace(/[^0-9]/g, '')) || 0
                                                        const level = rec.matchLevel || resolveMatchLevel(numericScore, rec.matchLevel || rec.match_label || rec.level)
                                                        const levelText = rec.matchLabel || rec.match || getMatchLevelLabel(level) || rec.matchScore
                                                        const levelClass = getMatchLevelClassName(level)
                                                        return levelText ? (
                                                            <span className={`px-1.5 py-0.5 rounded border ${levelClass}`}>
                                                                {levelText}
                                                            </span>
                                                        ) : null
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 leading-snug">
                                            {rec.reason || rec.matchDetails?.summary || '该岗位与您的背景方向匹配，建议优先关注。'}
                                        </div>
                                        {(rec.matchLevel === 'high' || rec.matchLabel === '高匹配') && (
                                            <div className="mt-1.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 flex items-center gap-1.5">
                                                {isMember ? (
                                                    <>
                                                        <Crown className="w-3 h-3 text-amber-500" />
                                                        <span>{rec.matchDetails?.summary ? '[AI匹配分析] 已纳入推荐理由' : '[AI匹配分析] 已启用'}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Lock className="w-3 h-3 text-slate-400" />
                                                        <span>会员可查看完整 AI 匹配分析结论</span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="text-sm font-bold text-slate-800 mb-1">暂无特别匹配的岗位</div>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            建议过 1-2 天再来看看，我们会持续更新岗位池并重新匹配你的背景。
                                        </p>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <Link
                                                to={isGuest ? '/login' : trackingSetupUrl}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                                            >
                                                <Bell className="w-3.5 h-3.5" />
                                                添加岗位追踪
                                            </Link>
                                            <Link
                                                to="/jobs?search=entry%20level%20remote"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                                            >
                                                <Compass className="w-3.5 h-3.5" />
                                                查看通用岗位
                                            </Link>
                                        </div>

                                        <div className="mt-3">
                                            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">入门级远程岗位推荐</div>
                                            {loadingGenericJobs ? (
                                                <div className="text-[11px] text-slate-400">正在加载通用岗位...</div>
                                            ) : genericJobs.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {genericJobs.map((job) => (
                                                        <Link
                                                            key={job.id}
                                                            to={copilotGoal ? `/job/${job.id}?copilotGoal=${encodeURIComponent(copilotGoal)}` : `/job/${job.id}`}
                                                            className="block p-2 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                                                        >
                                                            <div className="text-xs font-semibold text-slate-800 line-clamp-1">{job.title}</div>
                                                            <div className="text-[11px] text-slate-500 line-clamp-1">{job.company || '未知公司'} {job.location ? `· ${job.location}` : ''}</div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-slate-400">当前暂无可展示的通用岗位，请稍后再试。</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {deepMode && (
                    <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.55s_ease-out]">
                        <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-bold text-slate-800">深度模块扩展</div>
                                <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">个人中心专属</span>
                            </div>

                            {!isMember && (
                                <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                                        开通会员可解锁语言准备、面试扩展与投递计划的深度生成。
                                    </div>
                                    <Link to="/membership" className="px-2 py-1 rounded-md bg-amber-100 border border-amber-200 text-[10px] font-semibold text-amber-700 hover:bg-amber-200">
                                        去开通
                                    </Link>
                                </div>
                            )}

                            <div className="space-y-2.5">
                                {[
                                    { key: 'language', title: '语言准备方案', icon: Languages, primaryIntent: 'deep-plan', primaryLabel: '展开方案', secondaryIntent: 'resources', secondaryLabel: '扩展资源' },
                                    { key: 'interview', title: '面试准备方案', icon: MessageSquare, primaryIntent: 'more-questions', primaryLabel: '更多问题', secondaryIntent: 'mock-answer', secondaryLabel: '模拟回答' },
                                    { key: 'apply', title: '投递执行计划', icon: Send, primaryIntent: 'deep-plan', primaryLabel: '展开计划', secondaryIntent: 'sprint', secondaryLabel: '两周冲刺' }
                                ].map((item) => {
                                    const key = item.key as 'language' | 'interview' | 'apply'
                                    const detail = moduleResults[key] || null
                                    const loading = Boolean(moduleLoading[key])
                                    const collapsed = Boolean(moduleCollapsed[key])
                                    const error = moduleError[key]
                                    const Icon = item.icon
                                    const summary = detail?.summary || moduleSummaries[key]

                                    return (
                                        <div key={key} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center flex-none">
                                                        <Icon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                                                        {loading ? (
                                                            <div className="mt-2 space-y-2 animate-pulse mb-2">
                                                                <div className="h-2.5 bg-indigo-100 rounded w-5/6"></div>
                                                                <div className="h-2.5 bg-slate-100 rounded w-4/6"></div>
                                                                <div className="flex items-center gap-1.5 mt-2">
                                                                    <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                                                                    <span className="text-[10px] text-indigo-500 font-medium tracking-wide">AI 正在为您深度生成专属方案，由于需要深度检索，平均约需 5~10 秒，请稍候...</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className={`text-[11px] text-slate-500 leading-relaxed mt-1 ${collapsed ? 'line-clamp-2' : ''}`}>
                                                                {summary}
                                                            </p>
                                                        )}
                                                        {error && (
                                                            <div className="text-[10px] text-rose-600 mt-1 bg-rose-50 border border-rose-100 rounded px-2 py-1">{error}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleModuleCollapsed(key)}
                                                    className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                                                >
                                                    {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                                    {collapsed ? '展开' : '收起'}
                                                </button>
                                            </div>

                                            {!collapsed && detail && (
                                                <div className="mt-2 pl-9 text-[11px] text-slate-600 space-y-1.5">
                                                    {Array.isArray(detail?.roadmap) && detail.roadmap.slice(0, 2).map((step: any, idx: number) => (
                                                        <div key={`roadmap-${idx}`}>• {step?.phase || `阶段${idx + 1}`}：{step?.focus || ''}</div>
                                                    ))}
                                                    {Array.isArray(detail?.questions) && detail.questions.slice(0, 3).map((q: any, idx: number) => (
                                                        <div key={`q-${idx}`}>• {q?.question || ''}</div>
                                                    ))}
                                                    {Array.isArray(detail?.weeklyPlan) && detail.weeklyPlan.slice(0, 2).map((w: any, idx: number) => (
                                                        <div key={`weekly-${idx}`}>• {w?.week || `Week ${idx + 1}`}：目标投递 {w?.targetCount || '-'} 个</div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-2.5 pl-9 flex flex-wrap items-center gap-2">
                                                <button
                                                    disabled={!isMember || loading}
                                                    onClick={() => fetchExpandedModule(key, item.primaryIntent)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                                                >
                                                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                    {item.primaryLabel}
                                                </button>
                                                <button
                                                    disabled={!isMember || loading}
                                                    onClick={() => fetchExpandedModule(key, item.secondaryIntent)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-md hover:bg-slate-200 disabled:opacity-50"
                                                >
                                                    {item.secondaryLabel}
                                                </button>
                                                {detail && (
                                                    <button
                                                        disabled={!isMember || loading}
                                                        onClick={() => fetchExpandedModule(key, detail?.lastIntent || item.primaryIntent, true)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                                                    >
                                                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                                        刷新
                                                    </button>
                                                )}
                                                {detail?.generatedAt && (
                                                    <span className="text-[10px] text-slate-400">
                                                        更新于 {new Date(detail.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3 - Milestones */}
                {plan.milestones && plan.milestones.length > 0 && (
                    <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.6s_ease-out]">
                        <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                            <div className="text-sm font-bold text-slate-800 mb-3">关键行动路线</div>
                            <div className="space-y-4">
                                {plan.milestones.map((m: any, i: number) => (
                                    <div key={i} className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                {m.month || `阶段 ${i + 1}`}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-700">{m.focus}</span>
                                        </div>
                                        <ul className="text-[11px] flex flex-col gap-2 mt-2">
                                            {(m.tasks || []).map((t: string, j: number) => {
                                                const phase = m.month || `阶段 ${i + 1}`;
                                                const taskKey = `${phase}-${t}`;
                                                const isCompleted = completedTasks.has(taskKey);
                                                const isUpdating = updatingTasks.has(taskKey);

                                                return (
                                                    <li key={j} className="flex items-start gap-2.5 group">
                                                        <button
                                                            onClick={() => toggleTaskStatus(phase, t, !isCompleted)}
                                                            disabled={isUpdating || !isMember}
                                                            className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border ${isCompleted
                                                                ? 'bg-indigo-600 border-indigo-600'
                                                                : 'bg-white border-slate-300 group-hover:border-indigo-400'
                                                                } flex items-center justify-center transition-colors disabled:opacity-50`}
                                                            title={isMember ? (isCompleted ? "取消完成" : "标记完成") : "会员专属功能"}
                                                        >
                                                            {isCompleted && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                                        </button>
                                                        <span className={`leading-relaxed transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                                            {t}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>

                            {progressSuggestion && (
                                <div className="mt-4 p-3 bg-indigo-50/80 border border-indigo-100 rounded-lg animate-[fadeSlideIn_0.3s_ease-out]">
                                    <div className="text-xs font-bold text-indigo-800 flex items-center gap-1.5 mb-2">
                                        <Crown className="w-3.5 h-3.5" /> AI 下一步建议
                                    </div>
                                    {progressSuggestion.next_focus && (
                                        <div className="text-[11px] text-indigo-700 font-semibold mb-1">
                                            核心聚焦: {progressSuggestion.next_focus}
                                        </div>
                                    )}
                                    {progressSuggestion.suggestions && progressSuggestion.suggestions.length > 0 && (
                                        <ul className="text-[11px] text-indigo-600 space-y-1 ml-4 list-disc marker:text-indigo-400">
                                            {progressSuggestion.suggestions.map((s, idx) => (
                                                <li key={idx} className="pl-0.5">{s}</li>
                                            ))}
                                        </ul>
                                    )}
                                    {progressSuggestion.motivation && (
                                        <div className="mt-2 text-[10px] text-indigo-500 italic block border-l-2 border-indigo-200 pl-2">
                                            “{progressSuggestion.motivation}”
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / CTA Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col items-center gap-3">

                <div className="flex w-full gap-2">
                    <Link to={jobsBrowseUrl} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm no-underline hover:no-underline">
                        去大厅查看更多岗位 <ArrowRight className="w-4 h-4" />
                    </Link>
                    {!isGuest && !deepMode && (
                        <Link to="/profile?tab=custom-plan" className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-slate-100 border border-slate-200 transition-colors">
                            前往个人中心查看完整版
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
