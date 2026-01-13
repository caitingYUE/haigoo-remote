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
        <div className="relative bg-[#FFFDF9] overflow-hidden min-h-[640px] flex items-center justify-center border-b border-indigo-50/50">
            {/* 1. Refined Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Subtle Grid Pattern for structure */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#E5E7EB 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.3 }}></div>

                {isChristmas ? (
                    <>
                        {/* Large, diffused warm light (Top Left) */}
                        <div className="absolute -top-20 -left-20 w-[900px] h-[900px] bg-amber-500/5 rounded-full blur-[120px]"></div>
                        {/* Soft Festive Red (Bottom Right) */}
                        <div className="absolute -bottom-40 -right-20 w-[700px] h-[700px] bg-rose-500/5 rounded-full blur-[100px]"></div>
                        {/* Accent Light (Top Right) */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[80px]"></div>
                    </>
                ) : (
                    <>
                        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px]"></div>
                        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px]"></div>
                    </>
                )}
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-16 lg:gap-24">

                    {/* Left Column: Content */}
                    <div className="flex-1 text-left max-w-3xl z-10">
                        {/* Badge - Minimal & Clean */}
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isChristmas ? 'bg-white border-rose-100/50' : 'bg-white border-indigo-100/50'} border mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-sm shadow-orange-500/5 backdrop-blur-sm`}>
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isChristmas ? 'bg-red-400' : 'bg-indigo-400'} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isChristmas ? 'bg-red-500' : 'bg-indigo-500'}`}></span>
                            </span>
                            <span className={`text-sm font-bold ${isChristmas ? 'text-rose-700' : 'text-indigo-700'} tracking-wide uppercase`}>
                                {isChristmas ? 'Happy New Year 2026' : 'Global Remote Opportunities'}
                            </span>
                        </div>

                        {/* Main Heading - Premium Gradient */}
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-8 tracking-tight leading-[1.15] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            <span className="block text-slate-800 mb-2">为中国求职者精选的</span>
                            <span className={`text-transparent bg-clip-text ${isChristmas ? 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500' : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600'} pb-2 inline-block`}>
                                全球远程岗位
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl md:text-2xl text-slate-500 mb-10 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-150 leading-relaxed font-light max-w-2xl">
                            只收录国内可申请的岗位 <span className="text-slate-300 mx-3">|</span> 来源真实 <span className="text-slate-300 mx-3">|</span> 人工逐条筛选
                        </p>

                        {/* Search Bar - Clean & Floating */}
                        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-rose-100 to-amber-100 rounded-2xl blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                            <div className="relative flex">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <Search className="w-6 h-6 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="搜索公司 / 职位 / 技能"
                                    className="w-full pl-14 pr-36 py-5 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-200 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-lg placeholder:text-slate-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={handleSearch}
                                    className={`absolute right-2.5 top-2.5 bottom-2.5 px-8 ${isChristmas ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-900'} text-white text-base font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-slate-900/10`}
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

