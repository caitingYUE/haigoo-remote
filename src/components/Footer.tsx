import { useLanguage } from '../contexts/LanguageContext'
import { useLocation } from 'react-router-dom'

interface FooterProps {
  showMembershipCta?: boolean
}

export default function Footer({ showMembershipCta: _showMembershipCta = true }: FooterProps) {
  const { text } = useLanguage()
  const { pathname } = useLocation()
  if (pathname.startsWith('/trusted-companies')) return null
  const isCompanyDetail = pathname.startsWith('/companies/') || pathname.startsWith('/c/')
  return (
    <footer
      className={`relative overflow-hidden ${isCompanyDetail ? 'bg-white' : 'bg-[linear-gradient(180deg,#fffefb_0%,#f7fbff_48%,#fffdf8_100%)]'}`}
      role="contentinfo"
      aria-label={text('网站页脚', 'Site footer')}
    >
      {!isCompanyDetail && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_18%_18%,rgba(188,222,255,0.18),transparent_32%),radial-gradient(circle_at_78%_12%,rgba(255,225,166,0.18),transparent_30%)]" />
        </div>
      )}
      <div className="relative mx-auto max-w-[1420px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-[24px] border border-[#e1e9f1] bg-white/80 px-5 py-4 text-sm leading-6 text-slate-500 shadow-[0_18px_48px_-42px_rgba(61,89,120,0.28)]">
          {text('岗位信息整理自企业官网、官方 Careers 页面及公开招聘渠道。公开信息可能随时变化，请以企业官方页面的最新信息为准。', 'Role information is organized from company websites, official Careers pages, and public recruitment channels. Public information can change at any time; please rely on the latest company page.')}
        </div>
      </div>
    </footer>
  )
}
