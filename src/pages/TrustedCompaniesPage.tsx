import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import SearchBar from '../components/SearchBar'
import LoadingSpinner from '../components/LoadingSpinner'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import SingleSelectDropdown from '../components/SingleSelectDropdown'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { TrustedStandardsBanner } from '../components/TrustedStandardsBanner'
import { CompanyNominationBanner } from '../components/CompanyNominationBanner'
import { CompanyNominationModal } from '../components/CompanyNominationModal'
import { useAuth } from '../contexts/AuthContext'
import { MembershipUpgradeModal } from '../components/MembershipUpgradeModal'

export default function TrustedCompaniesPage() {
    const navigate = useNavigate()
    const { user, isMember } = useAuth()


    // Filters
    const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
    // Removed sortBy state as we now default to backend sort (updatedAt) and user cannot change it
    // const [sortBy, setSortBy] = useState<'jobCount' | 'createdAt'>('jobCount')
    const [selectedJobCategories, setSelectedJobCategories] = useState<string[]>([])
    
    // Add missing state variables
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [filteredCompanies, setFilteredCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [jobCounts, setJobCounts] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
    const [totalActiveJobs, setTotalActiveJobs] = useState(0)
    const [isNominationModalOpen, setIsNominationModalOpen] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    
    // Hardcoded job categories for filter (matching tag_config)
    const jobCategoryOptions = [
        '全栈开发', '前端开发', '后端开发', '移动开发', '算法工程师', '数据开发',
        '服务器开发', '运维/SRE', '测试/QA', '网络安全', '操作系统/内核', '技术支持',
        '硬件开发', '架构师', 'CTO/技术管理', '软件开发', '产品经理', '产品设计',
        '用户研究', '项目管理', 'UI/UX设计', '平面设计', '视觉设计', '数据分析',
        '数据科学', '商业分析', '运营', '市场营销', '销售', '客户经理', '客户服务',
        '内容创作', '增长黑客', '人力资源', '招聘', '财务', '法务', '行政', '管理',
        '教育培训', '咨询', '投资', '其他'
    ].map(c => ({ label: c, value: c }));

    useEffect(() => {
        loadData()
    }, [])

    // 当搜索或过滤条件变化时，重新加载数据
    useEffect(() => {
        if (searchTerm || selectedIndustries.length > 0 || selectedJobCategories.length > 0) {
            loadFilteredData()
        } else {
            // 如果没有搜索条件，使用初始加载的数据
            // But initial data might be stale if we fetched it differently.
            // Actually, loadData fetches page 1 with defaults.
            // We should just reload with defaults if cleared.
            loadFilteredData()
        }
    }, [searchTerm, selectedIndustries, selectedJobCategories])

    const loadData = async () => {
        try {
            setLoading(true)
            // 使用新的后端联表查询API
            const result = await trustedCompaniesService.getCompaniesWithJobStats({
                page: 1,
                limit: 50,
                sortBy: 'updatedAt', // Default sort
                sortOrder: 'desc',
                minJobs: 1 // Filter for companies with at least 1 job
            })

            const companiesList = result.companies || []
            setCompanies(companiesList)
            setFilteredCompanies(companiesList)
            
            // Set total active jobs count
            setTotalActiveJobs(result.totalActiveJobs || 0)

            // 从后端API返回的数据中提取职位统计信息
            const counts: Record<string, { total: number, categories: Record<string, number> }> = {}
            companiesList.forEach((company: TrustedCompany) => {
                counts[company.id] = {
                    total: company.jobCount || 0,
                    categories: (company as any).jobCategories || {}
                }
            })
            setJobCounts(counts)

        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadFilteredData = async () => {
        try {
            setLoading(true)
            // 使用后端API进行搜索和过滤
            const result = await trustedCompaniesService.getCompaniesWithJobStats({
                page: 1,
                limit: 1000,
                sortBy: 'updatedAt', // Default sort
                sortOrder: 'desc',
                search: searchTerm,
                industry: selectedIndustries.length > 0 ? selectedIndustries[0] : undefined,
                jobCategories: selectedJobCategories, // Pass selected categories
                minJobs: 1 // Filter for companies with at least 1 job
            })

            const filteredList = result.companies || []
            setFilteredCompanies(filteredList)
            
            // Set total active jobs count
            setTotalActiveJobs(result.totalActiveJobs || 0)

            // Update job counts for filtered results too
             const counts: Record<string, { total: number, categories: Record<string, number> }> = {}
            filteredList.forEach((company: TrustedCompany) => {
                counts[company.id] = {
                    total: company.jobCount || 0,
                    categories: (company as any).jobCategories || {}
                }
            })
            setJobCounts(counts)

        } catch (error) {
            console.error('Failed to load filtered data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Derived Filter Options
    const industryOptions = useMemo(() => {
        const industries = new Set<string>()
        // Use all companies or just filtered? 
        // Better to use all initial loaded companies to populate options, or hardcode common industries.
        // For now, using loaded companies is fine but might be limited if page 1 doesn't have all.
        // Ideally we fetch config.
        companies.forEach(c => {
            if (c.industry) industries.add(c.industry)
        })
        return Array.from(industries).sort().map(i => ({ label: i, value: i }))
    }, [companies])

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Hero Section */}
            <div className="relative bg-white overflow-hidden py-8 sm:py-12">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/80 via-white to-transparent opacity-70"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3">
                        <Building className="w-3 h-3" /> Trusted Remote Companies
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">
                        发现全球顶尖<br className="sm:hidden" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600"> 远程友好企业</span>
                    </h1>
                    <p className="text-slate-500 max-w-2xl mx-auto mb-6 text-lg leading-relaxed">
                        Haigoo 严选全球远程工作机会，所有企业均经过人工审核，确保真实可靠。<br className="hidden md:block" />加入我们，开启自由职业的新篇章。
                    </p>

                    {/* Search & Filter Container */}
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl p-2 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="flex-1">
                                <SearchBar
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    onSearch={setSearchTerm}
                                    placeholder="搜索公司、行业或关键词..."
                                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl h-11 text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div className="flex gap-2 overflow-visible pb-2 md:pb-0 px-1 md:px-0 relative z-20">
                                <MultiSelectDropdown
                                    label="行业"
                                    options={industryOptions}
                                    selected={selectedIndustries}
                                    onChange={setSelectedIndustries}
                                />
                                
                                {/* Replaced Sorting with Job Category Filter */}
                                <MultiSelectDropdown
                                    label="在招岗位"
                                    options={jobCategoryOptions}
                                    selected={selectedJobCategories}
                                    onChange={setSelectedJobCategories}
                                />

                                {(selectedIndustries.length > 0 || selectedJobCategories.length > 0) && (
                                    <button
                                        onClick={() => { setSelectedIndustries([]); setSelectedJobCategories([]); }}
                                        className="px-4 h-11 flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
                                    >
                                        重置
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Banners Grid */}
                    <div className="mt-6 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TrustedStandardsBanner 
                            context="company" 
                            isMember={isMember} 
                            onShowUpgrade={() => setShowUpgradeModal(true)}
                        />
                        <CompanyNominationBanner onClick={() => setIsNominationModalOpen(true)} />
                    </div>
                </div>
            </div>

            {/* Company Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Active Jobs Hint */}
                <div className="mb-8 text-left">
                    <span className="text-sm text-slate-400">
                        * 仅展示当前正在招聘中的企业
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        No companies found matching your search.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCompanies.map(company => (
                            <HomeCompanyCard
                                key={company.id}
                                company={company}
                                jobStats={jobCounts[company.id]}
                                onClick={() => navigate(`/companies/${encodeURIComponent(company.name)}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
            {/* Modals */}
            <CompanyNominationModal 
                isOpen={isNominationModalOpen} 
                onClose={() => setIsNominationModalOpen(false)} 
            />
            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                triggerSource="general"
            />
        </div >
    )
}
