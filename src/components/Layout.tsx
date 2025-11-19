import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const hideFooter = pathname.startsWith('/profile') || pathname.startsWith('/resume')
  return (
    <div className="min-h-screen landing-bg-page flex flex-col">
      <Header />
      <main className="flex-1 relative overflow-hidden">
        <div className="relative z-10">
          {children}
        </div>
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
}