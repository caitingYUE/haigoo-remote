import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Code, Palette, Database, LineChart, Building, Settings, MoreHorizontal } from 'lucide-react'

// Real job categories mapped from JobCategory type
const CATEGORIES = [
    {
        name: '技术开发',
        icon: <Code className="w-5 h-5" />,
        subCategories: ['全栈开发', '前端开发', '后端开发', '移动开发', '算法工程师', '数据开发', '服务器开发', '架构师']
    },
    {
        name: '产品设计',
        icon: <Palette className="w-5 h-5" />,
        subCategories: ['产品经理', '产品设计', 'UI/UX设计', '平面设计', '视觉设计', '用户研究', '项目管理']
    },
    {
        name: '数据分析',
        icon: <Database className="w-5 h-5" />,
        subCategories: ['数据分析', '数据科学', '商业分析', '数据开发']
    },
    {
        name: '运营市场',
        icon: <LineChart className="w-5 h-5" />,
        subCategories: ['运营', '市场营销', '销售', '客户经理', '内容创作', '增长黑客']
    },
    {
        name: '职能支持',
        icon: <Building className="w-5 h-5" />,
        subCategories: ['人力资源', '招聘', '财务', '法务', '行政', '客户服务']
    },
    {
        name: '运维测试',
        icon: <Settings className="w-5 h-5" />,
        subCategories: ['运维/SRE', '测试/QA', '网络安全', '技术支持']
    },
    {
        name: '其他岗位',
        icon: <MoreHorizontal className="w-5 h-5" />,
        subCategories: ['教育培训', '咨询', '投资', '管理', '其他']
    }
]

// Animated Counter Component
function AnimatedNumber({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(0)

    useEffect(() => {
        let start = 0
        const end = value
        if (start === end) return

        const totalDuration = 1000 // 1 second animation
        const incrementTime = (totalDuration / end) * 100 // Adjust speed based on value size

        // For large numbers, just increment by chunks
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

    // If value is 0 (initial state), show placeholder or 0
    // If value is loaded (e.g. 9342), show it immediately or animate
    // For better UX, we can just show the value directly if it's available on mount
    // But to solve the "sudden change" issue, we can use a simple fade-in or keep the previous value
    
    return <span>{value ? value.toLocaleString() : '...'}</span>
}

interface HomeHeroProps {
    stats?: {
        totalJobs: number
        companiesCount: number
        dailyJobs: number
    }
}

export default function HomeHero({ stats }: HomeHeroProps) {
    const navigate = useNavigate()
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/jobs?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    return (
        <div className="relative bg-white pb-16 pt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Simplified Centered Hero - No Side Menu */}
                <div className="flex flex-col items-center justify-center min-h-[360px] text-center">
                    
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8 leading-[1.2] tracking-tight">
                        为中国人才打开<span className="text-indigo-600">全球远程工作入口</span>
                    </h1>
                    
                    {/* Subtitle */}
                    <p className="text-slate-600 text-lg md:text-xl max-w-4xl mx-auto mb-10 leading-relaxed font-medium">
                        从全球海量岗位中精选出适合中国求职者的远程工作，不论你身在国内或是海外，都有无限可能。
                    </p>

                    {/* Search Bar - Large & Centered */}
                    <div className="w-full max-w-2xl relative mb-8">
                        <div className="relative bg-white p-2 rounded-2xl shadow-lg shadow-indigo-100/50 border border-slate-200 flex items-center gap-2 focus-within:ring-4 focus-within:ring-indigo-50 focus-within:border-indigo-300 transition-all">
                            <div className="flex-1 flex items-center gap-3 px-3">
                                <Search className="w-6 h-6 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="搜索公司 / 职位 / 技能"
                                    className="w-full py-3 bg-transparent outline-none text-slate-700 placeholder-slate-400 text-lg"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold rounded-xl transition-colors duration-200 shadow-md hover:shadow-lg transform active:scale-95"
                            >
                                搜索
                            </button>
                        </div>
                    </div>

                    {/* Stats - Centered below search */}
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-slate-900 tracking-tight min-w-[60px] transition-all duration-300">
                                {stats?.totalJobs ? stats.totalJobs.toLocaleString() : <span className="text-slate-200">...</span>}
                            </span>
                            <span className="text-sm font-medium text-slate-500 mt-1">全部岗位数</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-slate-900 tracking-tight min-w-[60px] transition-all duration-300">
                                {stats?.companiesCount ? stats.companiesCount.toLocaleString() : <span className="text-slate-200">...</span>}
                            </span>
                            <span className="text-sm font-medium text-slate-500 mt-1">认证企业数</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-bold text-slate-900 tracking-tight min-w-[60px] transition-all duration-300">
                                {stats?.dailyJobs ? stats.dailyJobs.toLocaleString() : <span className="text-slate-200">...</span>}
                            </span>
                            <span className="text-sm font-medium text-slate-500 mt-1">日增岗位数</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
