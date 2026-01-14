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
                    src="/background.jpg" 
                    alt="Background" 
                    className={`w-full h-full object-cover transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                />
                {/* Gradient Overlay for better text readability while keeping image visible */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/30"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-16">
                <div className="flex flex-col md:flex-row items-center justify-between gap-16 lg:gap-24">

                    {/* Left Column: Content */}
                    <div className="flex-1 text-left max-w-3xl z-10">
                        {/* English Tagline - Elegant Script */}
                        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <p className="text-2xl md:text-3xl font-serif italic text-white/90 tracking-wide font-light drop-shadow-md">
                                "Work your brain, leave your body to be happy."
                            </p>
                        </div>

                        {/* Main Heading */}
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white mb-8 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 drop-shadow-xl">
                            <span className="block text-white mb-2">为中国求职者精选的</span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 inline-block pb-2">
                                全球远程岗位
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl md:text-2xl text-white/95 mb-12 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-light max-w-3xl drop-shadow-md">
                            只收录国内可申请的岗位 <span className="text-white/60 mx-3">|</span> 来源真实 <span className="text-white/60 mx-3">|</span> 人工逐条筛选
                        </p>

                        {/* Search Bar - Clean & Floating */}
                        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 relative group">
                            {/* Glow effect */}
                            <div className="absolute -inset-1 bg-white/20 rounded-2xl blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                            <div className="relative flex">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <Search className="w-6 h-6 text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="搜索公司 / 职位 / 技能"
                                    className="w-full pl-14 pr-36 py-4 bg-white/90 backdrop-blur-md border border-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-2xl text-lg placeholder:text-slate-500 text-slate-900"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    className={`absolute right-2 top-2 bottom-2 px-6 bg-slate-900 text-white text-base font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg`}
                                >
                                    搜索
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: New Glassmorphism Blessing Card */}
                    <div className="flex-1 flex justify-center md:justify-end relative z-20">
                        <div
                            onClick={() => setShowHappinessCard(true)}
                            className="relative group cursor-pointer perspective-1000"
                        >
                            {/* Card Stack Effect */}
                            <div className="absolute top-4 -right-4 w-full h-full bg-white/30 rounded-3xl rotate-6 transition-transform group-hover:rotate-12 duration-500 border border-white/20"></div>
                            <div className="absolute top-2 -right-2 w-full h-full bg-white/60 rounded-3xl rotate-3 transition-transform group-hover:rotate-6 duration-500 border border-white/40"></div>

                            {/* Main Card */}
                            <div className="relative bg-white/80 backdrop-blur-2xl border border-white/80 p-10 rounded-3xl shadow-[0_20px_50px_-12px_rgba(244,63,94,0.25)] hover:shadow-[0_30px_60px_-15px_rgba(244,63,94,0.35)] transition-all duration-500 hover:-translate-y-2 w-80 text-center">
                                {/* Icon */}
                                <div className="mb-8 relative inline-block">
                                    <div className="absolute inset-0 bg-rose-400 blur-2xl opacity-30 rounded-full animate-pulse"></div>
                                    <div className="w-24 h-24 bg-gradient-to-br from-white to-rose-50 rounded-2xl shadow-xl shadow-rose-500/10 flex items-center justify-center border border-white relative z-10 mx-auto transform group-hover:scale-110 transition-transform duration-500">
                                        <Gift className="w-12 h-12 text-rose-500" />
                                    </div>
                                    {/* Sparkles */}
                                    <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-amber-400 animate-pulse" />
                                    <Sparkles className="absolute -bottom-2 -left-4 w-6 h-6 text-amber-300 animate-bounce delay-700" />
                                </div>

                                <h3 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-600">
                                        新年上上签
                                    </span>
                                </h3>

                                <p className="text-slate-500 text-base leading-relaxed mb-8">
                                    抽取您的 2026 专属<br />远程工作职场祝福
                                </p>

                                <div className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm font-bold shadow-lg shadow-rose-500/30 group-hover:shadow-rose-500/50 transition-all duration-300 transform group-hover:scale-105">
                                    点击开启好运
                                </div>
                            </div>

                            {/* Decorative Elements */}
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-amber-200/30 to-rose-200/30 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-gradient-to-tr from-rose-200/30 to-indigo-200/30 rounded-full blur-3xl pointer-events-none"></div>
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

