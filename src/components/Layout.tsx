import { ReactNode, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Send } from 'lucide-react'
import Header from './Header'
import Footer from './Footer'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const { user, isAuthenticated, sendVerificationEmail } = useAuth()
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  const isJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isHome = pathname === '/'
  const hideFooter = pathname.startsWith('/resume') || isJobsPage
  
  const showVerificationWarning = isAuthenticated && user && !user.emailVerified

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
      
      {/* Email Verification Warning Banner */}
      {showVerificationWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 relative z-40 mt-32">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center md:justify-between gap-2 md:gap-4 text-amber-800 text-sm">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <span className="font-medium">
                        当前账号 <strong>{user?.email}</strong> 尚未验证。请尽快验证您的邮箱，否则注册 24 小时后将无法登录。
                    </span>
                </div>
                <div className="flex items-center gap-4">
                     {resendMsg ? (
                         <span className="text-green-600 font-medium flex items-center gap-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                             {resendMsg}
                         </span>
                     ) : (
                        <button 
                            onClick={handleResend}
                            disabled={resending}
                            className="text-amber-700 hover:text-amber-900 underline disabled:opacity-50 flex items-center gap-1 font-medium transition-colors"
                        >
                            {resending ? '发送中...' : '重新发送验证邮件'}
                            {!resending && <Send className="w-3 h-3" />}
                        </button>
                     )}
                </div>
            </div>
        </div>
      )}

      <main className={`flex-1 relative ${isJobsPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${!isHome && !showVerificationWarning ? 'pt-32' : ''}`}>
        <div className={`relative z-10 ${isJobsPage ? 'h-full' : ''}`}>
          {children}
        </div>
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
}
