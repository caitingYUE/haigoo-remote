import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building, Crown } from 'lucide-react'
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
    const [availableJobCategories, setAvailableJobCategories] = useState<string[]>([]) // New State
    const [isNominationModalOpen, setIsNominationModalOpen] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    
    // Pagination State
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const PAGE_SIZE = 12 // Reduced initial batch size for faster paint

    // Dynamic job categories for filter (matching tag_config)
    const jobCategoryOptions = useMemo(() => {
        return availableJobCategories.map(c => ({ label: c, value: c }));
    }, [availableJobCategories]);

    useEffect(() => {
        // Initial load
        loadFilteredData(1, true)
    }, [])

    // 当搜索或过滤条件变化时，重新加载数据 (reset to page 1)
    useEffect(() => {
        // Skip first render as it is handled by initial load
        // But since we use same function, we can just call it.
        // We need a ref to track if it's initial render if we want to avoid double fetch?
        // Actually, initial state is empty, so loadFilteredData(1) is fine.
        // But useEffect [] runs once.
        // Let's just use this effect for updates.
        // For initial load, we can rely on this effect if we set initial states correctly.
        // However, we want to debounce search.
        
        const timer = setTimeout(() => {
            loadFilteredData(1, true)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm, selectedIndustries, selectedJobCategories])

    const loadFilteredData = async (pageNum: number, isReset: boolean = false) => {
        try {
            setLoading(true)
            const result = await trustedCompaniesService.getCompaniesWithJobStats({
                page: pageNum,
                limit: PAGE_SIZE,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                search: searchTerm,
                industry: selectedIndustries.length > 0 ? selectedIndustries[0] : undefined,
                jobCategories: selectedJobCategories,
                minJobs: 1
            })

            const newList = result.companies || []
            
            if (isReset) {
                setCompanies(newList) // Keep track of base list if needed, but filteredCompanies is what we show
                setFilteredCompanies(newList)
                setPage(1)
            } else {
                setFilteredCompanies(prev => [...prev, ...newList])
                setPage(pageNum)
            }
            
            // Calculate hasMore
            const total = result.total || 0
            const currentCount = isReset ? newList.length : filteredCompanies.length + newList.length
            // Or simpler:
            setHasMore(pageNum < (result.totalPages || 0))

            setTotalActiveJobs(result.totalActiveJobs || 0)

            if (result.availableCategories) {
                setAvailableJobCategories(result.availableCategories);
            }

            // Update job counts map
            const newCounts: Record<string, { total: number, categories: Record<string, number> }> = {}
            newList.forEach((company: TrustedCompany) => {
                newCounts[company.id] = {
                    total: company.jobCount || 0,
                    categories: (company as any).jobCategories || {}
                }
            })
            
            setJobCounts(prev => isReset ? newCounts : { ...prev, ...newCounts })

        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            loadFilteredData(page + 1, false)
        }
    }

    // Derived Filter Options (Static list or from loaded data? Better static or from config)
    const industryOptions = useMemo(() => {
        // We can accumulate industries from loaded companies, but that might be incomplete.
        // For now, let's stick to what we have or fetch config.
        // Let's use the ones from the current list + maybe a hardcoded popular list.
        const industries = new Set<string>()
        filteredCompanies.forEach(c => {
            if (c.industry) industries.add(c.industry)
        })
        return Array.from(industries).sort().map(i => ({ label: i, value: i }))
    }, [filteredCompanies])


    return (
        <div className="min-h-screen bg-slate-50">
            {/* Hero Section */}
            <div className="relative bg-white pt-8 sm:pt-12 pb-20">
                {/* Background Decoration - contained to avoid overflow issues affecting dropdowns */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
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
                {!isMember ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="bg-white rounded-3xl shadow-xl border border-indigo-50 p-8 md:p-12 max-w-3xl w-full text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                            
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-amber-100">
                                <Crown className="w-10 h-10 text-amber-500 fill-amber-500" />
                            </div>
                            
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                                解锁 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">500+ 精选远程企业</span> 名单
                            </h2>
                            
                            <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
                                Haigoo 会员专享特权，查看所有经过人工审核的真实远程企业，
                                <br className="hidden sm:block" />
                                获取详细投递渠道与内推机会。
                            </p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-2xl mx-auto">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="font-bold text-2xl text-slate-900 mb-1">100%</div>
                                    <div className="text-sm text-slate-500 font-medium">人工审核验证</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="font-bold text-2xl text-slate-900 mb-1">3x</div>
                                    <div className="text-sm text-slate-500 font-medium">面试回复率</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="font-bold text-2xl text-slate-900 mb-1">Direct</div>
                                    <div className="text-sm text-slate-500 font-medium">直达投递渠道</div>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="px-10 py-4 bg-slate-900 hover:bg-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2 mx-auto w-full sm:w-auto"
                            >
                                <Crown className="w-5 h-5" />
                                立即升级会员查看
                            </button>
                            
                            <p className="mt-4 text-sm text-slate-400">
                                30天无理由退款保证 · 安全支付
                            </p>
                        </div>
                    </div>
                ) : (
                <>
                {/* Active Jobs Hint */}
                <div className="mb-8 text-left">
                    <span className="text-sm text-slate-400">
                        * 仅展示当前正在招聘中的企业
                    </span>
                </div>

                {loading && filteredCompanies.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-100 overflow-hidden h-[340px] animate-pulse">
                                <div className="h-[56%] bg-slate-200" />
                                <div className="p-5 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="h-6 bg-slate-200 rounded w-1/2" />
                                        <div className="h-5 bg-slate-200 rounded w-16" />
                                    </div>
                                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                                    <div className="h-4 bg-slate-200 rounded w-full" />
                                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                                    <div className="pt-4 mt-2 border-t border-slate-50 flex justify-between">
                                        <div className="h-4 bg-slate-200 rounded w-1/3" />
                                        <div className="h-4 bg-slate-200 rounded w-1/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        No companies found matching your search.
                    </div>
                ) : (
                    <>
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
                        
                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-12 flex justify-center">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={loading}
                                    className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-indigo-200 transition-all duration-200 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
                                            加载中...
                                        </>
                                    ) : (
                                        <>
                                            加载更多
                                            <Building className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                </>
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
