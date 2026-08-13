import { lazy, ReactNode, Suspense, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const LazyHappinessCard = lazy(() => import('./Christmas/HappinessCard').then((module) => ({ default: module.HappinessCard })))

interface LayoutProps {
  children: ReactNode
}

const SITE_UPGRADE_NOTICE_START = new Date('2026-04-21T23:35:00+08:00').getTime()
const SITE_UPGRADE_NOTICE_DURATION = 10 * 60 * 1000

const shouldShowSiteUpgradeNotice = () => {
  const now = Date.now()
  return now >= SITE_UPGRADE_NOTICE_START && now < SITE_UPGRADE_NOTICE_START + SITE_UPGRADE_NOTICE_DURATION
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()
  const { isEnglish, text } = useLanguage()
  const [showHappinessCard, setShowHappinessCard] = useState(false)
  const [showUpgradeNotice, setShowUpgradeNotice] = useState(shouldShowSiteUpgradeNotice)
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  ))

  const isJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isHome = pathname === '/'
  const isMembership = pathname === '/membership'
  const isCompanies = pathname === '/trusted-companies' || pathname.startsWith('/trusted-companies/') || pathname.startsWith('/companies/') || pathname.startsWith('/c/')
  const isCorporateEnglish = pathname.startsWith('/careerlearning') || pathname.startsWith('/corporate-english')
  const isAbout = pathname === '/about'
  const isBundle = pathname.startsWith('/job-bundles/') || pathname.startsWith('/b/')
  const isJobDetailPage = pathname.startsWith('/job/') || pathname.startsWith('/j/')
  const isProfile = pathname.startsWith('/profile')
  const isCareerWatchPage = pathname.startsWith('/careerlearning/watch/') || pathname.startsWith('/corporate-english/watch/')
  const hideFooter = isHome || pathname.startsWith('/resume') || isJobsPage || isProfile || isAbout || isBundle || isCorporateEnglish
  const showFooterMembershipCta = !(isCompanies || isBundle || (!isAuthenticated && isJobDetailPage))
  // Desktop comparison/reading workspaces need two independently scrollable
  // columns. Mobile and tablet keep the simpler document scroll model.
  const lockViewport = isDesktopViewport && (isJobsPage || isCareerWatchPage || isBundle)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleViewportChange = (event: MediaQueryListEvent) => setIsDesktopViewport(event.matches)
    setIsDesktopViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleViewportChange)
    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [])

  useEffect(() => {
    const pageName = isJobsPage
      ? text('远程工作', 'Remote Jobs')
      : isCompanies
        ? text('远程企业', 'Remote Companies')
        : isCorporateEnglish
          ? text('职业成长', 'Career Growth')
          : text('全球远程工作平台', 'Global Remote Work')
    document.title = `${pageName} | Haigoo Remote`
  }, [isEnglish, isJobsPage, isCompanies, isCorporateEnglish, text])

  useEffect(() => {
    // Listen for custom event from Header to open Happiness Card
    const handleOpenCard = () => setShowHappinessCard(true);
    window.addEventListener('open-happiness-card', handleOpenCard);

    return () => {
      window.removeEventListener('open-happiness-card', handleOpenCard);
    }
  }, [])

  useEffect(() => {
    if (!showUpgradeNotice) return

    const timer = window.setInterval(() => {
      setShowUpgradeNotice(shouldShowSiteUpgradeNotice())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [showUpgradeNotice])

  return (
    <div className={`${isBundle ? 'hg-layout-bundle' : ''} ${lockViewport ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-[var(--hg-bg-page)]`}>
      {showUpgradeNotice && (
        <div className="fixed inset-x-0 top-0 z-[70] bg-slate-900/92 text-white backdrop-blur-md">
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-center px-4 text-center text-sm font-medium">
            {text('网站正在升级更新中，预计 10 分钟内完成，可能有轻微功能或数据抖动。', 'We are updating the site. Service may be briefly unstable for about 10 minutes.')}
          </div>
        </div>
      )}

      <Header showUpgradeNotice={showUpgradeNotice} />

      <main id="main-content" tabIndex={-1} className={`relative min-h-0 flex-1 ${lockViewport ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
        <div className={`relative z-10 ${lockViewport ? 'h-full' : `animate-in fade-in slide-in-from-bottom-2 duration-500 ${(isHome || isMembership || isCompanies || isCorporateEnglish || isAbout || isBundle || isProfile || isJobsPage) ? '' : 'pt-20'}`}`}>
          {children}
        </div>
      </main>

      {!hideFooter && <Footer showMembershipCta={showFooterMembershipCta} />}

      {showHappinessCard && (
        <Suspense fallback={null}>
          <LazyHappinessCard onClose={() => setShowHappinessCard(false)} />
        </Suspense>
      )}
    </div>
  )
}
