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

export default function TrustedCompaniesPage() {
    const navigate = useNavigate()
    const { membershipCapabilities } = useAuth()
    const canAccessTrustedCompaniesPage = membershipCapabilities.canAccessTrustedCompaniesPage


    // Filters
    const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
    // Removed sortBy state as we now default to backend sort (updatedAt) and user cannot change it
    // const [sortBy, setSortBy] = useState<'jobCount' | 'createdAt'>('jobCount')
    const [selectedJobCategories, setSelectedJobCategories] = useState<string[]>([])

    // Add missing state variables
    const [companies, setCompanies] = useState<TrustedCompany[]>(() => {
        try {
            const cached = localStorage.getItem('haigoo_trusted_companies_cache')
            return cached ? JSON.parse(cached) : []
        } catch { return [] }
    })
    const [filteredCompanies, setFilteredCompanies] = useState<TrustedCompany[]>(() => {
        try {
            const cached = localStorage.getItem('haigoo_trusted_companies_cache')
            return cached ? JSON.parse(cached) : []
        } catch { return [] }
    })
    const [loading, setLoading] = useState(() => {
        try {
            return !localStorage.getItem('haigoo_trusted_companies_cache')
        } catch { return true }
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [jobCounts, setJobCounts] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
    const [totalActiveJobs, setTotalActiveJobs] = useState(0)
    const [availableJobCategories, setAvailableJobCategories] = useState<string[]>([]) // New State
    const [isNominationModalOpen, setIsNominationModalOpen] = useState(false)

    // Pagination State
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const PAGE_SIZE = 12 // Reduced initial batch size for faster paint
    const visibleCompanies = useMemo(
        () => canAccessTrustedCompaniesPage ? filteredCompanies : filteredCompanies.slice(0, 6),
        [canAccessTrustedCompaniesPage, filteredCompanies]
    )

    // Dynamic job categories for filter (matching tag_config)
    const jobCategoryOptions = useMemo(() => {
        return availableJobCategories.map(c => ({ label: c, value: c }));
    }, [availableJobCategories]);

    useEffect(() => {
        // Initial load
        // If we have cache, we do a silent update (don't show loading spinner)
        const hasCache = filteredCompanies.length > 0
        loadFilteredData(1, true, hasCache)
    }, [])

    // 当搜索或过滤条件变化时，重新加载数据 (reset to page 1)
    useEffect(() => {
        const timer = setTimeout(() => {
            loadFilteredData(1, true)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm, selectedIndustries, selectedJobCategories])

    const loadFilteredData = async (pageNum: number, isReset: boolean = false, silent: boolean = false) => {
        try {
            if (!silent) setLoading(true)
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

                // Cache the first page result if no filters active
                if (pageNum === 1 && !searchTerm && selectedIndustries.length === 0 && selectedJobCategories.length === 0) {
                    try {
                        localStorage.setItem('haigoo_trusted_companies_cache', JSON.stringify(newList))
                    } catch (e) {
                        console.error('Failed to cache companies', e)
                    }
                }
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
        <div className="min-h-screen bg-[#F7F9FD]">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-white pt-20 sm:pt-24 md:pt-32 pb-12 sm:pb-14 md:pb-16">
                {/* Background Decoration - contained to avoid overflow issues affecting dropdowns */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_32%),radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_28%)]" />
                    <div className="absolute left-1/2 top-8 h-[340px] w-[760px] -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(243,247,255,0.78),rgba(239,250,245,0.68))] blur-3xl" />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="mb-4 text-[2.35rem] sm:text-[42px] md:text-[68px] font-extrabold text-slate-900 leading-[1.06] tracking-tight">
                        发现全球顶尖<br className="sm:hidden" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600"> 远程友好企业</span>
                    </h1>
                    <p className="mx-auto mb-6 sm:mb-7 max-w-[920px] text-[15px] sm:text-[18px] md:text-[20px] leading-[1.75] text-slate-500">
                        Haigoo 严选全球远程工作机会，所有企业均经过人工审核，确保真实可靠。<br className="hidden md:block" />聚焦更适合中国用户申请的远程友好公司。
                    </p>

                    {/* Search & Filter Container */}
                    <div className="relative z-30 mx-auto max-w-4xl rounded-[24px] sm:rounded-[28px] border border-white/80 bg-white/90 p-2 shadow-[0_22px_60px_-42px_rgba(79,70,229,0.36)] backdrop-blur">
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
                            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:overflow-visible md:pb-0 md:px-0 relative z-20">
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
                    <div className="relative z-10 mt-4 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <TrustedStandardsBanner
                            context="company"
                        />
                        <CompanyNominationBanner onClick={() => setIsNominationModalOpen(true)} />
                    </div>
                </div>
            </div>

            {/* Company Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                {visibleCompanies.map(company => (
                                    <HomeCompanyCard
                                        key={company.id}
                                        company={company}
                                        jobStats={jobCounts[company.id]}
                                        onClick={() => navigate(`/companies/${encodeURIComponent(company.name)}`)}
                                    />
                                ))}
                            </div>

                            {!canAccessTrustedCompaniesPage && (
                                <div className="mt-10 flex justify-center">
                                    <button
                                        onClick={() => navigate('/membership')}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 py-3.5 text-base font-bold text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.38)] transition-all hover:-translate-y-0.5 hover:bg-indigo-600"
                                    >
                                        <Crown className="h-4.5 w-4.5" />
                                        升级会员查看完整名单
                                    </button>
                                </div>
                            )}

                            {canAccessTrustedCompaniesPage && hasMore && (
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
                </>
            </div>
            {/* Modals */}
            <CompanyNominationModal
                isOpen={isNominationModalOpen}
                onClose={() => setIsNominationModalOpen(false)}
            />
        </div >
    )
}
