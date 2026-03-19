export type MatchLevel = 'high' | 'medium' | 'low' | 'none'

export const MATCH_DISPLAY_FLOOR = 60
export const MATCH_HIGH_THRESHOLD = 78
export const MATCH_MEDIUM_THRESHOLD = 60

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
  if (level === 'medium') return '中匹配'
  if (level === 'low') return '一般匹配'
  return ''
}

export function getMatchLevelClassName(level: MatchLevel): string {
  if (level === 'high') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (level === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100'
  if (level === 'low') return 'bg-slate-100 text-slate-600 border-slate-200'
  return ''
}
