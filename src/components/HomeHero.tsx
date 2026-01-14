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
        <div className="relative min-h-[800px] flex items-center justify-center overflow-hidden">
            {/* Background Image & Overlay */}
            <div className="absolute inset-0 z-0">
                <img 
                    src="/background.png" 
                    alt="Background" 
                    className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                {/* Gradient Overlay for better text readability while keeping image visible */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 via-slate-900/20 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-16">
                <div className="flex flex-col md:flex-row items-end justify-between gap-8 lg:gap-12 min-h-[500px]">

                    {/* Left Column: Content - Aligned with left desk space */}
                    <div className="flex-1 text-left max-w-2xl z-10 mb-12">
                        {/* English Tagline - Elegant Script */}
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <p className="text-2xl md:text-3xl font-serif italic text-white/95 tracking-wide font-light drop-shadow-md">
                                "Work for Life"
                            </p>
                        </div>

                        {/* Main Heading */}
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 drop-shadow-xl">
                            <span className="block text-white mb-2">为中国求职者精选的</span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-white to-amber-50 inline-block pb-2">
                                全球远程岗位
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-white/90 mb-10 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-light max-w-xl drop-shadow-md">
                            只收录国内可申请的岗位 <span className="text-white/60 mx-3">|</span> 来源真实 <span className="text-white/60 mx-3">|</span> 人工逐条筛选
                        </p>

                        {/* Search Bar - Clean & Floating */}
                        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 relative group">
                            {/* Glow effect */}
                            <div className="absolute -inset-1 bg-amber-100/10 rounded-2xl blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                            <div className="relative flex">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <Search className="w-6 h-6 text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="搜索公司 / 职位 / 技能"
                                    className="w-full pl-14 pr-36 py-4 bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all shadow-xl text-lg placeholder:text-slate-500 text-slate-900"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    className={`absolute right-2 top-2 bottom-2 px-6 bg-slate-900 text-white text-base font-bold rounded-xl transition-all duration-200 hover:bg-slate-800 shadow-lg`}
                                >
                                    搜索
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Festive Lantern - Positioned on the desk */}
                    <div className="flex-none flex justify-center md:justify-end relative z-20 mb-8 md:mb-0 pr-8 md:pr-16">
                        <div
                            onClick={() => setShowHappinessCard(true)}
                            className="relative group cursor-pointer"
                            style={{ animation: 'float 6s ease-in-out infinite' }}
                        >
                            <style>{`
                                @keyframes float {
                                    0%, 100% { transform: translateY(0) rotate(0deg); }
                                    50% { transform: translateY(-15px) rotate(2deg); }
                                }
                            `}</style>
                            
                            {/* Glow Effect behind */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/20 blur-[60px] rounded-full group-hover:bg-orange-500/40 transition-all duration-700"></div>

                            {/* Lantern Body Container */}
                            <div className="relative z-10 w-32 h-40 mx-auto transition-transform duration-300 group-hover:scale-105 origin-top">
                                {/* Hanging String */}
                                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-0.5 h-24 bg-gradient-to-b from-transparent to-amber-900/60"></div>

                                {/* Lantern Shape */}
                                <div className="w-full h-full rounded-[2.5rem] bg-gradient-to-b from-red-600 via-orange-500 to-red-600 shadow-2xl relative overflow-hidden border border-white/10 ring-1 ring-red-900/20">
                                    {/* Paper Texture/Grain */}
                                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                                    
                                    {/* Inner Light Gradient */}
                                    <div className="absolute inset-x-6 inset-y-8 bg-yellow-200/50 blur-2xl rounded-full animate-pulse"></div>
                                    
                                    {/* Ribs (Vertical Lines) */}
                                    <div className="absolute inset-0 flex justify-center gap-8 opacity-30">
                                        <div className="w-px h-full bg-red-950 rounded-full transform -skew-x-[15deg] border-r border-white/10"></div>
                                        <div className="w-px h-full bg-red-950 rounded-full transform skew-x-[15deg] border-l border-white/10"></div>
                                    </div>

                                    {/* Text Content */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                                        <div className="w-14 h-14 bg-red-800/90 rounded-full flex items-center justify-center border border-yellow-500/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] mb-2 backdrop-blur-sm">
                                            <span className="text-2xl font-serif font-bold text-yellow-100 drop-shadow-md">福</span>
                                        </div>
                                        <div className="text-yellow-50 font-medium text-[10px] tracking-[0.2em] opacity-90 shadow-sm">
                                            点我开启
                                        </div>
                                    </div>
                                </div>

                                {/* Top Cap */}
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-red-900 rounded-md shadow-md border-t border-white/20 flex items-center justify-center">
                                    <div className="w-12 h-0.5 bg-yellow-500/30"></div>
                                </div>

                                {/* Bottom Cap */}
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-16 h-4 bg-red-900 rounded-md shadow-md border-b border-white/20 flex items-center justify-center">
                                    <div className="w-10 h-0.5 bg-yellow-500/30"></div>
                                </div>

                                {/* Tassel */}
                                <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <div className="w-1 h-4 bg-red-800"></div>
                                    <div className="relative">
                                        {/* Chinese Knot */}
                                        <div className="w-6 h-6 border-2 border-red-600 rotate-45 rounded-sm bg-red-800/20 backdrop-blur-sm mb-1"></div>
                                        {/* Threads */}
                                        <div className="flex justify-center gap-1 mt-1">
                                            <div className="w-0.5 h-16 bg-red-600 rounded-full opacity-80"></div>
                                            <div className="w-0.5 h-20 bg-red-600 rounded-full"></div>
                                            <div className="w-0.5 h-16 bg-red-600 rounded-full opacity-80"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
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

