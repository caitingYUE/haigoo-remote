import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Gift } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HappinessCard } from './Christmas/HappinessCard'

export default function NewYearBlessingSection() {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)
  const [showHappinessCard, setShowHappinessCard] = useState(false)

  useEffect(() => {
    const checkDate = () => {
      // Force visible for now as per user request "until March"
      // Or set logic: Dec 27, 2025 to Mar 31, 2026
      const now = new Date()
      const currentYear = now.getFullYear() // 2025 or 2026
      
      // Logic: If Dec 2025 OR Jan/Feb/Mar 2026
      // Simple check: is it after Dec 27, 2025?
      // User said "valid until end of Spring Festival (March)"
      setIsVisible(true) 
    }
    
    checkDate()
  }, [])

  if (!isVisible) return null

  return (
    <div className="w-full relative z-20" style={{ marginBottom: '60px' }}>
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
       {/* Background Decoration */}
       <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
          <div className="absolute top-0 left-1/4 w-2 h-2 bg-red-200 rounded-full animate-ping"></div>
          <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-yellow-200 rounded-full animate-pulse"></div>
       </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto relative">
        {/* The Card Background & Left Content */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-red-900/10 border border-red-50 group hover:border-red-100 transition-all duration-500">
          {/* Decorative Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#fff1f2] via-[#fff] to-[#fff7ed] opacity-80"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center p-8 md:p-12 gap-10 min-h-[320px]">
            
            {/* Left Content */}
            <div className="flex-1 text-center md:text-left z-10 md:max-w-[60%]">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider mb-5 border border-red-100 shadow-sm">
                <Sparkles className="w-3 h-3" />
                <span>New Year Special</span>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 font-serif tracking-tight leading-tight">
                2026 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-amber-500">新年上上签</span>
              </h2>
              
              <p className="text-slate-600 text-lg mb-8 max-w-xl leading-relaxed font-light">
                新的一年，愿你所有美好的期待都能如约而至。
                <br/>
                抽取你的专属新年祝福，开启 2026 远程工作新篇章。
                <span className="block text-sm text-slate-400 mt-2 font-sans opacity-80">Draw your New Year blessing card for a prosperous 2026.</span>
              </p>

              <button
                onClick={() => setShowHappinessCard(true)}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-[#dc2626] text-white font-bold rounded-full shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:bg-[#b91c1c] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              >
                <Gift className="w-5 h-5 relative z-10" />
                <span className="text-base relative z-10">抽取新年祝福</span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>

            {/* Placeholder for layout balance on mobile */}
            <div className="md:hidden w-full h-64"></div> 
          </div>
        </div>

        {/* Right Visual - Clickable Envelope (Breaks out of container) */}
        <div className="absolute md:-top-[20px] md:right-12 bottom-8 left-0 right-0 md:left-auto w-full md:w-[320px] flex justify-center md:block z-30">
            <div 
                onClick={() => setShowHappinessCard(true)}
                className="relative w-[260px] md:w-full aspect-[3/4] md:h-[400px] transform transition-transform duration-500 hover:scale-105 cursor-pointer group"
            >
                {/* Envelope Visual */}
                <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-700 rounded-xl shadow-2xl flex flex-col items-center justify-center border-4 border-yellow-400/30 relative overflow-hidden">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <Gift className="w-20 h-20 text-yellow-200 animate-bounce mb-4 drop-shadow-md" />
                    <p className="text-yellow-100 font-bold text-xl tracking-wider text-center px-4">
                        点击拆开<br/>新年祝福
                    </p>
                    <p className="text-yellow-200/60 text-sm mt-2">Haigoo 2026</p>

                    {/* Dashed border decor */}
                    <div className="absolute inset-0 border-[8px] border-dashed border-white/20 rounded-xl pointer-events-none"></div>
                    
                    {/* Floating particles */}
                    <div className="absolute top-4 right-4 text-yellow-200 opacity-60 animate-pulse">✦</div>
                    <div className="absolute bottom-6 left-6 text-yellow-200 opacity-60 animate-pulse delay-700">✦</div>
                </div>

                {/* Decorative 2026 Tag */}
                <div className="absolute top-[10%] -right-4 bg-yellow-400 text-red-700 text-sm font-bold py-1 px-4 transform rotate-[10deg] shadow-lg tracking-widest z-40 border-2 border-white/20 group-hover:rotate-[20deg] transition-transform">
                    2026
                </div>
            </div>
        </div>

      </div>

      {showHappinessCard && (
        <HappinessCard onClose={() => setShowHappinessCard(false)} />
      )}
    </div>
  )
}
