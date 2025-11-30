import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Zap, Globe2, Users } from 'lucide-react'

// Hardcoded categories based on common tech/remote roles
const CATEGORIES = [
    {
        name: '互联网/AI',
        subCategories: ['Java', 'C/C++', 'PHP', 'Python', 'Go', '前端开发', '全栈开发', '人工智能', '算法工程师']
    },
    {
        name: '电子/电气/通信',
        subCategories: ['电子工程师', '硬件工程师', '通信工程师', '嵌入式', '电路设计']
    },
    {
        name: '产品',
        subCategories: ['产品经理', '产品专员', '产品助理', '数据产品', '策略产品']
    },
    {
        name: '设计',
        subCategories: ['UI设计', 'UX设计', '平面设计', '视觉设计', '交互设计']
    },
    {
        name: '运营/客服',
        subCategories: ['用户运营', '产品运营', '新媒体运营', '客服专员', '客服经理']
    },
    {
        name: '销售/市场',
        subCategories: ['销售专员', '大客户销售', '市场营销', '品牌公关', '商务渠道']
    },
    {
        name: '人力/行政/财务',
        subCategories: ['HRBP', '招聘专员', '行政专员', '会计', '财务分析']
    },
    {
        name: '翻译/写作',
        subCategories: ['英语翻译', '技术写作', '内容编辑', '文案策划']
    }
]

export default function HomeHero() {
    const navigate = useNavigate()
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/jobs?search=${encodeURIComponent(searchQuery)}`)
        }
    }

    return (
        <div className="relative bg-white pb-12 pt-4 lg:pt-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-6 lg:h-[420px]">
                    {/* Left Side: Category Menu - Hidden on mobile, can be a drawer later */}
                    <div className="hidden lg:block w-80 flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-100 relative z-20">
                        <div className="py-2 h-full overflow-y-auto custom-scrollbar">
                            {CATEGORIES.map((cat) => (
                                <div
                                    key={cat.name}
                                    className="group px-6 py-3.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                                    onMouseEnter={() => setActiveCategory(cat.name)}
                                    onMouseLeave={() => setActiveCategory(null)}
                                >
                                    <span className="text-gray-700 font-medium group-hover:text-blue-600 text-[15px]">{cat.name}</span>
                                    <div className="flex items-center gap-2">
                                        {/* Show first 2 subcats as preview */}
                                        <span className="text-xs text-gray-400 font-normal truncate max-w-[100px]">
                                            {cat.subCategories.slice(0, 2).join(' ')}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
                                    </div>

                                    {/* Sub-menu Popup */}
                                    {activeCategory === cat.name && (
                                        <div className="absolute left-full top-0 w-[600px] h-full bg-white rounded-r-lg shadow-lg border-l border-gray-100 p-6 z-50 flex flex-wrap content-start gap-4">
                                            <div className="w-full mb-2">
                                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                    <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                                                    {cat.name}
                                                </h3>
                                            </div>
                                            {cat.subCategories.map((sub) => (
                                                <div
                                                    key={sub}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        navigate(`/jobs?search=${encodeURIComponent(sub)}`)
                                                    }}
                                                    className="px-4 py-2 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-md text-sm transition-colors cursor-pointer border border-transparent hover:border-blue-100"
                                                >
                                                    {sub}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side: Brand Banner */}
                    <div className="flex-1 relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#EBF4FF] via-[#F3E8FF] to-[#E0F2FE] min-h-[400px] lg:min-h-0">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-2/3 h-full opacity-60 pointer-events-none">
                            <svg viewBox="0 0 800 600" className="w-full h-full" preserveAspectRatio="none">
                                <path d="M400 0C600 100 700 300 800 600H0V0H400Z" fill="url(#hero-gradient)" />
                                <defs>
                                    <linearGradient id="hero-gradient" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
                                        <stop offset="100%" stopColor="#9333EA" stopOpacity="0.05" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-16 py-10 lg:py-0">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-blue-700 text-sm font-medium mb-6 w-fit border border-blue-100/50 shadow-sm">
                                <Zap className="w-4 h-4 fill-current" />
                                <span>专为国内求职者打造</span>
                            </div>

                            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                                国内求职者专属的
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                    海外远程工作库
                                </span>
                            </h1>

                            {/* Search Bar */}
                            <div className="max-w-xl bg-white p-2 rounded-xl shadow-lg flex flex-col sm:flex-row items-center gap-2 mb-8 border border-gray-100/50 w-full">
                                <div className="flex-1 flex items-center gap-3 px-4 w-full">
                                    <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="搜索职位、公司、技能..."
                                        className="w-full py-3 bg-transparent outline-none text-gray-700 placeholder-gray-400"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                                >
                                    搜索
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="flex flex-wrap items-center gap-4 md:gap-8 text-sm font-medium text-gray-600">
                                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                    <span className="text-blue-600 font-bold text-lg">500+</span>
                                    <span>精选岗位</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                    <span className="text-purple-600 font-bold text-lg">100+</span>
                                    <span>全球企业</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                    <span className="text-green-600 font-bold text-lg">1200+</span>
                                    <span>求职者</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

