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

    // Daily Card Logic
    const dailyCard = useMemo(() => {
        const today = new Date()
        const startOfYear = new Date(today.getFullYear(), 0, 0)
        const diff = today.getTime() - startOfYear.getTime()
        const oneDay = 1000 * 60 * 60 * 24
        const dayOfYear = Math.floor(diff / oneDay)

        // Use day of year to deterministically select a card
        const cardIndex = dayOfYear % happinessCards.length
        return happinessCards[cardIndex]
    }, [])

    const todayDateStr = useMemo(() => {
        const date = new Date()
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
        return `${year}.${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')} ${weekDay}`
    }, [])

    useEffect(() => {
        const checkDate = () => {
            // Force New Year Mode until March 2026 as requested
            setIsChristmas(true) // Reusing 'isChristmas' state for 'New Year' visual mode (Red/Gold)
        }
        checkDate()
    }, [])

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/jobs?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    return (
        <div className="relative bg-white overflow-hidden min-h-[560px] flex items-center justify-center border-b border-slate-100">
            {/* Abstract Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {isChristmas ? (
                    <>
                        {/* Warm Golden Glow (Left) */}
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-100/50 rounded-full blur-3xl -translate-y-1/2"></div>
                        {/* Soft Festive Red (Right) - Reduced intensity for healing feel */}
                        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-50/40 rounded-full blur-3xl translate-y-1/3"></div>
                        <div className="absolute top-10 right-10 opacity-30 transform rotate-12">
                            <Sparkles className="w-24 h-24 text-amber-300" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl translate-y-1/3"></div>
                    </>
                )}
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                    
                    {/* Left Column: Content */}
                    <div className="flex-1 text-left max-w-2xl">
                        {/* Badge */}
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${isChristmas ? 'bg-red-50/80 border-red-100' : 'bg-indigo-50 border-indigo-100'} border mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-sm backdrop-blur-sm`}>
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isChristmas ? 'bg-red-400' : 'bg-indigo-400'} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isChristmas ? 'bg-red-500' : 'bg-indigo-500'}`}></span>
                            </span>
                            <span className={`text-xs font-bold ${isChristmas ? 'text-red-700' : 'text-indigo-700'} tracking-wide uppercase`}>
                                {isChristmas ? 'Happy New Year 2026' : 'Global Remote Opportunities'}
                            </span>
                        </div>

                        {/* Main Heading */}
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 whitespace-nowrap">
                            WORK YOUR BRAIN,
                            <br className="hidden md:block" />
                            <span className={`text-transparent bg-clip-text ${isChristmas ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-500' : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600'}`}>
                                LEAVE YOUR BODY TO BE HAPPY
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-600 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 leading-relaxed max-w-lg">
                            连接全球优质远程机会，让工作回归生活。
                            <br className="hidden md:block" />
                            无论是身在国内还是海外，都能找到属于你的自由工作方式。
                        </p>

                        {/* Search Bar */}
                        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
                            <div className="flex gap-2">
                                <div className="flex-1 relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Search className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="搜索公司 / 职位 / 技能"
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm group-hover:shadow-md text-lg"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    className="hidden md:block px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                >
                                    搜索
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: New Year Card */}
                    <div className="flex-1 flex justify-center md:justify-end relative z-20">
                         <div 
                            onClick={() => setShowHappinessCard(true)}
                            className="relative w-[280px] md:w-[320px] aspect-[3/4] transform transition-transform duration-500 hover:scale-105 cursor-pointer group animate-in fade-in slide-in-from-right-10 duration-1000 delay-300"
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
            </div>

            {showHappinessCard && (
                <HappinessCard onClose={() => setShowHappinessCard(false)} />
            )}
        </div>
    )
}
