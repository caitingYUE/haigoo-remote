import React, { useMemo, useState, useRef } from 'react'
import { ChevronDown, Crown, Lock, Sparkles, CheckCircle2, Lightbulb, Target } from 'lucide-react'

interface MatchDetailsPanelProps {
  matchLevel?: string
  matchDetails?: any
  matchDetailsLocked?: boolean
  isMember?: boolean
  onShowUpgrade?: () => void
  className?: string
}

export function MatchDetailsPanel({
  matchLevel,
  matchDetails,
  matchDetailsLocked = false,
  isMember = false,
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
    const suggestions = Array.isArray(matchDetails.suggestions) ? matchDetails.suggestions.filter(Boolean).slice(0, 2) : []

    if (!summary && !strengths.length && !suggestions.length) return null
    return { summary, strengths, suggestions }
  }, [matchDetails])

  // If no details, fallback to string if possible, or default text
  const fallbackText = typeof matchDetails === 'string' ? matchDetails : '该岗位与您的简历背景匹配度较高，建议优先投递。'

  const hasRichContent = parsed && (parsed.strengths.length > 0 || parsed.suggestions.length > 0)
  const isExpandable = hasRichContent || (parsed && parsed.summary.length > 150) || fallbackText.length > 150

  return (
    <div className={`relative bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 border border-indigo-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 ${className}`}>
      {/* Decorative background blur */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-sky-400/10 rounded-full blur-2xl" />

      <div className="p-5 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0 rotate-3 transition-transform hover:rotate-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-slate-900 text-[15px] tracking-wide">AI 匹配分析</h4>
              {matchDetailsLocked ? (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200 flex items-center gap-1 shadow-sm">
                  <Crown className="w-3 h-3 text-amber-500" />
                  会员专属解析
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-200 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  高匹配推荐
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">基于您的求职目标与履历深度解析</p>
          </div>
        </div>

        {/* Content */}
        {!isMember || matchDetailsLocked ? (
          <div className="bg-white/80 backdrop-blur-sm border border-indigo-100/60 rounded-xl p-4 mt-2">
            <div className="flex items-start gap-3 text-slate-600 text-sm mb-3">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <p className="mt-1 leading-relaxed">该岗位为高匹配岗位，开通会员后可查看极具指导意义的完整 AI 匹配分析报告（含匹配亮点及竞争力补齐建议）。</p>
            </div>
            <button
              onClick={() => onShowUpgrade?.()}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              立刻解锁完整分析
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {parsed ? (
              <div className="space-y-4">
                {/* Summary (Always partially visible) */}
                <div className={`text-sm text-slate-700 leading-relaxed ${!expanded && isExpandable ? 'line-clamp-3' : ''}`}>
                  {parsed.summary}
                </div>

                {/* Collapsible details (Strengths & Suggestions) */}
                <div
                  ref={contentRef}
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="pt-3 space-y-4 border-t border-indigo-100/50 mt-1">
                      {/* Strengths */}
                      {parsed.strengths.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1.5 opacity-80 uppercase tracking-wider">
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

                      {/* Suggestions */}
                      {parsed.suggestions.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-1.5 opacity-80 uppercase tracking-wider">
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
                className="mt-3 group flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors w-full justify-center sm:justify-start"
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

