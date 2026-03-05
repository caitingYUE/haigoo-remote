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

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const { user, isAuthenticated, sendVerificationEmail } = useAuth()
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [showHappinessCard, setShowHappinessCard] = useState(false)

  const isJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isHome = pathname === '/'
  const isMembership = pathname === '/membership'
  const isCompanies = pathname === '/trusted-companies' || pathname.startsWith('/trusted-companies/') || pathname.startsWith('/companies/')
  const isAbout = pathname === '/about'
  const isBundle = pathname.startsWith('/job-bundles/')
  const hideFooter = pathname.startsWith('/resume') || isJobsPage

  const showVerificationWarning = isAuthenticated && user && !user.emailVerified

  useEffect(() => {
    // Listen for custom event from Header to open Happiness Card
    const handleOpenCard = () => setShowHappinessCard(true);
    window.addEventListener('open-happiness-card', handleOpenCard);

    return () => {
      window.removeEventListener('open-happiness-card', handleOpenCard);
    }
  }, [])

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
    <div className={`${isJobsPage ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col ${pathname.startsWith('/profile') ? '' : 'landing-bg-page'}`}>
      <Header />

      <main className={`flex-1 relative ${isJobsPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
        <div className={`relative z-10 ${isJobsPage ? 'h-full pt-16' : `animate-in fade-in slide-in-from-bottom-2 duration-500 ${(isHome || isMembership || isCompanies || isAbout || isBundle) ? '' : 'pt-20'}`}`}>
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
