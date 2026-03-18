import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Crown, Loader2, Lock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function cleanPlanText(value: any) {
    return String(value || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function toTextArray(items: any, preferredKeys: string[] = []) {
    if (!Array.isArray(items)) return []
    return items
        .map((item) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object') {
                for (const key of preferredKeys) {
                    if (item[key]) return item[key]
                }
            }
            return ''
        })
        .map(cleanPlanText)
        .filter(Boolean)
}

function normalizeQuestions(items: any, startIndex = 1) {
    if (!Array.isArray(items)) return []
    return items
        .map((item, idx) => {
            const question = cleanPlanText(typeof item === 'string' ? item : item?.question || item?.title || '')
            if (!question) return null
            return {
                id: typeof item === 'object' && item?.id ? String(item.id) : `q${startIndex + idx}`,
                question,
                focus: cleanPlanText(typeof item === 'object' ? item?.focus || item?.theme || '' : ''),
                hint: cleanPlanText(typeof item === 'object' ? item?.hint || item?.tip || item?.why_it_matters || '' : ''),
            }
        })
        .filter(Boolean)
}

function getSuitabilityLabel(level: string) {
    if (level === 'ready') return { text: '适合开始远程求职', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
    if (level === 'stretch') return { text: '建议先补基础再冲刺', className: 'bg-rose-50 text-rose-700 border-rose-100' }
    return { text: '可以尝试，但需补关键准备', className: 'bg-amber-50 text-amber-700 border-amber-100' }
}

function buildLegacyPlan(plan: any) {
    const readiness = Number(plan?.readiness ?? plan?.remoteReadiness?.score ?? 0)
    const level = readiness >= 78 ? 'ready' : readiness >= 58 ? 'prepare_more' : 'stretch'
    const legacyQuestions = normalizeQuestions(
        plan?.english_interview?.questions
        || plan?.interviewPrep?.sampleQA
        || plan?.plan_v2?.modules?.interview?.questions
        || []
    )

    const milestoneTasks = (plan?.milestones || [])
        .flatMap((item: any) => Array.isArray(item?.tasks) ? item.tasks : [])
        .map(cleanPlanText)
        .filter(Boolean)

    return {
        ...plan,
        defaults: {
            english_level: cleanPlanText(plan?.defaults?.english_level || '中等（可借助翻译软件线上交流）'),
            education_level: cleanPlanText(plan?.defaults?.education_level || '大学本科'),
            preparation_time: cleanPlanText(plan?.defaults?.preparation_time || '1-3个月'),
            weekly_commitment: cleanPlanText(plan?.defaults?.weekly_commitment || '5-10小时'),
        },
        goal_context: {
            job_direction: cleanPlanText(plan?.goal_context?.job_direction || plan?.plan_v2?.goalContext?.goal || '远程岗位方向'),
            position_type: cleanPlanText(plan?.goal_context?.position_type || '远程岗位'),
            has_resume: Array.isArray(plan?.strengths) && plan.strengths.length > 0,
        },
        suitability: {
            level,
            headline: cleanPlanText(
                plan?.suitability?.headline
                || (level === 'ready'
                    ? '整体上适合开始尝试远程岗位，并尽快进入投递和面试节奏。'
                    : level === 'stretch'
                        ? '当前更适合先补关键基础，再集中冲刺远程岗位。'
                        : '可以开始尝试远程岗位，但要先处理几项关键短板。')
            ),
            summary: cleanPlanText(plan?.suitability?.summary || plan?.summary || 'AI 已根据你的背景生成远程求职分析。'),
            strengths: toTextArray(plan?.suitability?.strengths || plan?.strengths, ['point', 'reason']).slice(0, 4),
            risks: toTextArray(plan?.suitability?.risks || plan?.gaps, ['gap', 'impact']).slice(0, 4),
            action_focus: toTextArray(plan?.suitability?.action_focus || milestoneTasks).slice(0, 5),
        },
        english_interview: {
            summary: cleanPlanText(
                plan?.english_interview?.summary
                || plan?.interviewPrep?.languageTip
                || plan?.plan_v2?.modules?.interview?.summary
                || '建议先准备英文自我介绍、项目经历和远程协作表达。'
            ),
            question_limit: legacyQuestions.length || 5,
            member_maximum: 30,
            resume_personalized: Array.isArray(plan?.strengths) && plan.strengths.length > 0,
            questions: legacyQuestions,
        },
    }
}

function normalizePlanForRender(plan: any) {
    if (!plan) return null
    if (plan?.plan_version === 'copilot_plan_v3' || plan?.defaults || plan?.suitability || plan?.english_interview) {
        return buildLegacyPlan(plan)
    }
    return buildLegacyPlan(plan)
}

export default function GeneratedPlanView({
    plan,
    isGuest,
    openInNewTab = false,
    showProfileCta = true,
    showSavedHint = false,
}: {
    plan: any
    isGuest: boolean
    openInNewTab?: boolean
    showProfileCta?: boolean
    showSavedHint?: boolean
}) {
    const { token, isMember } = useAuth()
    const normalizedPlan = useMemo(() => normalizePlanForRender(plan), [plan])
    const [questions, setQuestions] = useState<any[]>(normalizedPlan?.english_interview?.questions || [])
    const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, any>>({})
    const [expanding, setExpanding] = useState(false)
    const [answerLoadingId, setAnswerLoadingId] = useState<string | null>(null)
    const [actionError, setActionError] = useState('')

    useEffect(() => {
        setQuestions(normalizedPlan?.english_interview?.questions || [])
        setAnswersByQuestion({})
        setActionError('')
    }, [normalizedPlan])

    if (!normalizedPlan) return null

    const defaults = normalizedPlan.defaults || {}
    const suitability = normalizedPlan.suitability || {}
    const readinessScore = normalizedPlan.readiness
    const interview = normalizedPlan.english_interview || {}
    const suitabilityBadge = getSuitabilityLabel(String(suitability.level || 'prepare_more'))
    const questionLimit = Number(interview.member_maximum || 30)
    const canExpandInterview = !isGuest && isMember && questions.length < questionLimit
    const canGenerateAnswer = !isGuest && isMember
    const hasResume = Boolean(normalizedPlan?.goal_context?.has_resume)

    const handleExpandInterview = async () => {
        if (!token || !canExpandInterview) return
        setExpanding(true)
        setActionError('')
        try {
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: 'interview-prep',
                    batchSize: 10,
                    existingQuestions: questions,
                    jobDirection: normalizedPlan?.goal_context?.job_direction,
                    positionType: normalizedPlan?.goal_context?.position_type,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || data?.error || '拓展面试题失败')
            if (Array.isArray(data?.questions)) {
                setQuestions(data.questions)
            } else if (data?.planData?.english_interview?.questions) {
                setQuestions(data.planData.english_interview.questions)
            }
        } catch (error: any) {
            setActionError(error?.message || '拓展面试题失败')
        } finally {
            setExpanding(false)
        }
    }

    const handleGenerateAnswer = async (questionItem: any) => {
        if (!token || !canGenerateAnswer) return
        const key = questionItem.id || questionItem.question
        setAnswerLoadingId(key)
        setActionError('')
        try {
            const res = await fetch('/api/copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    action: 'generate-answer',
                    question: questionItem.question,
                    jobTitle: `${normalizedPlan?.goal_context?.job_direction || ''} ${normalizedPlan?.goal_context?.position_type || ''}`.trim(),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || data?.error || '生成回答失败')
            setAnswersByQuestion((prev) => ({ ...prev, [key]: data }))
        } catch (error: any) {
            setActionError(error?.message || '生成回答失败')
        } finally {
            setAnswerLoadingId(null)
        }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden relative z-30">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div>
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.15em] mb-0.5">
                        AI Copilot · 专属方案
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        你的远程求职完整规划
                    </h3>
                </div>
                {typeof readinessScore === 'number' && (
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

            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar relative pr-2 pb-4">
                <div className="absolute left-[15px] top-6 bottom-6 w-px bg-gradient-to-b from-indigo-200 via-slate-100 to-transparent pointer-events-none z-0" />

                <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.4s_ease-out]">
                    <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                        <div className="text-sm font-bold text-slate-800 mb-3">默认参考项</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                { label: '英语能力', value: defaults.english_level },
                                { label: '学历背景', value: defaults.education_level },
                                { label: '准备周期', value: defaults.preparation_time },
                                { label: '每周投入', value: defaults.weekly_commitment },
                            ].map((item) => (
                                <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                                    <div className="text-[11px] text-slate-500 mb-1">{item.label}</div>
                                    <div className="text-sm font-semibold text-slate-800">{cleanPlanText(item.value)}</div>
                                </div>
                            ))}
                        </div>
                        {!isMember && (
                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700">
                                <Lock className="w-3.5 h-3.5 mt-0.5 flex-none" />
                                <span>调整默认项并重新生成方案为会员功能。</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.5s_ease-out]">
                    <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="text-sm font-bold text-slate-800">总概括结论</div>
                            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${suitabilityBadge.className}`}>
                                {suitabilityBadge.text}
                            </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mb-1.5">{cleanPlanText(suitability.headline)}</div>
                        <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{cleanPlanText(suitability.summary)}</div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                            <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
                                <div className="text-xs font-bold text-emerald-700 mb-2">你当前的优势</div>
                                <ul className="space-y-1.5 text-[11px] text-slate-600">
                                    {(suitability.strengths || []).slice(0, 3).map((item: string, idx: number) => (
                                        <li key={idx} className="leading-relaxed">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-xl border border-amber-100 bg-white px-3 py-3">
                                <div className="text-xs font-bold text-amber-700 mb-2">需要更多准备的点</div>
                                <ul className="space-y-1.5 text-[11px] text-slate-600">
                                    {(suitability.risks || []).slice(0, 3).map((item: string, idx: number) => (
                                        <li key={idx} className="leading-relaxed">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-xl border border-indigo-100 bg-white px-3 py-3">
                                <div className="text-xs font-bold text-indigo-700 mb-2">建议优先动作</div>
                                <ul className="space-y-1.5 text-[11px] text-slate-600">
                                    {(suitability.action_focus || []).slice(0, 4).map((item: string, idx: number) => (
                                        <li key={idx} className="leading-relaxed">• {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative pl-10 z-10 animate-[fadeSlideIn_0.6s_ease-out]">
                    <div className="absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm bg-indigo-600 border-indigo-600 text-white">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100/60 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                            <div>
                                <div className="text-sm font-bold text-slate-800">英文面试方案准备</div>
                                <div className="text-xs text-slate-600 mt-1 leading-relaxed">{cleanPlanText(interview.summary)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                                    当前 {questions.length} / 上限 {questionLimit}
                                </span>
                                {canExpandInterview && (
                                    <button
                                        type="button"
                                        onClick={handleExpandInterview}
                                        disabled={expanding}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                                    >
                                        {expanding ? '拓展中...' : '再拓展 10 题'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {!hasResume && !isGuest && (
                            <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700">
                                当前未检测到简历，以下问题为通用版提纲。上传简历后再生成，问题会更贴合你的工作经历。
                            </div>
                        )}

                        {isGuest && (
                            <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-[11px] text-indigo-700">
                                登录并上传简历后可生成 5 道更贴合自己的英文面试提纲。
                            </div>
                        )}

                        {!isGuest && !isMember && (
                            <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700 flex items-start gap-2">
                                <Crown className="w-3.5 h-3.5 mt-0.5 flex-none" />
                                <span>当前可查看基础面试提纲。升级会员后可逐批拓展到 30 道，并生成每道题的回答草稿。</span>
                            </div>
                        )}

                        {actionError && (
                            <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">
                                {actionError}
                            </div>
                        )}

                        <div className="space-y-3">
                            {questions.map((item, idx) => {
                                const answerState = answersByQuestion[item.id || item.question]
                                const isAnswerLoading = answerLoadingId === (item.id || item.question)
                                return (
                                    <div key={item.id || idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-bold text-indigo-600 mb-1">Question {idx + 1}</div>
                                                <div className="text-sm font-semibold text-slate-900 leading-relaxed">{item.question}</div>
                                                {item.focus && <div className="mt-2 text-[11px] text-slate-500">考察重点：{item.focus}</div>}
                                                {item.hint && <div className="mt-1 text-[11px] text-slate-500">回答提示：{item.hint}</div>}
                                            </div>
                                            {canGenerateAnswer && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleGenerateAnswer(item)}
                                                    disabled={isAnswerLoading}
                                                    className="sm:ml-4 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 disabled:opacity-60 transition-colors"
                                                >
                                                    {isAnswerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                    生成回答
                                                </button>
                                            )}
                                        </div>

                                        {answerState?.answer && (
                                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                                                <div className="text-[11px] font-bold text-emerald-700 mb-1.5">回答草稿</div>
                                                <div className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">{cleanPlanText(answerState.answer)}</div>
                                                {Array.isArray(answerState.highlights) && answerState.highlights.length > 0 && (
                                                    <div className="mt-2 text-[11px] text-slate-600">
                                                        亮点提示：{answerState.highlights.map(cleanPlanText).filter(Boolean).join(' · ')}
                                                    </div>
                                                )}
                                                {answerState.followUp && (
                                                    <div className="mt-1 text-[11px] text-slate-600">补充建议：{cleanPlanText(answerState.followUp)}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col items-center gap-3">
                {showSavedHint && !isGuest && (
                    <div className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-indigo-900">方案已同步到个人中心</div>
                            <div className="text-xs text-indigo-700 mt-1">后续可在个人中心继续查看完整方案，并结合会员权益做拓展与深度打磨。</div>
                        </div>
                        {showProfileCta && (
                            <Link
                                to="/profile?tab=custom-plan"
                                target={openInNewTab ? '_blank' : undefined}
                                rel={openInNewTab ? 'noopener noreferrer' : undefined}
                                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white text-indigo-700 border border-indigo-200 text-sm font-semibold hover:bg-indigo-100 transition-colors no-underline hover:no-underline"
                            >
                                去个人中心查看
                            </Link>
                        )}
                    </div>
                )}
                <div className="flex w-full gap-2">
                    <Link
                        to="/jobs"
                        target={openInNewTab ? '_blank' : undefined}
                        rel={openInNewTab ? 'noopener noreferrer' : undefined}
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm no-underline hover:no-underline"
                    >
                        去大厅查看更多岗位 <ArrowRight className="w-4 h-4" />
                    </Link>
                    {!isGuest && showProfileCta && (
                        <Link
                            to="/profile?tab=custom-plan"
                            target={openInNewTab ? '_blank' : undefined}
                            rel={openInNewTab ? 'noopener noreferrer' : undefined}
                            className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-slate-100 border border-slate-200 transition-colors no-underline hover:no-underline"
                        >
                            前往个人中心查看完整版
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
