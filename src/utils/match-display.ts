export type MatchLevel = 'high' | 'medium' | 'low' | 'none'

export const MATCH_DISPLAY_FLOOR = 70
export const MATCH_HIGH_THRESHOLD = 90
export const MATCH_MEDIUM_THRESHOLD = 70

export function resolveMatchLevel(score?: number | null, fallbackLevel?: string | null): MatchLevel {
  if (fallbackLevel === 'high' || fallbackLevel === 'medium' || fallbackLevel === 'low' || fallbackLevel === 'none') {
    return fallbackLevel
  }

  const n = Number(score) || 0
  if (n < MATCH_DISPLAY_FLOOR) return 'none'
  if (n >= MATCH_HIGH_THRESHOLD) return 'high'
  if (n >= MATCH_MEDIUM_THRESHOLD) return 'medium'
  return 'low'
}

export function getMatchLevelLabel(level: MatchLevel): string {
  if (level === 'high') return '高匹配'
  if (level === 'medium') return '较匹配'
  if (level === 'low') return '基础匹配'
  return ''
}

export function getMatchLevelClassName(level: MatchLevel): string {
  if (level === 'high') return 'bg-indigo-50 text-indigo-700 border-indigo-100'
  if (level === 'medium') return 'bg-sky-50 text-sky-700 border-sky-100'
  if (level === 'low') return 'bg-slate-100 text-slate-600 border-slate-200'
  return ''
}
