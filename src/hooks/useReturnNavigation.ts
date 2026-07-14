import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function normalizeInternalReturnPath(value?: string | null) {
  const path = String(value || '').trim()
  return path.startsWith('/') && !path.startsWith('//') ? path : ''
}

export function withReturnTo(path: string, returnTo: string) {
  const safeReturnTo = normalizeInternalReturnPath(returnTo)
  if (!safeReturnTo) return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set('returnTo', safeReturnTo)
  return `${url.pathname}${url.search}${url.hash}`
}

export function useReturnNavigation(fallbackPath: string) {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    const historyIndex = Number(window.history.state?.idx)
    if (Number.isFinite(historyIndex) && historyIndex > 0) {
      navigate(-1)
      return
    }

    const queryReturnTo = new URLSearchParams(location.search).get('returnTo')
    const stateReturnTo = normalizeInternalReturnPath((location.state as { from?: string } | null)?.from)
    const returnTo = normalizeInternalReturnPath(queryReturnTo) || stateReturnTo || fallbackPath
    navigate(returnTo, { replace: true })
  }, [fallbackPath, location.search, location.state, navigate])
}
