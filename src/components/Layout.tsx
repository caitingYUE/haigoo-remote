import { ReactNode, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Send } from 'lucide-react'
import Header from './Header'
import Footer from './Footer'
import { useAuth } from '../contexts/AuthContext'
import { HappinessCard } from './Christmas/HappinessCard'

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
  const { user, isAuthenticated, sendVerificationEmail } = useAuth()
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [showHappinessCard, setShowHappinessCard] = useState(false)
  const [showUpgradeNotice, setShowUpgradeNotice] = useState(shouldShowSiteUpgradeNotice)

  const isJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isHome = pathname === '/'
  const isMembership = pathname === '/membership'
  const isCompanies = pathname === '/trusted-companies' || pathname.startsWith('/trusted-companies/') || pathname.startsWith('/companies/')
  const isAbout = pathname === '/about'
  const isBundle = pathname.startsWith('/job-bundles/')
  const isProfile = pathname.startsWith('/profile')
  const hideFooter = pathname.startsWith('/resume') || isJobsPage || isProfile
  const lockViewport = isJobsPage

  const showVerificationWarning = isAuthenticated && user && !user.emailVerified

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

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const res = await sendVerificationEmail(user.email);
      if (res.success) {
        setResendMsg('验证邮件已发送');
        setTimeout(() => setResendMsg(''), 5000);
      } else {
        setResendMsg('发送失败，请稍后重试');
      }
    } catch (e) {
      setResendMsg('发送失败');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={`${lockViewport ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col ${isProfile ? 'bg-slate-50' : 'landing-bg-page'}`}>
      {showUpgradeNotice && (
        <div className="fixed inset-x-0 top-0 z-[70] bg-slate-900/92 text-white backdrop-blur-md">
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-center px-4 text-center text-sm font-medium">
            网站正在升级更新中，预计 10 分钟内完成，可能有轻微功能或数据抖动。
          </div>
        </div>
      )}

      <Header showUpgradeNotice={showUpgradeNotice} />

      <main className={`flex-1 relative ${lockViewport ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
        <div className={`relative z-10 ${lockViewport ? 'h-full' : `animate-in fade-in slide-in-from-bottom-2 duration-500 ${(isHome || isMembership || isCompanies || isAbout || isBundle || isProfile) ? '' : 'pt-20'}`}`}>
          {children}
        </div>
      </main>

      {!hideFooter && <Footer />}

      {showHappinessCard && (
        <HappinessCard onClose={() => setShowHappinessCard(false)} />
      )}
    </div>
  )
}
