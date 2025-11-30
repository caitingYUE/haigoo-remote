import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Zap, Shield, TrendingUp, CheckCircle } from 'lucide-react'

// Real job categories mapped from JobCategory type
const CATEGORIES = [
    {
        name: '技术开发',
        icon: '💻',
        subCategories: ['全栈开发', '前端开发', '后端开发', '移动开发', '算法工程师', '数据开发', '服务器开发', '架构师']
    },
    {
        name: '产品设计',
        icon: '🎨',
        subCategories: ['产品经理', '产品设计', 'UI/UX设计', '平面设计', '视觉设计', '用户研究', '项目管理']
    },
    {
        name: '数据分析',
        icon: '📊',
        subCategories: ['数据分析', '数据科学', '商业分析', '数据开发']
    },
    {
        name: '运营市场',
        icon: '📈',
        subCategories: ['运营', '市场营销', '销售', '客户经理', '内容创作', '增长黑客']
    },
    {
        name: '职能支持',
        icon: '🏢',
        subCategories: ['人力资源', '招聘', '财务', '法务', '行政', '客户服务']
    },
    {
        name: '运维测试',
        icon: '⚙️',
        subCategories: ['运维/SRE', '测试/QA', '网络安全', '技术支持']
    },
    {
        name: '其他岗位',
        icon: '✨',
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
        <div className="relative bg-gradient-to-b from-white to-gray-50/50 pb-12 pt-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-6 min-h-[420px]">
                    {/* Left Side: Category Menu */}
                    <div className="hidden lg:block w-80 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 relative z-20 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <span className="text-2xl">🎯</span>
                                热门岗位分类
                            </h3>
                        </div>
                        <div className="py-2 max-h-[360px] overflow-y-auto custom-scrollbar">
                            {CATEGORIES.map((cat) => (
                                <div
                                    key={cat.name}
                                    className="group px-6 py-3.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 cursor-pointer flex items-center justify-between transition-all duration-200"
                                    onMouseEnter={() => setActiveCategory(cat.name)}
                                    onMouseLeave={() => setActiveCategory(null)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{cat.icon}</span>
                                        <span className="text-gray-700 font-medium group-hover:text-blue-600 text-[15px]">{cat.name}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />

                                    {/* Sub-menu Popup */}
                                    {activeCategory === cat.name && (
                                        <div className="absolute left-full top-0 w-[600px] h-full bg-white rounded-r-2xl shadow-2xl border border-gray-100 p-6 z-50 flex flex-wrap content-start gap-3">
                                            <div className="w-full mb-2">
                                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                                    <span className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></span>
                                                    <span className="text-2xl mr-2">{cat.icon}</span>
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
                                                    className="px-4 py-2.5 bg-gradient-to-br from-gray-50 to-blue-50/50 hover:from-blue-50 hover:to-purple-50 text-gray-700 hover:text-blue-600 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border border-gray-100 hover:border-blue-200 hover:shadow-md"
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
                    <div className="flex-1 relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 shadow-lg">
                        {/* Animated Background Decoration */}
                        <div className="absolute inset-0 opacity-30">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
                            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
                            <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
                        </div>

                        <div className="relative z-10 h-full flex flex-col justify-center px-10 md:px-16 py-12">
                            {/* Trust Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full text-blue-700 text-sm font-semibold mb-6 w-fit border border-blue-200/50 shadow-sm">
                                <Shield className="w-4 h-4 text-green-600" />
                                <span>专为国内求职者打造 · 每日人工审核</span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                                <span className="block mb-2">国内求职者专属的</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-gradient">
                                    海外远程工作库
                                </span>
                            </h1>

                            <p className="text-gray-600 text-lg mb-8 max-w-xl">
                                只筛选<span className="text-blue-600 font-semibold">国内可申</span>的高质量远程岗位，让你的职业发展不受地域限制
                            </p>

                            {/* Search Bar */}
                            <div className="max-w-xl bg-white p-2 rounded-xl shadow-xl flex items-center gap-2 mb-8 border border-gray-200/50 hover:shadow-2xl transition-shadow">
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
                                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    搜索
                                </button>
                            </div>

                            {/* Stats with Icons */}
                            <div className="flex items-center gap-6 text-sm font-medium">
                                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-lg">
                                    <TrendingUp className="w-4 h-4 text-blue-600" />
                                    <span className="text-blue-600 font-bold text-lg">{stats?.totalJobs || 500}+</span>
                                    <span className="text-gray-600">精选岗位</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-lg">
                                    <Shield className="w-4 h-4 text-purple-600" />
                                    <span className="text-purple-600 font-bold text-lg">{stats?.companiesCount || 100}+</span>
                                    <span className="text-gray-600">可信企业</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-lg">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span className="text-green-600 font-bold text-lg">{stats?.activeUsers || 1200}+</span>
                                    <span className="text-gray-600">成功求职</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Animations */}
            <style>{`
                @keyframes blob {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
                @keyframes gradient {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradient 3s ease infinite;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(to bottom, #3B82F6, #9333EA);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, #2563EB, #7E22CE);
                }
            `}</style>
        </div>
    )
}
