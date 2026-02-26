import React, { useMemo, useState } from 'react'
import { ChevronDown, Crown, Lock, Sparkles } from 'lucide-react'

interface MatchDetailsPanelProps {
  matchLevel?: string
  matchDetails?: any
  matchDetailsLocked?: boolean
  isMember?: boolean
  onShowUpgrade?: () => void
  className?: string
}

const COLLAPSE_LIMIT = 220
const MAX_CONTENT_LENGTH = 1200

function normalizeContent(details: any): string {
  if (!details) return ''

  const summary = String(details.summary || details.analysis || details.text || '').trim()
  const strengths = Array.isArray(details.strengths) ? details.strengths.filter(Boolean).slice(0, 3) : []
  const suggestions = Array.isArray(details.suggestions) ? details.suggestions.filter(Boolean).slice(0, 2) : []

  const parts = [summary]
  if (strengths.length) parts.push(`匹配亮点：${strengths.join('；')}`)
  if (suggestions.length) parts.push(`优化建议：${suggestions.join('；')}`)

  const combined = parts.filter(Boolean).join('\n\n').trim()
  if (!combined) return ''
  if (combined.length <= MAX_CONTENT_LENGTH) return combined
  return `${combined.slice(0, MAX_CONTENT_LENGTH)}...`
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
  const content = useMemo(() => normalizeContent(matchDetails), [matchDetails])
  const hasOverflow = content.length > COLLAPSE_LIMIT
  const displayText = hasOverflow && !expanded ? `${content.slice(0, COLLAPSE_LIMIT)}...` : content

  return (
    <div className={`bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-xl overflow-hidden shadow-sm ${className}`}>
      <div className="p-4 relative">
        <div className="absolute top-3 right-3 opacity-20">
          <Sparkles className="w-10 h-10 text-indigo-500" />
        </div>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-900 text-base">岗位匹配分析</h4>
                <span className="px-2 py-0.5 bg-white/70 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-100">
                  [AI匹配分析]
                </span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-100 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  会员专属
                </span>
              </div>
            </div>

            {!isMember || matchDetailsLocked ? (
              <div className="bg-white/70 border border-indigo-100 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-600 text-sm mb-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                  该岗位为高匹配岗位，开通会员后可查看完整 AI 匹配分析结论。
                </div>
                <button
                  onClick={() => onShowUpgrade?.()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  开通会员查看分析
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {displayText || '该岗位与您的简历背景匹配度较高，建议优先投递。'}
              </div>
            )}

            {isMember && !matchDetailsLocked && hasOverflow && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {expanded ? '收起分析' : '展开分析'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

