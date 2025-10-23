import { useState, useCallback } from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Get from local storage then parse stored json or return initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Remove item from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}

// Hook for session storage
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  const removeValue = useCallback(() => {
    try {
      window.sessionStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.error(`Error removing sessionStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}

// Hook for managing user preferences
export function useUserPreferences() {
  const [preferences, setPreferences] = useLocalStorage('userPreferences', {
    theme: 'light' as 'light' | 'dark',
    language: 'zh' as 'zh' | 'en',
    notifications: true,
    emailUpdates: false,
    jobAlerts: true,
    autoSave: true,
    compactView: false
  })

  const updatePreference = useCallback(<K extends keyof typeof preferences>(
    key: K,
    value: typeof preferences[K]
  ) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }))
  }, [setPreferences])

  return {
    preferences,
    updatePreference,
    setPreferences
  }
}

// Hook for managing search history
export function useSearchHistory(maxItems = 10) {
  const [searchHistory, setSearchHistory] = useLocalStorage<string[]>('searchHistory', [])

  const addSearch = useCallback((query: string) => {
    if (!query.trim()) return

    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== query)
      return [query, ...filtered].slice(0, maxItems)
    })
  }, [setSearchHistory, maxItems])

  const removeSearch = useCallback((query: string) => {
    setSearchHistory(prev => prev.filter(item => item !== query))
  }, [setSearchHistory])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
  }, [setSearchHistory])

  return {
    searchHistory,
    addSearch,
    removeSearch,
    clearHistory
  }
}

// Hook for managing recently viewed jobs
export function useRecentlyViewed(maxItems = 20) {
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<string[]>('recentlyViewed', [])

  const addJob = useCallback((jobId: string) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(id => id !== jobId)
      return [jobId, ...filtered].slice(0, maxItems)
    })
  }, [setRecentlyViewed, maxItems])

  const removeJob = useCallback((jobId: string) => {
    setRecentlyViewed(prev => prev.filter(id => id !== jobId))
  }, [setRecentlyViewed])

  const clearHistory = useCallback(() => {
    setRecentlyViewed([])
  }, [setRecentlyViewed])

  return {
    recentlyViewed,
    addJob,
    removeJob,
    clearHistory
  }
}

export default useLocalStorage