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
    <div className="w-full bg-gradient-to-r from-[#fff1f2] via-[#fff7ed] to-[#f0fdf4] border-b border-red-100 relative overflow-hidden">
       {/* Background Snow Animation (CSS-only simple version) */}
       <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-red-200 rounded-full animate-ping"></div>
          <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-green-200 rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 left-10 text-red-200 animate-bounce">❄</div>
          <div className="absolute top-10 right-10 text-green-200 animate-spin-slow">❄</div>
       </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-red-900/5 border border-red-100 group hover:border-red-200 transition-all duration-500">
          
          <div className="flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-8">
            
            {/* Left Content */}
            <div className="flex-1 text-center md:text-left z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-red-100">
                <Sparkles className="w-3 h-3" />
                <span>Limited Holiday Special</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 font-serif tracking-tight">
                生成你的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-500">专属圣诞简历树</span>
              </h2>
              
              <p className="text-slate-600 text-lg mb-8 max-w-xl leading-relaxed">
                这一年辛苦了！用一棵独一无二的圣诞树，记录你职场成长的每一个高光时刻。
                <span className="block text-sm text-slate-400 mt-2 font-sans">Celebrate your growth with a festive resume tree.</span>
              </p>

              <button
                onClick={() => navigate('/christmas')}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[#dc2626] text-white font-bold rounded-full shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:bg-[#b91c1c] hover:-translate-y-0.5 transition-all duration-300"
              >
                <span className="text-base">立即生成我的树</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
              </button>
            </div>

            {/* Right Visual - CSS/SVG Composition of Tree Word Cloud */}
            <div className="relative w-full max-w-xs md:max-w-sm flex-shrink-0 perspective-1000">
                {/* Card Container */}
                <div className="relative aspect-[3/4] bg-[#fff7ed] rounded-xl shadow-2xl border-4 border-white transform rotate-3 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-105">
                    {/* Inner Texture */}
                    <div className="absolute inset-0 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/snow.png')]"></div>
                    
                    {/* The Tree Visual */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                        {/* Star */}
                        <div className="text-yellow-400 mb-2 animate-pulse">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        </div>
                        
                        {/* Word Cloud Simulation */}
                        <div className="flex flex-col items-center gap-1 w-full">
                            <div className="text-[#dc2626] font-serif font-bold text-xl opacity-90 transform -rotate-2">Leadership</div>
                            <div className="flex gap-2 items-center">
                                <span className="text-[#15803d] font-sans font-bold text-sm transform rotate-3">Python</span>
                                <span className="text-[#b45309] font-serif font-bold text-lg transform -rotate-1">Growth</span>
                            </div>
                            <div className="flex gap-3 items-center">
                                <span className="text-[#1e293b] font-sans text-xs opacity-70">Design</span>
                                <span className="text-[#dc2626] font-bold text-2xl transform rotate-2">Product</span>
                                <span className="text-[#15803d] font-sans text-xs">Agile</span>
                            </div>
                            <div className="flex gap-1 items-center">
                                <span className="text-[#b45309] font-serif text-sm">Strategy</span>
                                <span className="text-[#15803d] font-bold text-xl transform -rotate-3">Coding</span>
                                <span className="text-[#dc2626] text-xs">React</span>
                            </div>
                             <div className="flex gap-4 items-center">
                                <span className="text-[#1e293b] text-xs">Team</span>
                                <span className="text-[#b45309] font-bold text-lg">Vision</span>
                                <span className="text-[#15803d] text-sm transform rotate-6">Remote</span>
                            </div>
                             <div className="flex gap-2 items-center">
                                <span className="text-[#dc2626] font-serif text-base">Communication</span>
                                <span className="text-[#1e293b] text-xs">SQL</span>
                            </div>
                        </div>

                        {/* Trunk */}
                        <div className="w-6 h-12 bg-[#5d4037] rounded-sm mt-4"></div>
                        
                        {/* Footer Quote */}
                        <div className="mt-6 text-center">
                            <p className="text-[10px] text-slate-400 font-serif italic">"A unique winter tale of your career..."</p>
                        </div>
                    </div>

                    {/* Decorative Ribbon */}
                    <div className="absolute top-4 -right-8 bg-red-600 text-white text-xs font-bold py-1 px-8 transform rotate-45 shadow-md">
                        2024
                    </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -bottom-4 -left-4 bg-white p-3 rounded-full shadow-lg animate-bounce delay-700">
                    <span className="text-2xl">🎁</span>
                </div>
                <div className="absolute top-1/2 -right-8 text-yellow-400 animate-spin-slow opacity-60">
                    <Sparkles size={32} />
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
