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
        {/* 背景装饰层 - 体现 open to the world 的轻松与科技感 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {/* 左上角云状渐变 */}
          <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-haigoo-primary/15 via-haigoo-secondary/10 to-haigoo-primary/5 blur-3xl animate-float" />
          {/* 右下角海洋色块 */}
          <div className="absolute -bottom-28 -right-28 w-[520px] h-[520px] rounded-full bg-gradient-to-tl from-haigoo-accent/15 via-haigoo-primary/10 to-haigoo-accent/5 blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />
          {/* 中部淡淡网格效果 */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08]" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#8B5CF6" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}