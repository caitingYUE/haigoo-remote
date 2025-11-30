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
        <div className="relative bg-[#F8F9FC] pb-16 pt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-8 min-h-[480px]">
                    {/* Left Side: Category Menu */}
                    <div className="hidden lg:block w-72 flex-shrink-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 relative z-20 overflow-visible">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                                热门岗位分类
                            </h3>
                        </div>
                        <div className="py-2">
                            {CATEGORIES.map((cat) => (
                                <div
                                    key={cat.name}
                                    className="group px-6 py-3.5 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-colors duration-200"
                                    onMouseEnter={() => setActiveCategory(cat.name)}
                                    onMouseLeave={() => setActiveCategory(null)}
                                >
                                    <div className="flex items-center gap-3 text-gray-500 group-hover:text-blue-600 transition-colors">
                                        {cat.icon}
                                        <span className="font-medium text-[15px]">{cat.name}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />

                                    {/* Sub-menu Popup */}
                                    {activeCategory === cat.name && (
                                        <div className="absolute left-[calc(100%+8px)] top-0 w-[600px] min-h-full bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 p-6 z-50 flex flex-wrap content-start gap-3">
                                            <div className="w-full mb-2 pb-3 border-b border-gray-50">
                                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                    <span className="text-blue-600">{cat.icon}</span>
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
                                                    className="px-4 py-2 bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-100"
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
                    <div className="flex-1 relative rounded-2xl overflow-hidden bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100">
                        {/* Clean Professional Background */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-white opacity-80"></div>
                        <div className="absolute right-0 top-0 w-1/2 h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
                        
                        <div className="relative z-10 h-full flex flex-col justify-center px-10 md:px-16 py-12">
                            {/* Trust Badge */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-blue-700 text-xs font-semibold mb-8 w-fit border border-blue-100">
                                <Shield className="w-3.5 h-3.5" />
                                <span>每日人工审核 · 专为国内求职者打造</span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-[1.2] tracking-tight">
                                国内求职者专属的<br />
                                <span className="text-blue-600">海外远程工作库</span>
                            </h1>

                            <p className="text-gray-500 text-lg mb-10 max-w-xl leading-relaxed">
                                只筛选<span className="text-gray-900 font-medium mx-1">国内可申</span>的高质量远程岗位，让你的职业发展不受地域限制
                            </p>

                            {/* Search Bar */}
                            <div className="max-w-xl relative group">
                                <div className="absolute inset-0 bg-blue-100 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity"></div>
                                <div className="relative bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
                                    <div className="flex-1 flex items-center gap-3 px-4">
                                        <Search className="w-5 h-5 text-gray-400" />
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
                                        className="px-8 py-3 bg-gray-900 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200"
                                    >
                                        搜索
                                    </button>
                                </div>
                            </div>

                            {/* Stats with Icons */}
                            <div className="flex items-center gap-8 mt-12 pt-8 border-t border-gray-100">
                                <div className="flex flex-col gap-1">
                                    <span className="text-2xl font-bold text-gray-900">{stats?.totalJobs || 500}+</span>
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> 精选岗位
                                    </span>
                                </div>
                                <div className="w-px h-10 bg-gray-100"></div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-2xl font-bold text-gray-900">{stats?.companiesCount || 100}+</span>
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5" /> 可信企业
                                    </span>
                                </div>
                                <div className="w-px h-10 bg-gray-100"></div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-2xl font-bold text-gray-900">{stats?.activeUsers || 1200}+</span>
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5" /> 成功求职
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
