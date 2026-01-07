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
        <div className="relative bg-[#FFFDF9] overflow-hidden min-h-[600px] flex items-center justify-center border-b border-indigo-50/50">
            {/* 1. Refined Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Subtle Noise Texture for Premium Feel */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>

                {isChristmas ? (
                    <>
                        {/* Large, diffused warm light (Top Left) */}
                        <div className="absolute -top-20 -left-20 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[120px]"></div>
                        {/* Soft Festive Red (Bottom Right) */}
                        <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[100px]"></div>
                        {/* Accent Light (Top Right) */}
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[80px]"></div>
                    </>
                ) : (
                    <>
                        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px]"></div>
                        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px]"></div>
                    </>
                )}
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-20">

                    {/* Left Column: Content */}
                    <div className="flex-1 text-left max-w-2xl lg:max-w-3xl z-10">
                        {/* Badge - Minimal & Clean */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${isChristmas ? 'bg-white border-rose-100/50' : 'bg-white border-indigo-100/50'} border mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-sm shadow-orange-500/5 backdrop-blur-sm`}>
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isChristmas ? 'bg-red-400' : 'bg-indigo-400'} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isChristmas ? 'bg-red-500' : 'bg-indigo-500'}`}></span>
                            </span>
                            <span className={`text-xs font-bold ${isChristmas ? 'text-rose-700' : 'text-indigo-700'} tracking-wide uppercase`}>
                                {isChristmas ? 'Happy New Year 2026' : 'Global Remote Opportunities'}
                            </span>
                        </div>

                        {/* Main Heading - Premium Gradient */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            <span className="block text-slate-800">为中国求职者精选的</span>
                            <span className={`text-transparent bg-clip-text ${isChristmas ? 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500' : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600'} pb-2`}>
                                全球远程岗位
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-slate-500 mb-8 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-light">
                            只收录国内可申请的岗位 <span className="text-slate-300 mx-2">|</span> 来源真实 <span className="text-slate-300 mx-2">|</span> 人工逐条筛选
                        </p>

                        {/* Search Bar - Clean & Floating */}
                        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-rose-100 to-amber-100 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                            <div className="relative flex">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="w-5 h-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="搜索公司 / 职位 / 技能"
                                    className="w-full pl-12 pr-32 py-4 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-200 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-lg placeholder:text-slate-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    className={`absolute right-2 top-2 bottom-2 px-6 ${isChristmas ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-900'} text-white text-sm font-bold rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
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
                            className="relative w-[280px] h-[360px] group cursor-pointer animate-in fade-in slide-in-from-right-8 duration-1000 delay-200"
                        >
                            {/* Card Glow */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/20 to-amber-500/20 rounded-[2rem] blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                            {/* Main Glass Card */}
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] group-hover:shadow-[0_20px_40px_rgba(244,63,94,0.1)] transition-all duration-500 flex flex-col items-center justify-center text-center p-6 overflow-hidden">

                                {/* Inner Decorative Ring */}
                                <div className="absolute inset-4 border border-white/40 rounded-[1.5rem] opacity-50"></div>

                                {/* Floating Icon */}
                                <div className="relative mb-6 transform group-hover:-translate-y-2 transition-transform duration-500">
                                    <div className="absolute -inset-4 bg-rose-200/30 rounded-full blur-xl animate-pulse"></div>
                                    <div className="w-20 h-20 bg-gradient-to-br from-white to-rose-50 rounded-2xl shadow-xl shadow-rose-500/10 flex items-center justify-center border border-white relative z-10">
                                        <Gift className="w-10 h-10 text-rose-500" />
                                    </div>
                                    {/* Sparkles */}
                                    <Sparkles className="absolute -top-3 -right-3 w-6 h-6 text-amber-400 animate-pulse" />
                                    <Sparkles className="absolute -bottom-1 -left-3 w-4 h-4 text-amber-300 animate-bounce delay-700" />
                                </div>

                                <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight group-hover:scale-105 transition-transform duration-300">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-600">
                                        新年上上签
                                    </span>
                                </h3>

                                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                    抽取您的 2026 专属<br />远程工作职场祝福
                                </p>

                                <div className="px-5 py-2 rounded-full bg-white/50 border border-white/60 text-xs font-bold text-rose-600 shadow-sm backdrop-blur-md group-hover:bg-rose-50 group-hover:border-rose-100 transition-colors">
                                    点击开启好运
                                </div>
                            </div>

                            {/* Decorative Elements */}
                            <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-amber-200/20 to-rose-200/20 rounded-full blur-2xl pointer-events-none"></div>
                            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-tr from-rose-200/20 to-indigo-200/20 rounded-full blur-2xl pointer-events-none"></div>
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

