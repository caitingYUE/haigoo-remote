const MATCH_SCORE_REFRESH_KEY = 'haigoo_match_score_refresh_marker'

export interface MatchScoreRefreshMarker {
  reason: string
  timestamp: number
}

export function markMatchScoreRefresh(reason: string = 'resume_changed'): MatchScoreRefreshMarker | null {
  if (typeof window === 'undefined') return null

  const marker: MatchScoreRefreshMarker = {
    reason,
    timestamp: Date.now()
  }

  try {
    window.localStorage.setItem(MATCH_SCORE_REFRESH_KEY, JSON.stringify(marker))
  } catch (error) {
    console.warn('[match-score-refresh] Failed to persist refresh marker:', error)
  }

  return marker
}

export function readMatchScoreRefreshMarker(): MatchScoreRefreshMarker | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(MATCH_SCORE_REFRESH_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const timestamp = Number(parsed?.timestamp)
    const reason = String(parsed?.reason || '').trim() || 'resume_changed'

    if (!Number.isFinite(timestamp) || timestamp <= 0) return null
    return { reason, timestamp }
  } catch (error) {
    console.warn('[match-score-refresh] Failed to read refresh marker:', error)
    return null
  }
}
