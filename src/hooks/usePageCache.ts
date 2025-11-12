import { useState, useEffect, useCallback, useRef } from 'react'
import { pageCacheService, CacheOptions } from '../services/page-cache-service'

export interface UsePageCacheOptions<T> extends CacheOptions {
  /**
   * 数据加载函数
   */
  fetcher: () => Promise<T>
  
  /**
   * 是否在挂载时自动加载数据
   * 默认: true
   */
  autoLoad?: boolean
  
  /**
   * 依赖项数组，当依赖变化时重新加载数据
   */
  dependencies?: any[]
  
  /**
   * 加载成功回调
   */
  onSuccess?: (data: T) => void
  
  /**
   * 加载失败回调
   */
  onError?: (error: Error) => void
}

export interface UsePageCacheReturn<T> {
  /**
   * 缓存的数据
   */
  data: T | null
  
  /**
   * 是否正在加载
   */
  loading: boolean
  
  /**
   * 错误信息
   */
  error: Error | null
  
  /**
   * 手动刷新数据（清除缓存并重新加载）
   */
  refresh: () => Promise<void>
  
  /**
   * 重新加载数据（使用缓存）
   */
  reload: () => Promise<void>
  
  /**
   * 清除缓存
   */
  clearCache: () => void
  
  /**
   * 是否来自缓存
   */
  isFromCache: boolean
  
  /**
   * 缓存年龄（毫秒）
   */
  cacheAge: number | null
}

/**
 * 页面缓存 Hook
 * 
 * @example
 * ```tsx
 * const { data, loading, refresh } = usePageCache({
 *   key: 'homepage-jobs',
 *   fetcher: async () => await jobService.getJobs(),
 *   ttl: 5 * 60 * 1000, // 5分钟
 *   persist: true
 * })
 * ```
 */
export function usePageCache<T>(
  key: string,
  options: UsePageCacheOptions<T>
): UsePageCacheReturn<T> {
  const {
    fetcher,
    autoLoad = true,
    dependencies = [],
    onSuccess,
    onError,
    ...cacheOptions
  } = options
  
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const [cacheAge, setCacheAge] = useState<number | null>(null)
  
  // 使用 ref 来追踪是否是初次挂载
  const isMountedRef = useRef(false)
  const isLoadingRef = useRef(false)
  
  /**
   * 加载数据（优先使用缓存）
   */
  const loadData = useCallback(async (forceRefresh = false) => {
    // 防止重复加载
    if (isLoadingRef.current) {
      return
    }
    
    try {
      setError(null)
      
      // 1. 如果不是强制刷新，优先从缓存获取（同步操作，不显示loading）
      if (!forceRefresh) {
        const cachedData = pageCacheService.get<T>(key, cacheOptions)
        if (cachedData !== null) {
          // 从缓存加载，立即显示，不设置loading状态
          setData(cachedData)
          setIsFromCache(true)
          setCacheAge(pageCacheService.getAge(key, cacheOptions))
          onSuccess?.(cachedData)
          return
        }
      }
      
      // 2. 缓存未命中或强制刷新，从服务器加载（显示loading）
      isLoadingRef.current = true
      setLoading(true)
      setIsFromCache(false)
      
      const fetchedData = await fetcher()
      
      // 3. 保存到缓存
      pageCacheService.set(key, fetchedData, cacheOptions)
      
      // 4. 更新状态
      setData(fetchedData)
      setCacheAge(0)
      onSuccess?.(fetchedData)
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [key, fetcher, cacheOptions, onSuccess, onError])
  
  /**
   * 手动刷新（清除缓存并重新加载）
   */
  const refresh = useCallback(async () => {
    pageCacheService.delete(key, cacheOptions)
    await loadData(true)
  }, [key, cacheOptions, loadData])
  
  /**
   * 重新加载（使用缓存）
   */
  const reload = useCallback(async () => {
    await loadData(false)
  }, [loadData])
  
  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    pageCacheService.delete(key, cacheOptions)
    setCacheAge(null)
  }, [key, cacheOptions])
  
  // 初始加载
  useEffect(() => {
    if (autoLoad) {
      // 标记为已挂载
      isMountedRef.current = true
      loadData(false)
    }
    
    return () => {
      isMountedRef.current = false
    }
  }, []) // 只在挂载时执行一次
  
  // 依赖项变化时重新加载
  useEffect(() => {
    // 跳过初始挂载
    if (!isMountedRef.current) {
      return
    }
    
    // 依赖项变化时，清除缓存并重新加载
    if (dependencies.length > 0) {
      refresh()
    }
  }, dependencies)
  
  return {
    data,
    loading,
    error,
    refresh,
    reload,
    clearCache,
    isFromCache,
    cacheAge
  }
}

