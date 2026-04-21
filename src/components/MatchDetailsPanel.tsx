import React, { useMemo, useState, useRef } from 'react'
import { ChevronDown, Crown, Lock, CheckCircle2, Lightbulb, Target } from 'lucide-react'

interface MatchDetailsPanelProps {
  matchLevel?: string
  matchDetails?: any
  matchDetailsLocked?: boolean
  isMember?: boolean
  canUseFreeTrial?: boolean
  freeTrialRemaining?: number
  isUnlocking?: boolean
  onUnlockFreeTrial?: () => void
  onShowUpgrade?: () => void
  className?: string
}

export function MatchDetailsPanel({
  matchLevel,
  matchDetails,
  matchDetailsLocked = false,
  isMember = false,
  canUseFreeTrial = false,
  freeTrialRemaining = 0,
  isUnlocking = false,
  onUnlockFreeTrial,
  onShowUpgrade,
  className = ''
}: MatchDetailsPanelProps) {
  if (matchLevel !== 'high') return null

  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const parsed = useMemo(() => {
    if (!matchDetails) return null
    const summary = String(matchDetails.summary || matchDetails.analysis || matchDetails.text || '').trim()
    const strengths = Array.isArray(matchDetails.strengths) ? matchDetails.strengths.filter(Boolean).slice(0, 3) : []
    const evidence = Array.isArray(matchDetails.evidence) ? matchDetails.evidence.filter(Boolean).slice(0, 3) : []
    const risks = Array.isArray(matchDetails.risks) ? matchDetails.risks.filter(Boolean).slice(0, 2) : []
    const suggestions = Array.isArray(matchDetails.suggestions) ? matchDetails.suggestions.filter(Boolean).slice(0, 2) : []
    const verdict = String(matchDetails.verdict || '').trim()
    const confidence = typeof matchDetails.confidence === 'object' ? matchDetails.confidence : null
    const breakdown = matchDetails.breakdown && typeof matchDetails.breakdown === 'object' ? matchDetails.breakdown : null

    if (!summary && !strengths.length && !suggestions.length && !evidence.length && !risks.length) return null
    return { summary, strengths, evidence, risks, suggestions, verdict, confidence, breakdown }
  }, [matchDetails])

  // If no details, fallback to string if possible, or default text
  const fallbackText = typeof matchDetails === 'string' ? matchDetails : '该岗位与您的简历背景匹配度较高，建议优先投递。'

  const hasRichContent = parsed && (parsed.strengths.length > 0 || parsed.suggestions.length > 0 || parsed.evidence.length > 0 || parsed.risks.length > 0 || !!parsed.breakdown)
  const isExpandable = hasRichContent || (parsed && parsed.summary.length > 150) || fallbackText.length > 150
  const scoreItems = parsed?.breakdown ? [
    { label: '方向', value: Number(parsed.breakdown.titleMatch) || 0 },
    { label: '角色', value: Number(parsed.breakdown.roleTypeMatch) || 0 },
    { label: '技能', value: Number(parsed.breakdown.skillMatch) || 0 },
    { label: '语义', value: Number(parsed.breakdown.keywordSimilarity) || 0 },
    { label: '经验', value: Number(parsed.breakdown.experienceMatch) || 0 },
    { label: '偏好', value: Number(parsed.breakdown.preferenceMatch) || 0 }
  ] : []

  return (
    <div className={`relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_22px_48px_-40px_rgba(15,23,42,0.18)] ${className}`}>
      <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-indigo-100/35 blur-3xl" />
      <div className="relative z-10 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-bold tracking-tight text-slate-900">岗位匹配分析</h4>
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                高匹配
              </span>
              {matchDetailsLocked && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Crown className="h-3 w-3 text-amber-500" />
                  VIP
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {matchDetailsLocked ? (
          <div className="rounded-2xl border border-slate-200 bg-white/88 p-4">
            <div className="mb-3 flex items-start gap-3 text-sm text-slate-600">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <p className="mt-0.5 leading-relaxed">
                {canUseFreeTrial
                  ? `该岗位支持完整匹配分析。当前账号还可免费体验 ${freeTrialRemaining} 次，VIP 可不限次数查看全部高匹配解析。`
                  : '该岗位支持完整匹配分析，开通 VIP 后可查看完整匹配依据、风险判断和优化建议。'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {canUseFreeTrial && (
                <button
                  onClick={() => onUnlockFreeTrial?.()}
                  disabled={isUnlocking}
                  className="w-full sm:w-auto rounded-xl border border-indigo-200 bg-white px-5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm transition-all hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUnlocking ? '解锁中...' : `免费体验本次分析（剩 ${freeTrialRemaining} 次）`}
                </button>
              )}
              <button
                onClick={() => onShowUpgrade?.()}
                className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_32px_-24px_rgba(79,70,229,0.5)] transition-all hover:bg-indigo-700 active:scale-[0.98]"
              >
                {isMember ? '查看完整分析' : 'VIP 无限查看'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {parsed ? (
              <div className="space-y-4">
                {/* Summary (Always partially visible) */}
                <div className={`text-sm leading-7 text-slate-700 ${!expanded && isExpandable ? 'line-clamp-3' : ''}`}>
                  {parsed.summary}
                </div>

                {scoreItems.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {scoreItems.map(item => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-center shadow-[0_10px_20px_-18px_rgba(15,23,42,0.22)]">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                        <div className="mt-1 text-sm font-bold text-slate-800">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Collapsible details (Strengths & Suggestions) */}
                <div
                  ref={contentRef}
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="mt-1 space-y-4 border-t border-slate-100 pt-3">
                      {parsed.evidence.length > 0 && (
                        <div>
                          <h5 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <Target className="w-3.5 h-3.5 text-indigo-500" />
                            核心依据
                          </h5>
                          <ul className="space-y-2">
                            {parsed.evidence.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                                <span className="text-indigo-500 font-bold mt-0.5">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Strengths */}
                      {parsed.strengths.length > 0 && (
                        <div>
                          <h5 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            核心优势
                          </h5>
                          <ul className="space-y-2">
                            {parsed.strengths.map((str: string, i: number) => (
                              <li key={i} className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                                <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {parsed.risks.length > 0 && (
                        <div>
                          <h5 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <Lightbulb className="w-3.5 h-3.5 text-rose-500" />
                            主要风险
                          </h5>
                          <ul className="space-y-2">
                            {parsed.risks.map((risk: string, i: number) => (
                              <li key={i} className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                                <span className="text-rose-500 font-bold mt-0.5">•</span>
                                <span>{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggestions */}
                      {parsed.suggestions.length > 0 && (
                        <div>
                          <h5 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            优化建议
                          </h5>
                          <ul className="space-y-2">
                            {parsed.suggestions.map((sug: string, i: number) => (
                              <li key={i} className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                                <span className="text-amber-500 font-bold mt-0.5">•</span>
                                <span>{sug}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Fallback
              <div className="text-sm text-slate-700 leading-relaxed">
                {fallbackText}
              </div>
            )}

            {/* Toggle Button */}
            {isExpandable && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="group mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 transition-colors hover:text-indigo-700 sm:justify-start"
              >
                {expanded ? '收起详情' : '展开完整分析'}
                <div className={`w-4 h-4 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors ${expanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
