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
    <div className="w-full relative z-20 pointer-events-none" style={{ marginBottom: '60px' }}>
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
      `}</style>
       {/* Background Snow Animation (CSS-only simple version) */}
       <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-red-200 rounded-full animate-ping"></div>
          <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-green-200 rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 left-10 text-red-200 animate-bounce">❄</div>
          <div className="absolute top-10 right-10 text-green-200 animate-spin-slow">❄</div>
       </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto relative">
        {/* The Card Background & Left Content */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-red-900/10 border border-red-50 group hover:border-red-100 transition-all duration-500">
          {/* Decorative Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#fff1f2] via-[#fff] to-[#fef2f2] opacity-80"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center p-8 md:p-12 gap-10 min-h-[320px]">
            
            {/* Left Content */}
            <div className="flex-1 text-center md:text-left z-10 md:max-w-[60%]">
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

            {/* Placeholder for layout balance on mobile */}
            <div className="md:hidden w-full h-64"></div> 
          </div>
        </div>

        {/* Right Visual - Floating Tree (Breaks out of container) */}
        <div className="absolute md:-top-[140px] md:right-12 bottom-8 left-0 right-0 md:left-auto w-full md:w-[380px] flex justify-center md:block pointer-events-none z-30">
            <div className="relative w-[280px] md:w-full aspect-[3/4] md:aspect-auto md:h-[500px] transform transition-transform duration-700 hover:scale-105">
                
                {/* Tree Container - Transparent Background */}
                <div className="absolute inset-0 flex flex-col items-center justify-end md:justify-center p-6 pb-0 md:pb-6">
                    {/* Glow Effect behind the tree */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/0 to-transparent md:via-white/20 blur-xl rounded-full opacity-60"></div>

                    {/* Star */}
                    <div className="text-amber-400 mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] relative z-10 scale-125">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </div>
                    
                    {/* Word Cloud Simulation - Enhanced Visibility */}
                    <div className="flex flex-col items-center gap-3 w-full relative z-10 filter drop-shadow-sm">
                        <div className="text-[#b91c1c] font-serif font-bold text-3xl opacity-90 tracking-wide animate-float-slow" style={{ animationDelay: '0s' }}>Leadership</div>
                        
                        <div className="flex gap-4 items-center">
                            <span className="text-[#15803d] font-sans font-bold text-lg animate-float-slow" style={{ animationDelay: '1s' }}>Strategy</span>
                            <span className="text-[#b45309] font-serif font-bold text-2xl animate-float-slow" style={{ animationDelay: '0.5s' }}>Growth</span>
                        </div>
                        
                        <div className="flex gap-4 items-center">
                            <span className="text-[#334155] font-sans text-sm font-medium opacity-80">Design</span>
                            <span className="text-[#dc2626] font-bold text-2xl animate-pulse">Product</span>
                            <span className="text-[#15803d] font-sans text-sm font-bold">Agile</span>
                        </div>
                        
                        <div className="flex gap-3 items-center">
                            <span className="text-[#b45309] font-serif text-lg italic">Vision</span>
                            <span className="text-[#15803d] font-bold text-xl">Coding</span>
                            <span className="text-[#dc2626] text-sm font-bold">React</span>
                        </div>
                        
                         <div className="flex gap-4 items-center">
                            <span className="text-[#334155] text-sm tracking-wider font-semibold">TEAM</span>
                            <span className="text-[#b45309] font-bold text-xl">Communication</span>
                            <span className="text-[#15803d] text-base font-medium">Remote</span>
                        </div>
                        
                         <div className="flex gap-3 items-center">
                            <span className="text-[#dc2626] font-serif text-lg">Creativity</span>
                            <span className="text-[#334155] text-xs font-bold bg-white/50 px-2 py-0.5 rounded-full">SQL</span>
                        </div>
                    </div>

                    {/* Trunk */}
                    <div className="w-10 h-14 bg-[#5d4037] rounded-sm mt-6 shadow-xl relative z-10">
                        <div className="absolute inset-0 bg-black/10 rounded-sm"></div>
                    </div>
                    
                </div>

                {/* Decorative Ribbon - 2025 */}
                <div className="absolute top-[15%] -right-4 md:-right-8 bg-[#dc2626] text-white text-sm font-bold py-1.5 px-12 transform rotate-[15deg] shadow-lg tracking-widest z-40 border-2 border-white/20">
                    2025
                </div>

                {/* Floating Gifts/Elements */}
                <div className="absolute bottom-[10%] -left-4 bg-white p-4 rounded-2xl shadow-xl animate-bounce delay-700 z-40 border border-slate-50 rotate-[-10deg]">
                    <span className="text-3xl filter drop-shadow-sm">🎁</span>
                </div>
                <div className="absolute top-[20%] -left-8 text-amber-300 animate-spin-slow opacity-90 filter blur-[0.5px]">
                    <Sparkles size={48} />
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}
