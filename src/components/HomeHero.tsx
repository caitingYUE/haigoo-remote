import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { Search, Sparkles, Gift } from 'lucide-react'
import happinessCards from '../data/happiness-cards.json'
import { HappinessCard } from './Christmas/HappinessCard'

interface HomeHeroProps {
    stats?: {
        totalJobs: number | null
        companiesCount: number | null
        dailyJobs: number | null
    }
}

export default function HomeHero({ stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [isChristmas, setIsChristmas] = useState(false)
    const [showHappinessCard, setShowHappinessCard] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)

    useEffect(() => {
        // Force New Year Mode
        setIsChristmas(true)
    }, [])

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/jobs?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    return (
        <div className="relative min-h-[700px] flex items-center justify-center overflow-hidden bg-amber-50">
            {/* Background Image & Overlay - Warm Light Theme */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.webp" 
                    alt="Background" 
                    className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'opacity-40' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    loading="eager"
                    decoding="async"
                />
                {/* Gradient Overlay - Warm & Light */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-amber-50/80 to-white/90 backdrop-blur-[2px]"></div>
                {/* Subtle colorful mesh gradient for Fly.io vibe */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 mix-blend-multiply"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-200/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 mix-blend-multiply"></div>
            </div>

            {/* Festive Fireworks - Kept but subtle */}
            <div className="absolute top-0 right-0 z-20 w-full h-full overflow-hidden pointer-events-none opacity-60">
                <style>{`
                    @keyframes float-slow {
                        0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
                        50% { transform: translateY(-10px) scale(1.05); opacity: 0.8; }
                    }
                `}</style>
                {/* ... existing fireworks ... */}
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 pt-32 text-center">
                <div className="flex flex-col items-center justify-center max-w-4xl mx-auto">

                    {/* Main Heading - Fly.io Style Typography */}
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-8 tracking-tight leading-[1.15] animate-in fade-in slide-in-from-bottom-6 duration-700 drop-shadow-sm">
                        <span className="block mb-2 text-slate-800">理想生活，</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 inline-block pb-2">
                            从远程工作开始
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-slate-600 mb-10 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-normal max-w-2xl mx-auto">
                        全球精选 <span className="text-slate-300 mx-3">|</span> 国内可申 <span className="text-slate-300 mx-3">|</span> 真实可投 <span className="text-slate-300 mx-3">|</span> 优质远程文化
                    </p>

                    {/* Search Bar - Centered & Clean */}
                    <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 relative group mx-auto">
                        {/* Glow effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative flex shadow-xl rounded-2xl bg-white">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <Search className="w-6 h-6 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="搜索公司 / 职位 / 技能"
                                className="w-full pl-14 pr-36 py-4 bg-transparent border-0 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 text-lg placeholder:text-slate-400 text-slate-900"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={handleSearch}
                                className={`absolute right-2 top-2 bottom-2 px-8 bg-indigo-600 text-white text-base font-bold rounded-xl transition-all duration-200 hover:bg-indigo-700 shadow-md hover:shadow-lg hover:-translate-y-0.5`}
                            >
                                搜索
                            </button>
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

