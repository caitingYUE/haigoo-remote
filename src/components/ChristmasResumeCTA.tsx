import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Snowflake } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ChristmasResumeCTA() {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const checkDate = () => {
      const now = new Date()
      const currentYear = now.getFullYear()
      // Extended Date range: Dec 15 to Jan 5 for testing/production
      const startDate = new Date(`${currentYear}-12-15T00:00:00`)
      const endDate = new Date(`${currentYear + 1}-01-05T23:59:59`)
      
      setIsVisible(now >= startDate && now <= endDate)
    }
    
    checkDate()
  }, [])

  if (!isVisible) return null

  return (
    <div className="w-full relative overflow-hidden -mt-16 mb-16 z-20">
       {/* Background Snow Animation (CSS-only simple version) */}
       <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-red-200 rounded-full animate-ping"></div>
          <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-green-200 rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 left-10 text-red-200 animate-bounce">❄</div>
          <div className="absolute top-10 right-10 text-green-200 animate-spin-slow">❄</div>
       </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-red-900/10 border border-red-50 group hover:border-red-100 transition-all duration-500">
          {/* Decorative Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#fff1f2] via-[#fff] to-[#fef2f2] opacity-80"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-10">
            
            {/* Left Content */}
            <div className="flex-1 text-center md:text-left z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider mb-5 border border-red-100 shadow-sm">
                <Sparkles className="w-3 h-3" />
                <span>Limited Holiday Special</span>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 font-serif tracking-tight leading-tight">
                生成你的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-500">专属简历圣诞树</span>
              </h2>
              
              <p className="text-slate-600 text-lg mb-8 max-w-xl leading-relaxed font-light">
                这一年辛苦了！用一棵独一无二的圣诞树，记录你职场成长的每一个高光时刻。
                <span className="block text-sm text-slate-400 mt-2 font-sans opacity-80">Celebrate your growth with a festive resume tree.</span>
              </p>

              <button
                onClick={() => navigate('/christmas')}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[#dc2626] text-white font-bold rounded-full shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:bg-[#b91c1c] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              >
                <span className="text-base relative z-10">立即生成我的树</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
              </button>
            </div>

            {/* Right Visual - Refined Tree Visual */}
            <div className="relative w-full max-w-[280px] md:max-w-[320px] flex-shrink-0 perspective-1000 group/card">
                {/* Card Container */}
                <div className="relative aspect-[3/4] bg-[#fffaf5] rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border-[6px] border-white transform rotate-2 transition-transform duration-700 group-hover/card:rotate-0 group-hover/card:scale-105 group-hover/card:shadow-[0_25px_60px_-12px_rgba(220,38,38,0.15)]">
                    {/* Inner Texture */}
                    <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/snow.png')] mix-blend-multiply"></div>
                    
                    {/* The Tree Visual */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                        {/* Star */}
                        <div className="text-amber-400 mb-3 animate-pulse drop-shadow-sm">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        </div>
                        
                        {/* Word Cloud Simulation - Improved Typography */}
                        <div className="flex flex-col items-center gap-1.5 w-full transform scale-95">
                            <div className="text-[#b91c1c] font-serif font-bold text-2xl opacity-90 tracking-wide" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Leadership</div>
                            
                            <div className="flex gap-2 items-center">
                                <span className="text-[#15803d] font-sans font-bold text-sm">Strategy</span>
                                <span className="text-[#b45309] font-serif font-bold text-lg">Growth</span>
                            </div>
                            
                            <div className="flex gap-3 items-center">
                                <span className="text-[#334155] font-sans text-xs opacity-60">Design</span>
                                <span className="text-[#dc2626] font-bold text-xl">Product</span>
                                <span className="text-[#15803d] font-sans text-xs">Agile</span>
                            </div>
                            
                            <div className="flex gap-2 items-center">
                                <span className="text-[#b45309] font-serif text-sm italic">Vision</span>
                                <span className="text-[#15803d] font-bold text-lg">Coding</span>
                                <span className="text-[#dc2626] text-xs font-bold">React</span>
                            </div>
                            
                             <div className="flex gap-3 items-center">
                                <span className="text-[#334155] text-xs tracking-wider">TEAM</span>
                                <span className="text-[#b45309] font-bold text-base">Communication</span>
                                <span className="text-[#15803d] text-sm">Remote</span>
                            </div>
                            
                             <div className="flex gap-2 items-center">
                                <span className="text-[#dc2626] font-serif text-sm">Creativity</span>
                                <span className="text-[#334155] text-[10px]">SQL</span>
                            </div>
                        </div>

                        {/* Trunk */}
                        <div className="w-8 h-10 bg-[#5d4037] rounded-sm mt-5 shadow-inner opacity-90"></div>
                        
                        {/* Footer Quote */}
                        <div className="absolute bottom-6 w-full text-center px-4">
                            <p className="text-[10px] text-slate-400 font-serif italic border-t border-slate-100 pt-3">"A unique winter tale of your career..."</p>
                        </div>
                    </div>

                    {/* Decorative Ribbon - Updated Year */}
                    <div className="absolute top-5 -right-9 bg-[#dc2626] text-white text-[10px] font-bold py-1 px-10 transform rotate-45 shadow-md tracking-widest z-20">
                        2025
                    </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -bottom-6 -left-6 bg-white p-3.5 rounded-full shadow-xl animate-bounce delay-700 z-30 border border-slate-50">
                    <span className="text-2xl filter drop-shadow-sm">🎁</span>
                </div>
                <div className="absolute top-1/2 -right-10 text-amber-300 animate-spin-slow opacity-80 filter blur-[1px]">
                    <Sparkles size={40} />
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
