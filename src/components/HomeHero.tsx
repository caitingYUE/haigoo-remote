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
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/40 to-slate-900/10"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 mt-16">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20">

                    {/* Left Column: Content */}
                    <div className="flex-1 text-left max-w-3xl z-10">
                        {/* English Tagline - Elegant Script */}
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <p className="text-xl md:text-2xl font-serif italic text-white/90 tracking-wide font-light drop-shadow-md">
                                "Work for Life"
                            </p>
                        </div>

                        {/* Main Heading */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-[1.2] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 drop-shadow-xl">
                            <span className="block text-white mb-2">为中国求职者精选的</span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 inline-block pb-1">
                                全球远程岗位
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-white/95 mb-10 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-light max-w-2xl drop-shadow-md">
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

                    {/* Right Column: Clean Minimalist Card */}
                    <div className="flex-1 flex justify-center md:justify-end relative z-20">
                        <div
                            onClick={() => setShowHappinessCard(true)}
                            className="relative group cursor-pointer"
                        >
                            {/* Simple Card - Matching Header Style */}
                            <div className="relative bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-lg transition-all duration-500 hover:-translate-y-1 w-80 md:w-96 text-center border border-white/40">
                                {/* Header Text */}
                                <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">
                                    新年上上签
                                </h3>
                                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                    开启您的 2026 专属远程好运
                                </p>

                                {/* Minimalist Icon Area */}
                                <div className="mb-6 flex justify-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-500 shadow-inner">
                                        <Gift className="w-8 h-8 text-slate-700" />
                                    </div>
                                </div>

                                {/* Button */}
                                <div className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium text-sm transition-all duration-300 hover:bg-slate-800 shadow-md">
                                    点击抽取
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

