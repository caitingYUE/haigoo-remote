import { CheckCircle2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function GeneratedPlanView({ plan, isGuest }: { plan: any, isGuest: boolean }) {
    if (!plan) return null;

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
                {plan.readiness !== undefined && (
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            准备度 {plan.readiness}%
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
                {plan.recommendations && plan.recommendations.length > 0 && (
                    <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.5s_ease-out]">
                        <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                            <div className="text-sm font-bold text-slate-800 mb-3">高匹配度方向推荐</div>
                            <div className="flex flex-col gap-2">
                                {plan.recommendations.map((rec: any, i: number) => (
                                    <div key={i} className="flex flex-col p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs font-bold text-slate-800">{rec.role || rec.title}</div>
                                            {(rec.company || rec.matchScore) && (
                                                <div className="text-[10px] text-indigo-500 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    {rec.company} {rec.matchScore ? `· 匹配 ${rec.matchScore}` : ''}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 leading-snug">{rec.reason}</div>
                                    </div>
                                ))}
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
                {isGuest && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2 border border-amber-100 font-medium w-full text-center">
                        <span className="inline-block mr-1">⚠️</span> 方案仅缓存 5 分钟，<Link to="/login" className="text-amber-700 hover:text-amber-800 font-medium hover:underline">立即登录</Link> 保存并解锁更多功能。
                    </div>
                )}
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
