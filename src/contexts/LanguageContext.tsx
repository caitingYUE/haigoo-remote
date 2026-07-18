import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasEnglishPrefix, localizePath } from '../utils/language-path'

export type AppLanguage = 'zh' | 'en'

interface LanguageContextValue {
  language: AppLanguage
  isEnglish: boolean
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
  text: (zh: string, en: string) => string
  path: (path: string) => string
}

const LANGUAGE_STORAGE_KEY = 'haigoo_language'

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'zh'
  return hasEnglishPrefix(window.location.pathname) ? 'en' : 'zh'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage)
  const hasMountedRef = useRef(false)

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage)
    const nextPath = localizePath(location.pathname, nextLanguage)
    navigate(`${nextPath}${location.search}${location.hash}`, { replace: false })
  }, [location.hash, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      setLanguageState(hasEnglishPrefix(location.pathname) ? 'en' : 'zh')
      return
    }

    const pathnameIsEnglish = hasEnglishPrefix(location.pathname)
    if (language === 'en' && !pathnameIsEnglish) {
      navigate(`${localizePath(location.pathname, 'en')}${location.search}${location.hash}`, { replace: true })
    } else if (language === 'zh' && pathnameIsEnglish) {
      navigate(`${localizePath(location.pathname, 'zh')}${location.search}${location.hash}`, { replace: true })
    }
  }, [language, location.hash, location.pathname, location.search, navigate])

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Language switching should still work when storage is unavailable.
    }
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN'
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    isEnglish: language === 'en',
    setLanguage,
    toggleLanguage: () => setLanguage(language === 'zh' ? 'en' : 'zh'),
    text: (zh, en) => language === 'en' ? en : zh,
    path: (targetPath) => localizePath(targetPath, language)
  }), [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
