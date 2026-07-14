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
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)

  const isJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isHome = pathname === '/'
  const isMembership = pathname === '/membership'
  const isCompanies = pathname === '/trusted-companies' || pathname.startsWith('/trusted-companies/') || pathname.startsWith('/companies/') || pathname.startsWith('/c/')
  const isCorporateEnglish = pathname.startsWith('/careerlearning') || pathname.startsWith('/corporate-english')
  const isAbout = pathname === '/about'
  const isBundle = pathname.startsWith('/job-bundles/') || pathname.startsWith('/b/')
  const isJobDetailPage = pathname.startsWith('/job/') || pathname.startsWith('/j/')
  const isProfile = pathname.startsWith('/profile')
  const hideFooter = isHome || pathname.startsWith('/resume') || isJobsPage || isProfile || isAbout || isBundle || isCorporateEnglish
  const showFooterMembershipCta = !(isCompanies || isBundle || (!isAuthenticated && isJobDetailPage))
  const lockViewport = isJobsPage && isDesktopViewport

  const showVerificationWarning = isAuthenticated && user && !user.emailVerified

  useEffect(() => {
    const syncViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 1024)
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)

    return () => {
      window.removeEventListener('resize', syncViewport)
    }
  }, [])

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

      {showVerificationWarning ? (
        <div className={`fixed right-3 z-[45] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-amber-950 shadow-[0_18px_48px_-28px_rgba(120,73,16,0.5)] backdrop-blur sm:right-5 sm:max-w-md ${showUpgradeNotice ? 'top-[7.25rem]' : 'top-[4.5rem]'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">邮箱尚未验证</div>
              <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                你仍可浏览网站；验证后才可搜索、筛选和申请岗位。
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-amber-700 transition hover:text-amber-900 disabled:cursor-wait disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {resending ? '发送中…' : (resendMsg || '重新发送验证邮件')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className={`flex-1 relative ${lockViewport ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
        <div className={`relative z-10 ${lockViewport ? 'h-full' : `animate-in fade-in slide-in-from-bottom-2 duration-500 ${(isHome || isMembership || isCompanies || isCorporateEnglish || isAbout || isBundle || isProfile || isJobsPage) ? '' : 'pt-20'}`}`}>
          {children}
        </div>
      </main>

      {!hideFooter && <Footer showMembershipCta={showFooterMembershipCta} />}

      {showHappinessCard && (
        <HappinessCard onClose={() => setShowHappinessCard(false)} />
      )}
    </div>
  )
}
