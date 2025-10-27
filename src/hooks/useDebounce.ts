import { useState, useEffect, useRef, useCallback } from 'react'

// Basic debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [delay]) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

// Throttle hook
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, limit - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const callbackRef = useRef(callback)
  const lastRan = useRef(0)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRan.current >= limit) {
      callbackRef.current(...args)
      lastRan.current = Date.now()
    }
  }, [limit]) as T

  return throttledCallback
}

// Search hook with debounce
export function useSearch(
  searchFunction: (query: string) => Promise<any>,
  delay: number = 300
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const debouncedQuery = useDebounce(query, delay)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setError(null)
      return
    }

    const performSearch = async () => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController()
      
      setIsLoading(true)
      setError(null)

      try {
        const searchResults = await searchFunction(debouncedQuery)
        
        // 检查请求是否被取消
        if (!abortControllerRef.current?.signal.aborted) {
          setResults(searchResults)
        }
      } catch (err) {
        // 忽略被取消的请求错误
        if (!abortControllerRef.current?.signal.aborted) {
          setError(err instanceof Error ? err.message : '搜索失败')
          setResults([])
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    performSearch()

    // 清理函数
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [debouncedQuery, searchFunction])

  const clearSearch = useCallback(() => {
    // 取消正在进行的搜索
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setQuery('')
    setResults([])
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearSearch
  }
}

export default useDebounce