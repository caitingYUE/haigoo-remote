import { useNavigate } from 'react-router-dom'
import { TreePine, Gift, ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ChristmasResumeCTA() {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const checkDate = () => {
      const now = new Date()
      const currentYear = now.getFullYear()
      // Date range: Dec 20 to Dec 27
      const startDate = new Date(`${currentYear}-12-20T00:00:00`)
      const endDate = new Date(`${currentYear}-12-27T23:59:59`)
      
      setIsVisible(now >= startDate && now <= endDate)
    }
    
    checkDate()
  }, [])

  if (!isVisible) return null

  return (
    <div className="w-full bg-gradient-to-r from-amber-50 via-white to-amber-50 border-b border-amber-100/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff7ed] via-[#fef3c7] to-[#fff7ed] shadow-xl shadow-amber-900/5 border border-amber-100">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-white/40 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-50%] right-[-10%] w-[500px] h-[500px] bg-amber-200/20 rounded-full blur-3xl"></div>
            {/* Snowflakes effect could go here */}
            <div className="absolute top-10 right-20 text-amber-200/30 transform rotate-12">
              <TreePine size={120} />
            </div>
            <div className="absolute bottom-10 left-20 text-red-200/10 transform -rotate-12">
              <Gift size={100} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-8">
            <div className="flex-1 text-center md:text-left text-slate-800">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-amber-200 text-[#b45309] text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
                <Sparkles size={14} className="text-amber-500" />
                Limited Time Holiday Special
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-slate-900">
                Create Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b45309] to-[#d97706]">Christmas Tree</span> Resume
              </h2>
              <p className="text-lg text-slate-600 mb-6 max-w-xl">
                Celebrate your career growth this year! Generate a unique, festive resume tree to share with your network. A perfect way to wrap up the year.
              </p>
              <button 
                onClick={() => navigate('/christmas')}
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#b45309] text-white font-bold rounded-full shadow-[0_4px_14px_0_rgba(180,83,9,0.3)] hover:shadow-[0_6px_20px_rgba(180,83,9,0.4)] hover:bg-[#92400e] hover:scale-105 transition-all duration-300"
              >
                Generate Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Visual Representation of the Tree Resume */}
            <div className="hidden md:block relative w-64 h-64 flex-shrink-0">
               <div className="absolute inset-0 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 transform rotate-3 shadow-2xl shadow-amber-900/10 flex items-center justify-center">
                  <div className="text-center">
                    <TreePine className="w-24 h-24 text-[#15803d] mx-auto mb-2 drop-shadow-sm opacity-90" />
                    <div className="h-2 w-16 bg-slate-200/50 rounded mx-auto mb-1"></div>
                    <div className="h-2 w-24 bg-slate-200/50 rounded mx-auto mb-1"></div>
                    <div className="h-2 w-20 bg-slate-200/50 rounded mx-auto"></div>
                  </div>
               </div>
               {/* Floating elements */}
               <div className="absolute -top-4 -right-4 bg-white text-amber-600 p-3 rounded-xl shadow-lg border border-amber-100 transform rotate-12 animate-bounce">
                  <Gift size={24} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
