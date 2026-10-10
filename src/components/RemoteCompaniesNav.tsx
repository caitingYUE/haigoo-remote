import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Crown } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { stripLanguagePrefix } from '../utils/language-path'
import '../styles/remote-companies-nav.css'

export default function RemoteCompaniesNav({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null)
  const menuId = useId(), location = useLocation(), { text, path } = useLanguage()
  const current = stripLanguagePrefix(location.pathname)
  const top100 = current === '/trusted-companies/top-100'
  const active = current.startsWith('/trusted-companies') || current.startsWith('/companies') || current.startsWith('/company/') || current.startsWith('/c/')
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])
  const follow = () => { setOpen(false); onNavigate?.() }
  return <div className={`hg-company-nav${mobile ? ' hg-company-nav--mobile' : ''}`} ref={ref} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus() }
  }}>
    <button ref={button} type="button" className={`hg-company-nav__trigger${active ? ' is-active' : ''}`} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
      {text('远程企业', 'Remote companies')}<ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className="hg-company-nav__menu" id={menuId}>
      <Link to={path('/trusted-companies')} onClick={follow} aria-current={active && !top100 ? 'page' : undefined}>{text('远程企业', 'Remote companies')}</Link>
      <Link to={path('/trusted-companies/top-100')} onClick={follow} aria-current={top100 ? 'page' : undefined}><span>Top 100</span><span className="hg-company-nav__member"><Crown size={13} aria-hidden="true" />{text('会员专属', 'Members')}</span></Link>
    </div>}
  </div>
}
