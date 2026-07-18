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
      className={`inline-flex h-9 min-w-[48px] items-center justify-center gap-1.5 rounded-full border border-[#dfe8ef] bg-white px-2.5 text-xs font-black tracking-wide text-slate-600 shadow-sm transition-colors hover:border-[#c8d7e5] hover:bg-slate-50 hover:text-[#6251f5] ${className}`}
      aria-label={label}
      title={label}
    >
      {showIcon ? <Languages className="h-3.5 w-3.5" /> : null}
      {isEnglish ? 'CH' : 'EN'}
    </button>
  )
}
