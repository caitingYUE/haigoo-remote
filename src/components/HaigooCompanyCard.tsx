import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import clubLogo from '../assets/logo.webp'

interface HaigooCompanyCardProps {
  compact?: boolean
}

export default function HaigooCompanyCard({ compact = false }: HaigooCompanyCardProps) {
  const { text } = useLanguage()

  return (
    <aside className={`hg-haigoo-company-card${compact ? ' is-compact' : ''}`} aria-labelledby={`haigoo-company-card-title-${compact ? 'compact' : 'full'}`}>
      <div className="hg-haigoo-company-card__mark">
        <img src={clubLogo} alt={text('海狗远程俱乐部', 'Haigoo Remote Club')} loading="lazy" decoding="async" />
      </div>
      <div className="hg-haigoo-company-card__copy">
        <p className="haigoo-editorial-label">HAIGOO REMOTE · EST. 2025</p>
        <h2 id={`haigoo-company-card-title-${compact ? 'compact' : 'full'}`}>{text('海狗远程', 'Haigoo Remote')}</h2>
        <p>{text('整理全球企业公开的远程岗位与职业成长内容，让工作和生活多一种选择。', 'We organise public remote roles and career-learning resources, making room for more ways to work and live.')}</p>
      </div>
      <div className="hg-haigoo-company-card__links">
        <Link to="/about">{text('了解我们', 'About us')}<ArrowRight aria-hidden="true" /></Link>
        <Link to="/trusted-companies">{text('远程企业', 'Remote companies')}<ArrowRight aria-hidden="true" /></Link>
      </div>
    </aside>
  )
}
