import { Languages } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

interface LanguageToggleProps {
  className?: string
  showIcon?: boolean
}

export default function LanguageToggle({ className = '', showIcon = false }: LanguageToggleProps) {
  const { isEnglish, toggleLanguage } = useLanguage()
  const label = isEnglish ? '切换到中文' : 'Switch to English'

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`haigoo-language-toggle inline-flex h-9 min-w-[44px] items-center justify-center gap-1.5 border px-2.5 text-[11px] font-bold tracking-[0.12em] transition-colors ${className}`}
      aria-label={label}
      title={label}
    >
      {showIcon ? <Languages className="h-3.5 w-3.5" /> : null}
      {isEnglish ? 'CH' : 'EN'}
    </button>
  )
}
