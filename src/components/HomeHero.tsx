import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Zap, Shield, TrendingUp, CheckCircle, Code, Palette, Database, LineChart, Building, Settings, MoreHorizontal } from 'lucide-react'

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

interface HomeHeroProps {
    stats?: {
        totalJobs: number
        companiesCount: number
        activeUsers: number
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
                <div className="flex flex-col lg:flex-row gap-6 min-h-[480px]">
                    {/* Left Side: Category Menu */}
                    <div className="hidden lg:block w-64 flex-shrink-0 bg-white rounded-xl border border-gray-100 relative z-20">
                        <div className="px-5 py-4 border-b border-gray-50">
                            <h3 className="text-gray-900 font-bold text-base">
                                热门岗位分类
                            </h3>
                        </div>
                        <div className="py-2">
                            {CATEGORIES.map((cat) => (
                                <div
                                    key={cat.name}
                                    className="group px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors duration-200"
                                    onMouseEnter={() => setActiveCategory(cat.name)}
                                    onMouseLeave={() => setActiveCategory(null)}
                                >
                                    <div className="flex items-center gap-3 text-gray-600 group-hover:text-gray-900 transition-colors">
                                        <div className="text-gray-400 group-hover:text-gray-600">
                                            {cat.icon}
                                        </div>
                                        <span className="font-medium text-sm">{cat.name}</span>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />

                                    {/* Sub-menu Popup */}
                                    {activeCategory === cat.name && (
                                        <div className="absolute left-[calc(100%+8px)] top-0 w-[500px] min-h-full bg-white rounded-xl shadow-xl border border-gray-100 p-6 z-50 flex flex-wrap content-start gap-2">
                                            <div className="w-full mb-3 pb-2 border-b border-gray-50">
                                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
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
                                                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-lg text-sm transition-colors cursor-pointer"
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
                    <div className="flex-1 relative rounded-xl overflow-hidden bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF] border border-blue-50/50">
                        {/* Abstract Background Shapes */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-50/60 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

                        <div className="relative z-10 h-full flex flex-col justify-center px-10 md:px-16 py-12">
                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-[1.15] tracking-tight">
                                国内求职者专属的<br />
                                <span className="text-blue-600">海外远程工作库</span>
                            </h1>

                            <p className="text-gray-500 text-lg mb-10 max-w-xl leading-relaxed">
                                连接全球机会，让职业发展不受地域限制。<br />
                                我们只筛选<span className="text-gray-900 font-medium">国内可申</span>的高质量远程岗位。
                            </p>

                            {/* Search Bar */}
                            <div className="max-w-xl relative">
                                <div className="relative bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                                    <div className="flex-1 flex items-center gap-3 px-3">
                                        <Search className="w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="搜索职位、公司、技能..."
                                            className="w-full py-2.5 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-base"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSearch}
                                        className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors duration-200"
                                    >
                                        搜索
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-12 mt-12">
                                <div className="flex flex-col">
                                    <span className="text-3xl font-bold text-gray-900 tracking-tight">{stats?.totalJobs || 500}+</span>
                                    <span className="text-sm text-gray-500 mt-1">精选岗位</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-3xl font-bold text-gray-900 tracking-tight">{stats?.companiesCount || 100}+</span>
                                    <span className="text-sm text-gray-500 mt-1">可信企业</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-3xl font-bold text-gray-900 tracking-tight">{stats?.activeUsers || 1200}+</span>
                                    <span className="text-sm text-gray-500 mt-1">成功求职</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
