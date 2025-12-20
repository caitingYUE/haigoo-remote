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
    <div className="w-full bg-gradient-to-r from-red-50 via-white to-green-50 border-b border-red-100/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#D42426] to-[#165B33] shadow-xl shadow-red-900/10">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-50%] right-[-10%] w-[500px] h-[500px] bg-yellow-400/10 rounded-full blur-3xl"></div>
            {/* Snowflakes effect could go here */}
            <div className="absolute top-10 right-20 text-white/10 transform rotate-12">
              <TreePine size={120} />
            </div>
            <div className="absolute bottom-10 left-20 text-white/10 transform -rotate-12">
              <Gift size={100} />
            </div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-8">
            <div className="flex-1 text-center md:text-left text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles size={14} className="text-yellow-300" />
                Limited Time Holiday Special
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                Create Your <span className="text-yellow-300">Christmas Tree</span> Resume
              </h2>
              <p className="text-lg text-white/90 mb-6 max-w-xl">
                Celebrate your career growth this year! Generate a unique, festive resume tree to share with your network. A perfect way to wrap up the year.
              </p>
              <button 
                onClick={() => navigate('/christmas')}
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-white text-[#D42426] font-bold rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)] hover:scale-105 transition-all duration-300"
              >
                Generate Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Visual Representation of the Tree Resume */}
            <div className="hidden md:block relative w-64 h-64 flex-shrink-0">
               <div className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 transform rotate-3 shadow-2xl flex items-center justify-center">
                  <div className="text-center">
                    <TreePine className="w-24 h-24 text-green-200 mx-auto mb-2" />
                    <div className="h-2 w-16 bg-white/30 rounded mx-auto mb-1"></div>
                    <div className="h-2 w-24 bg-white/30 rounded mx-auto mb-1"></div>
                    <div className="h-2 w-20 bg-white/30 rounded mx-auto"></div>
                  </div>
               </div>
               {/* Floating elements */}
               <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 p-3 rounded-xl shadow-lg transform rotate-12 animate-bounce">
                  <Gift size={24} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
