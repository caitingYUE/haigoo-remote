import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen gradient-bg-soft flex flex-col">
      <Header />
      <main className="flex-1 relative overflow-hidden">
        <div className="relative z-10">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}