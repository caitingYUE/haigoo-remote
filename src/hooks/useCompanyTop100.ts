import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deriveMembershipCapabilities } from '../utils/membership'
import { CompanyTop100Error, getCompanyTop100 } from '../services/company-top100-service'
import type { CompanyTop100Response } from '../types/company-top100'

type Status = 'loading' | 'ready' | 'error' | 'denied' | 'unauthenticated'
type State = { owner: string; data: CompanyTop100Response | null; status: Status; refreshing: boolean; errorStatus: number | null }
const empty = (owner: string, status: Status = 'loading'): State => ({ owner, data: null, status, refreshing: false, errorStatus: null })
function tokenExpiry(token: string | null) {
  try {
    const part = token?.split('.')[1]
    const exp = JSON.parse(atob((part || '').replace(/-/g, '+').replace(/_/g, '/'))).exp
    return Number.isFinite(exp) ? exp * 1000 : null
  } catch { return null }
}

// Owner changes and verification failures purge private data; successful background
// checks keep the list mounted so returning from evidence/careers preserves position.
export function useTop100Access() {
  const { user, token, isAdmin, isLoading: authLoading } = useAuth()
  const [, tick] = useState(0)
  const account = user as unknown as {userId?:string;user_id?:string;id?:string;status?:string;memberExpireAt?:string;member_expire_at?:string;memberCycleStartAt?:string;member_cycle_start_at?:string} | null
  const expires = tokenExpiry(token)
  const sessionExpired = expires !== null && expires <= Date.now()
  const canRead = Boolean(!authLoading && token && !sessionExpired && (!account?.status || account.status === 'active') && (isAdmin || deriveMembershipCapabilities(user).canAccessTrustedCompaniesPage))
  const owner = `${account?.userId || account?.user_id || account?.id || ''}:${token || ''}`

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const times = [expires, new Date(account?.memberExpireAt || account?.member_expire_at || '').getTime(), new Date(account?.memberCycleStartAt || account?.member_cycle_start_at || '').getTime()].filter((time):time is number => typeof time === 'number' && Number.isFinite(time))
    const arm = () => {
      const next = times.filter(time => time > Date.now()).sort((a,b) => a-b)[0]
      if (next) timer = setTimeout(() => { tick(n => n + 1); arm() }, Math.min(next - Date.now() + 20, 2147483647))
    }
    arm(); return () => clearTimeout(timer)
  }, [owner, expires, account?.memberExpireAt, account?.member_expire_at, account?.memberCycleStartAt, account?.member_cycle_start_at])

  return { user, token, authLoading, canRead, sessionExpired, owner }
}
export function useCompanyTop100(companyId?: string, enabled = true) {
  const access = useTop100Access()
  const {token,canRead} = access
  const owner = `${access.owner}:${companyId || 'all'}`
  const [refresh,setRefresh] = useState(0)
  const [state,setState] = useState<State>(() => empty(owner))

  useEffect(() => {
    if (!canRead || !enabled || !token) { setState(empty(owner)); return }
    let active = true
    const controller = new AbortController()
    setState(previous => previous.owner === owner && previous.data ? {...previous, refreshing:true} : empty(owner))
    const timeout = setTimeout(() => {
      controller.abort()
      if (active) setState({...empty(owner, 'error'), errorStatus:503})
    }, 20000)
    getCompanyTop100(token, controller.signal, companyId).then(data => {
      if (active && !controller.signal.aborted) setState({owner,data,status:'ready',refreshing:false,errorStatus:null})
    }).catch(error => {
      if (!active || controller.signal.aborted) return
      const code = error instanceof CompanyTop100Error ? error.status : 503
      setState({...empty(owner, code === 401 ? 'unauthenticated' : code === 403 ? 'denied' : 'error'), errorStatus:code})
    }).finally(() => clearTimeout(timeout))
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [owner, canRead, enabled, token, companyId, refresh])

  useEffect(() => {
    if (!canRead || !enabled) return
    let timer: ReturnType<typeof setTimeout>
    const revalidate = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer); timer = setTimeout(() => setRefresh(n => n + 1), 150)
    }
    const interval = setInterval(revalidate, 60000)
    window.addEventListener('focus', revalidate); document.addEventListener('visibilitychange', revalidate)
    return () => { clearTimeout(timer); clearInterval(interval); window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate) }
  }, [canRead, enabled, owner])

  return {canRead, data:canRead && enabled && state.owner === owner ? state.data : null,
    status:state.owner === owner ? state.status : 'loading', refreshing:state.owner === owner && state.refreshing,
    sessionExpired:access.sessionExpired || (state.owner === owner && state.status === 'unauthenticated'), errorStatus:state.owner === owner ? state.errorStatus : null,
    retry:() => setRefresh(n => n + 1)}
}
