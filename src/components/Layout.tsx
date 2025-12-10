import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const isJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const hideFooter = pathname.startsWith('/resume') || isJobsPage
  return (
    <div className={`min-h-screen flex flex-col ${pathname.startsWith('/profile') ? '' : 'landing-bg-page'}`}>
      <Header />
      <main className={`flex-1 relative ${isJobsPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
        <div className={`relative z-10 ${isJobsPage ? 'h-full' : ''}`}>
          {children}
        </div>
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
}
