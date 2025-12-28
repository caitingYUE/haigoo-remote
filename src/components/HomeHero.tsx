import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, Briefcase, Building2, Calendar, Quote } from 'lucide-react'
import happinessCards from '../data/happiness-cards.json'

// Animated Counter Component
function AnimatedNumber({ value }: { value: number | null | undefined }) {
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        if (value === null || value === undefined) {
            setDisplayValue(0)
            return
        }

        const end = value
        if (end === 0) {
            setDisplayValue(0)
            return
        }

        const step = Math.max(1, Math.ceil(end / 20)) // Ensure step is at least 1

        let current = 0
        const timer = setInterval(() => {
            current += step
            if (current >= end) {
                setDisplayValue(end)
                clearInterval(timer)
            } else {
                setDisplayValue(current)
            }
        }, 50)

        return () => clearInterval(timer)
    }, [value])

    return <span>{displayValue.toLocaleString()}</span>
}

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
                <div className="relative flex flex-col items-center justify-center text-center">

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
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 max-w-5xl mx-auto whitespace-nowrap">
                        为中国人才打开
                        <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isChristmas ? 'from-red-600 via-amber-500 to-red-600' : 'from-indigo-600 via-blue-600 to-cyan-600'}`}>全球远程工作</span>
                        入口
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                        连接全球顶尖远程企业，消除信息不对称。不论身在国内还是海外，
                        <br className="hidden md:block" />让我们助你找到理想的 Work-Life Balance。
                    </p>

                    {/* Search Bar */}
                    <div className="w-full max-w-xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 relative z-20">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-200 to-blue-200 rounded-2xl opacity-50 group-hover:opacity-100 transition duration-500 blur-md"></div>
                            <div className="relative bg-white p-2 rounded-2xl border border-slate-100 flex items-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                                <div className="flex-1 flex items-center gap-3 px-4">
                                    <Search className="w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="搜索公司 / 职位 / 技能"
                                        className="w-full py-3 bg-transparent outline-none text-slate-900 placeholder-slate-400 text-lg"
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

                    {/* Stats */}
                    <div className="flex flex-wrap justify-center gap-8 md:gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                        <div className="flex flex-col items-center group cursor-default">
                            <div className="flex items-center gap-2 text-slate-500 mb-1 group-hover:text-indigo-600 transition-colors">
                                <Briefcase className="w-4 h-4" />
                                <span className="text-sm font-medium">全部岗位</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-900 tracking-tight">
                                {stats?.totalJobs && stats.totalJobs > 0 ? <AnimatedNumber value={stats.totalJobs} /> : "500+"}
                            </span>
                        </div>

                        <div className="bg-slate-200 w-px h-10 hidden md:block"></div>

                        <div className="flex flex-col items-center group cursor-default">
                            <div className="flex items-center gap-2 text-slate-500 mb-1 group-hover:text-indigo-600 transition-colors">
                                <Building2 className="w-4 h-4" />
                                <span className="text-sm font-medium">精选企业</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-900 tracking-tight">
                                {stats?.companiesCount && stats.companiesCount > 0 ? <AnimatedNumber value={stats.companiesCount} /> : "100+"}
                            </span>
                        </div>

                        <div className="bg-slate-200 w-px h-10 hidden md:block"></div>

                        <div className="flex flex-col items-center group cursor-default">
                            <div className="flex items-center gap-2 text-slate-500 mb-1 group-hover:text-emerald-600 transition-colors">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-sm font-medium">日增岗位</span>
                            </div>
                            <span className="text-2xl font-bold text-emerald-600 tracking-tight">
                                {stats?.dailyJobs && stats.dailyJobs > 0 ? <>+<AnimatedNumber value={stats.dailyJobs} /></> : "50+"}
                            </span>
                        </div>
                    </div>

                    {/* Right Content - Daily Humor Card (Floating & Optimized) */}
                    <div className="hidden 2xl:block absolute right-4 top-1/2 -translate-y-1/2 w-[280px] hover:scale-105 transition-transform duration-500 z-0">
                        <div className="relative group rotate-2 hover:rotate-0 transition-transform duration-500">
                            {/* Card Glow Effect - Softer */}
                            <div className="absolute -inset-4 bg-gradient-to-br from-red-100/50 via-amber-100/30 to-red-100/50 rounded-[2rem] opacity-0 group-hover:opacity-100 blur-xl transition duration-700"></div>

                            {/* Card Content - Glassmorphism */}
                            <div className="relative bg-white/60 backdrop-blur-md rounded-[1.5rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 flex flex-col min-h-[280px]">
                                {/* Header: Date */}
                                <div className="flex items-center justify-between mb-4 border-b border-slate-100/50 pb-3">
                                    <div className="flex items-center gap-1.5 text-slate-500/80">
                                        <Calendar className="w-3.5 h-3.5 text-red-400" />
                                        <span className="text-xs font-medium tracking-wide font-mono">{todayDateStr.split(' ')[0]}</span>
                                    </div>
                                    <div className="px-2 py-0.5 bg-red-50/80 text-red-600/90 text-[10px] font-bold rounded-full border border-red-100/50">
                                        每日一签
                                    </div>
                                </div>

                                {/* Body: Quote */}
                                <div className="flex-1 flex flex-col justify-center mb-4 text-center">
                                    <Quote className="w-6 h-6 text-amber-200 mx-auto mb-3 opacity-60" />
                                    <p className="text-base text-slate-700 font-medium leading-relaxed tracking-wide italic font-serif">
                                        “{dailyCard?.quote || '新的一年，愿你拒绝内耗，早日发财。'}”
                                    </p>
                                </div>

                                {/* Footer: Author */}
                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100/50">
                                    <div className="w-8 h-8 bg-gradient-to-br from-red-50 to-amber-50 rounded-full flex items-center justify-center text-lg shadow-sm ring-1 ring-white">
                                        🧧
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">FROM</p>
                                        <p className="text-xs font-bold text-slate-800">{dailyCard?.author || 'Haigoo'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
