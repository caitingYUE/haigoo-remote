import type { AppLanguage } from '../contexts/LanguageContext'

const ENGLISH_PREFIX = '/en'

export function hasEnglishPrefix(pathname: string) {
  return pathname === ENGLISH_PREFIX || pathname.startsWith(`${ENGLISH_PREFIX}/`)
}

export function stripLanguagePrefix(pathname: string) {
  if (!hasEnglishPrefix(pathname)) return pathname || '/'
  const stripped = pathname.slice(ENGLISH_PREFIX.length)
  return stripped || '/'
}

export function localizePath(path: string, language: AppLanguage) {
  if (!path || /^(?:[a-z]+:)?\/\//i.test(path) || /^(?:mailto|tel):/i.test(path) || path.startsWith('#')) return path

  const hashIndex = path.indexOf('#')
  const queryIndex = path.indexOf('?')
  const suffixIndex = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? path.length
  const pathname = path.slice(0, suffixIndex) || '/'
  const suffix = path.slice(suffixIndex)
  const normalizedPath = stripLanguagePrefix(pathname.startsWith('/') ? pathname : `/${pathname}`)

  if (language === 'en') {
    return `${normalizedPath === '/' ? ENGLISH_PREFIX : `${ENGLISH_PREFIX}${normalizedPath}`}${suffix}`
  }
  return `${normalizedPath}${suffix}`
}
