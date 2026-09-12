import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { showToast } from '@tarojs/taro'
import { ApiRequestError } from '../services/api-client'
import { getMiniSessionCacheKey, getMiniUser } from '../services/session'

// Page memory only: never persist member-only lists or share them across accounts.
export function miniContentScope() {
  const user = getMiniUser()
  const expired = user?.memberExpireAt ? Date.parse(user.memberExpireAt) <= Date.now() : false
  return `${getMiniSessionCacheKey()}:${user?.isMember}:${user?.memberType}:${user?.memberExpireAt}:${expired}`
}

const CACHE_LIMIT = 40
// Keep page data stable until an explicit pull-to-refresh or account change.
const CACHE_TTL_MS = Number.POSITIVE_INFINITY
const retainedResources = new Map<string, { data: unknown; loadedAt: number }>()
interface RetainedState<T> {
  key: string
  scope: string
  data: T | null
  loaded: boolean
  loadedAt: number
  sequence: number
  pending: Promise<void> | null
}

function retainedKey(scope: string, key: string) {
  return `${scope}\n${key}`
}

function readRetained<T>(scope: string, key: string) {
  if (!key) return null
  const cacheKey = retainedKey(scope, key)
  const entry = retainedResources.get(cacheKey)
  if (!entry) return null
  retainedResources.delete(cacheKey)
  retainedResources.set(cacheKey, entry)
  return entry as { data: T; loadedAt: number }
}

function writeRetained<T>(scope: string, key: string, data: T, loadedAt = Date.now()) {
  const cacheKey = retainedKey(scope, key)
  retainedResources.delete(cacheKey)
  retainedResources.set(cacheKey, { data, loadedAt })
  while (retainedResources.size > CACHE_LIMIT) retainedResources.delete(retainedResources.keys().next().value!)
}

function deleteRetained(scope: string, key: string) {
  if (key) retainedResources.delete(retainedKey(scope, key))
}

export default function useRetainedResource<T>(initialKey = '') {
  const initialScope = miniContentScope()
  const initialEntry = readRetained<T>(initialScope, initialKey)
  const initialData: T | null = initialEntry ? initialEntry.data : null
  const [data, setDataState] = useState<T | null>(() => initialData)
  const [loading, setLoading] = useState(initialData === null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const state = useRef<RetainedState<T>>({
    key: initialKey,
    scope: initialScope,
    data: initialData,
    loaded: Boolean(initialEntry),
    loadedAt: initialEntry?.loadedAt || 0,
    sequence: 0,
    pending: null as Promise<void> | null
  })
  useEffect(() => () => { state.current.sequence++ }, [])

  const setData = useCallback<Dispatch<SetStateAction<T | null>>>((next) => {
    const current = state.current
    const value = typeof next === 'function'
      ? (next as (previous: T | null) => T | null)(current.data)
      : next
    current.data = value
    if (value === null) {
      current.loaded = false
      deleteRetained(current.scope, current.key)
    } else {
      current.loaded = true
      current.loadedAt = Date.now()
      writeRetained(current.scope, current.key, value, current.loadedAt)
    }
    setDataState(value)
  }, [])

  const load = useCallback((key: string, fetcher: () => Promise<T>, force = false) => {
    const current = state.current
    const scope = miniContentScope()
    const scopeChanged = current.scope !== scope
    if (current.key !== key || scopeChanged) {
      current.sequence++
      const cached = readRetained<T>(scope, key)
      const nextData = cached?.data ?? (scopeChanged ? null : current.data)
      Object.assign(current, {
        key,
        scope,
        data: nextData,
        loaded: Boolean(cached),
        loadedAt: cached?.loadedAt || 0,
        pending: null
      })
      setDataState(nextData)
      setLoading(nextData === null)
      setRefreshing(false)
      setError('')
    }
    if (current.pending) return current.pending
    if (!force && current.loaded && Date.now() - current.loadedAt < CACHE_TTL_MS) return Promise.resolve()
    const sequence = ++current.sequence
    setRefreshing(true)
    setLoading(current.data === null)
    setError('')
    const pending = (async () => {
      try {
        // Defer synchronous throws until pending has been registered.
        const result = await Promise.resolve().then(fetcher)
        if (sequence !== current.sequence) return
        if (scope !== miniContentScope()) {
          current.loaded = false
          current.data = null
          deleteRetained(scope, key)
          setDataState(null)
          setError('账号状态已变化，请重新加载')
          return
        }
        current.data = result
        current.loaded = true
        current.loadedAt = Date.now()
        writeRetained(scope, key, result, current.loadedAt)
        setDataState(result)
      } catch (failure) {
        if (sequence !== current.sequence) return
        const message = failure instanceof Error ? failure.message : '加载失败，请稍后重试'
        if (scope !== miniContentScope() || (failure instanceof ApiRequestError && [401, 403].includes(failure.statusCode))) {
          current.loaded = false
          current.data = null
          deleteRetained(scope, key)
          setDataState(null)
        }
        if (current.data !== null) void showToast({ title: '暂时无法更新，已保留上次内容', icon: 'none' })
        else setError(message)
      } finally {
        if (sequence === current.sequence) {
          current.pending = null
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()
    current.pending = pending
    return pending
  }, [])

  return { data, setData, loading, refreshing, error, load }
}
