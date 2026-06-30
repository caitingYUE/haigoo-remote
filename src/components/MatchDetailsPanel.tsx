import React, { useMemo } from 'react'
import { Upload } from 'lucide-react'

interface MatchDetailsPanelProps {
  matchLevel?: string
  matchDetails?: any
  hasResume?: boolean
  compactUploadPrompt?: boolean
  onUploadResume?: () => void
  className?: string
}

const MATCH_SUMMARY_MAX_CHARS = 150

function buildCompactSummary(value: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) || [text]
  const picked: string[] = []

  for (const sentence of sentences) {
    const next = [...picked, sentence.trim()].join('')
    if (next.length > MATCH_SUMMARY_MAX_CHARS && picked.length > 0) break
    picked.push(sentence.trim())
    if (picked.length >= 3 || next.length >= MATCH_SUMMARY_MAX_CHARS * 0.8) break
  }

  let summary = picked.join('').trim()
  if (!summary) summary = text
  if (summary.length > MATCH_SUMMARY_MAX_CHARS) {
    const cut = summary.slice(0, MATCH_SUMMARY_MAX_CHARS)
    const punctuationIndex = Math.max(
      cut.lastIndexOf('。'),
      cut.lastIndexOf('！'),
      cut.lastIndexOf('？'),
      cut.lastIndexOf('.'),
      cut.lastIndexOf('!'),
      cut.lastIndexOf('?'),
      cut.lastIndexOf('，'),
      cut.lastIndexOf(','),
      cut.lastIndexOf('；'),
      cut.lastIndexOf(';')
    )
    summary = cut.slice(0, punctuationIndex > 72 ? punctuationIndex : MATCH_SUMMARY_MAX_CHARS).trim()
  }
  return /[。！？.!?]$/.test(summary) ? summary : `${summary}。`
}

export function MatchDetailsPanel({
  matchLevel,
  matchDetails,
  hasResume = true,
  compactUploadPrompt = false,
  onUploadResume,
  className = ''
}: MatchDetailsPanelProps) {
  const parsed = useMemo(() => {
    if (!matchDetails) return null
    const summary = String(matchDetails.summary || matchDetails.analysis || matchDetails.text || '').trim()
    const breakdown = matchDetails.breakdown && typeof matchDetails.breakdown === 'object' ? matchDetails.breakdown : null
    return { summary: buildCompactSummary(summary), breakdown }
  }, [matchDetails])

  const scoreItems = parsed?.breakdown ? [
    { label: '方向', value: Number(parsed.breakdown.titleMatch) || 0 },
    { label: '角色', value: Number(parsed.breakdown.roleTypeMatch) || 0 },
    { label: '技能', value: Number(parsed.breakdown.skillMatch) || 0 },
    { label: '语义', value: Number(parsed.breakdown.keywordSimilarity) || 0 },
    { label: '经验', value: Number(parsed.breakdown.experienceMatch) || 0 },
    { label: '偏好', value: Number(parsed.breakdown.preferenceMatch) || 0 }
  ] : []

  if (!hasResume) {
    if (compactUploadPrompt) {
      return (
        <button
          type="button"
          onClick={onUploadResume}
          className={`flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#dce8ef] bg-white/88 px-4 py-3 text-left shadow-[0_16px_36px_-32px_rgba(52,76,92,0.28)] transition hover:border-[#d8d2ff] hover:bg-white ${className}`}
        >
          <span className="min-w-0 text-[13px] font-bold text-slate-700">上传简历后可查看岗位匹配度</span>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#6f63f6] px-3 text-[12px] font-black text-white">
            <Upload className="h-3.5 w-3.5" />
            上传简历
          </span>
        </button>
      )
    }

    return (
      <div className={`rounded-[22px] border border-[#dce8ef] bg-white/92 p-5 shadow-[0_22px_52px_-42px_rgba(52,76,92,0.26)] ${className}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-base font-black tracking-tight text-slate-900">岗位匹配分析</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">上传简历后可获取该岗位的匹配度分析。</p>
          </div>
          <button
            type="button"
            onClick={onUploadResume}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6f63f6] px-4 text-sm font-black text-white shadow-[0_18px_32px_-24px_rgba(111,99,246,0.5)] transition hover:brightness-[1.03]"
          >
            <Upload className="h-4 w-4" />
            上传简历
          </button>
        </div>
      </div>
    )
  }

  if (matchLevel !== 'high' || !parsed) return null

  return (
    <div className={`relative overflow-hidden rounded-[22px] border border-[#e1e8f4] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(251,253,255,0.96))] p-5 shadow-[0_22px_54px_-44px_rgba(95,99,246,0.18)] ${className}`}>
      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#d8d2ff]/25 blur-3xl" />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2">
          <h4 className="text-base font-black tracking-tight text-slate-900">岗位匹配分析</h4>
          <span className="inline-flex items-center rounded-full border border-[#d8d2ff] bg-[#f6f3ff] px-2 py-0.5 text-[10px] font-black text-[#6f63f6]">
            高匹配
          </span>
        </div>

        {parsed.summary ? (
          <p className="mb-4 text-sm leading-7 text-slate-700">{parsed.summary}</p>
        ) : null}

        {scoreItems.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {scoreItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#e3e9f6] bg-white/92 px-2.5 py-2 text-center shadow-[0_10px_20px_-18px_rgba(95,99,246,0.24)]">
                <div className="text-[10px] font-black text-slate-500">{item.label}</div>
                <div className="mt-1 text-sm font-black text-[#6f63f6]">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
