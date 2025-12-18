import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, Globe, Briefcase, Building2 } from 'lucide-react'

// Animated Counter Component
function AnimatedNumber({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        let start = 0
        const end = value
        if (start === end) return

        const totalDuration = 1000 // 1 second animation
        const incrementTime = (totalDuration / end) * 100

        const step = Math.ceil(end / 20)

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

    return <span>{value ? value.toLocaleString() : '...'}</span>
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

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/jobs?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    return (
        <div className="relative bg-[#0F172A] overflow-hidden min-h-[480px] flex items-center justify-center">
            {/* Abstract Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl translate-y-1/3"></div>
                <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-slate-800/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                {/* Grid Pattern Overlay */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            </div>

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">

                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 backdrop-blur-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">Global Remote Opportunities</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    为中国人才打开<br className="md:hidden" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400"> 全球远程工作 </span>
                    入口
                </h1>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                    连接全球顶尖远程企业，消除信息不对称。不论身在国内还是海外，
                    <br className="hidden md:block" />让我们助你找到理想的 Work-Life Balance。
                </p>

                {/* Search Bar */}
                <div className="w-full max-w-2xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 blur"></div>
                        <div className="relative bg-slate-900/90 backdrop-blur-xl p-2 rounded-2xl border border-slate-700 flex items-center gap-2 shadow-2xl">
                            <div className="flex-1 flex items-center gap-3 px-4">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="搜索公司 / 职位 / 技能 （支持中英文）"
                                    className="w-full py-3 bg-transparent outline-none text-white placeholder-slate-500 text-lg"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="hidden md:block px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
                            >
                                立即搜索
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap justify-center gap-8 md:gap-16 border-t border-slate-800/50 pt-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                    <div className="flex flex-col items-center group cursor-default">
                        <div className="flex items-center gap-2 text-slate-400 mb-2 group-hover:text-indigo-400 transition-colors">
                            <Briefcase className="w-5 h-5" />
                            <span className="text-sm font-medium">全部岗位</span>
                        </div>
                        <span className="text-3xl font-bold text-white tracking-tight">
                            {stats?.totalJobs !== undefined && stats?.totalJobs !== null ? <AnimatedNumber value={stats.totalJobs} /> : <span className="text-slate-600">...</span>}
                        </span>
                    </div>

                    <div className="bg-slate-800 w-px h-12 hidden md:block"></div>

                    <div className="flex flex-col items-center group cursor-default">
                        <div className="flex items-center gap-2 text-slate-400 mb-2 group-hover:text-indigo-400 transition-colors">
                            <Building2 className="w-5 h-5" />
                            <span className="text-sm font-medium">认证企业</span>
                        </div>
                        <span className="text-3xl font-bold text-white tracking-tight">
                            {stats?.companiesCount !== undefined && stats?.companiesCount !== null ? <AnimatedNumber value={stats.companiesCount} /> : <span className="text-slate-600">...</span>}
                        </span>
                    </div>

                    <div className="bg-slate-800 w-px h-12 hidden md:block"></div>

                    <div className="flex flex-col items-center group cursor-default">
                        <div className="flex items-center gap-2 text-slate-400 mb-2 group-hover:text-green-400 transition-colors">
                            <Sparkles className="w-5 h-5" />
                            <span className="text-sm font-medium">日增岗位</span>
                        </div>
                        <span className="text-3xl font-bold text-emerald-400 tracking-tight">
                            +{stats?.dailyJobs !== undefined && stats?.dailyJobs !== null ? <AnimatedNumber value={stats.dailyJobs} /> : <span className="text-slate-600">...</span>}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
