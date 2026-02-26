import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ArrowRight, RefreshCw, Crown, Lock, Bell, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMatchLevelClassName, getMatchLevelLabel, resolveMatchLevel } from '../utils/match-display'

export default function GeneratedPlanView({
    plan,
    isGuest,
    isMember = false,
    trackingSetupUrl = '/profile?tab=subscriptions',
    onRefreshRecommendations,
    refreshingRecommendations = false
}: {
    plan: any
    isGuest: boolean
    isMember?: boolean
    trackingSetupUrl?: string
    onRefreshRecommendations?: () => void
    refreshingRecommendations?: boolean
}) {
    if (!plan) return null;

    const recommendations = useMemo(() => (Array.isArray(plan.recommendations) ? plan.recommendations : []), [plan.recommendations])
    const remoteReadiness = useMemo(() => (plan?.plan_v2?.remoteReadiness || plan?.remoteReadiness || null), [plan])
    const readinessScore = plan?.readiness ?? remoteReadiness?.score
    const hasRecommendations = recommendations.length > 0
    const [genericJobs, setGenericJobs] = useState<Array<{ id: string; title: string; company?: string; location?: string }>>([])
    const [loadingGenericJobs, setLoadingGenericJobs] = useState(false)

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
                            <div className="flex flex-col gap-2">
                                {hasRecommendations ? recommendations.map((rec: any, i: number) => (
                                    <div key={i} className="flex flex-col p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
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
                                                            to={`/job/${job.id}`}
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
                                        <ul className="text-[11px] text-slate-600 space-y-1.5 ml-1">
                                            {(m.tasks || []).map((t: string, j: number) => (
                                                <li key={j} className="relative before:content-[''] before:absolute before:-left-2.5 before:top-1.5 before:w-1 before:h-1 before:bg-slate-300 before:rounded-full pl-1 leading-relaxed">
                                                    {t}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / CTA Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col items-center gap-3">

                <div className="flex w-full gap-2">
                    <Link to="/jobs" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm no-underline hover:no-underline">
                        去大厅查看更多岗位 <ArrowRight className="w-4 h-4" />
                    </Link>
                    {!isGuest && (
                        <Link to="/profile?tab=custom-plan" className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-slate-100 border border-slate-200 transition-colors">
                            前往个人中心查看完整版
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
