import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, Building, CheckCircle2, ChevronDown, Crown, Heart, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { CompanyNominationModal } from '../components/CompanyNominationModal'
import { useAuth } from '../contexts/AuthContext'

const HAIGOO_VERIFICATION_STANDARDS = [
    '官网、LinkedIn等主页信息正常，近期有持续更新',
    '主营业务/产品运营状态正常，且非灰黑产',
    '企业远程文化悠久或远程友好，支持员工成长',
    '有中国业务/分公司或对中国员工友好',
    '岗位来自官方招聘平台发布/内推合作，有可联系的对接人或联系方式',
]

const FALLBACK_JOB_CATEGORIES = [
    'CTO/技术管理',
    'UI/UX设计',
    '产品经理',
    '全栈开发',
    '内容创作',
    '前端开发',
    '数据分析',
    '运营/市场'
]

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
    const [showVerificationStandards, setShowVerificationStandards] = useState(false)

    // Pagination State
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const PAGE_SIZE = 12 // Reduced initial batch size for faster paint
    const visibleCompanies = useMemo(
        () => canAccessTrustedCompaniesPage ? filteredCompanies : filteredCompanies.slice(0, 8),
        [canAccessTrustedCompaniesPage, filteredCompanies]
    )

    // Dynamic job categories for filter (matching tag_config)
    const jobCategoryOptions = useMemo(() => {
        const source = availableJobCategories.length ? availableJobCategories : FALLBACK_JOB_CATEGORIES
        return source.map(c => ({ label: c, value: c }));
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
        <div className="min-h-screen overflow-hidden bg-[#fbfaf6] font-haigoo-rounded">
            <section className="relative overflow-visible pt-20 sm:pt-24 md:pt-28">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_18%_22%,rgba(180,220,255,0.28),transparent_28%),radial-gradient(circle_at_82%_30%,rgba(255,222,158,0.22),transparent_30%),linear-gradient(180deg,#fff_0%,#fbfaf6_88%)]" />
                    <div className="absolute inset-x-0 bottom-[-90px] h-64 bg-[linear-gradient(180deg,transparent_0%,rgba(232,244,225,0.48)_62%,rgba(251,250,246,0)_100%)]" />
                    <img src="/pic_lists/Home_pics/grass_icon-transparent.webp" alt="" className="absolute left-[5%] top-[260px] h-28 w-auto opacity-45" />
                    <img src="/pic_lists/Home_pics/rainbow_icon-transparent.webp" alt="" className="absolute right-[17%] top-[170px] h-16 w-auto rotate-12 opacity-50" />
                </div>

                <div className="relative z-10 mx-auto max-w-[1360px] px-4 pb-10 text-center sm:px-6 lg:px-8">
                    <h1 className="haigoo-hand-bold font-haigoo-hand text-[42px] font-black leading-[1.18] tracking-normal text-slate-950 sm:text-[64px] lg:text-[76px]">
                        发现全球顶尖
                        <span className="mx-2 text-[#6f72ff]">远程友好</span>
                        企业
                        <Heart className="ml-2 inline h-9 w-9 text-[#8a86ff]" />
                    </h1>
                    <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500 sm:text-lg">
                        Haigoo 严选全球远程工作机会，所有企业均经过人工审核，确保真实可靠。
                        <br className="hidden sm:block" />
                        聚焦更适合中国用户申请的远程友好公司。
                    </p>

                    <div className="relative z-40 mx-auto mt-8 flex max-w-5xl flex-col items-center justify-center gap-3 lg:flex-row lg:items-start">
                        <div className="relative w-full max-w-2xl">
                            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        loadFilteredData(1, true)
                                    }
                                }}
                                placeholder="搜索公司、行业或关键词..."
                                className="h-14 w-full rounded-full border border-[#dce8ef] bg-white/92 pl-14 pr-14 text-base font-semibold text-slate-800 shadow-[0_18px_48px_-40px_rgba(61,89,120,0.5)] outline-none transition focus:border-[#86b9e8] focus:bg-white focus:ring-4 focus:ring-[#dfeeff]/70"
                            />
                            <button
                                type="button"
                                onClick={() => loadFilteredData(1, true)}
                                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#2f7edb] transition hover:bg-[#eef7ff]"
                                aria-label="搜索企业"
                            >
                                <Search className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="relative z-50 flex shrink-0 flex-wrap justify-center gap-2 lg:justify-end">
                            <MultiSelectDropdown
                                label="行业"
                                options={industryOptions}
                                selected={selectedIndustries}
                                onChange={setSelectedIndustries}
                            />
                            <MultiSelectDropdown
                                label="在招岗位"
                                options={jobCategoryOptions}
                                selected={selectedJobCategories}
                                onChange={setSelectedJobCategories}
                            />
                            {(selectedIndustries.length > 0 || selectedJobCategories.length > 0) && (
                                <button
                                    onClick={() => { setSelectedIndustries([]); setSelectedJobCategories([]); }}
                                    className="h-11 rounded-full px-4 text-sm font-bold text-slate-400 transition-colors hover:bg-white/80 hover:text-[#5f6df6]"
                                >
                                    清空
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative z-10 mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-[1.35fr_0.85fr]">
                        <div className="rounded-[26px] border border-[#dfe7ff] bg-[#f4f7ff]/88 p-5 text-left shadow-[0_20px_52px_-44px_rgba(93,105,246,0.54)] backdrop-blur">
                            <div className="flex items-start gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#5f63f6]">
                                    <ShieldCheck className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-lg font-black text-slate-950">
                                        Haigoo 俱乐部认证企业
                                        <span className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-xs font-bold text-[#6f72ff]">Verified</span>
                                    </div>
                                    <p className="mt-2 text-sm leading-7 text-slate-500">Haigoo 只展示经过严格验证、真实存在、对中国人才友好的企业。</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowVerificationStandards((value) => !value)}
                                        className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-sm font-bold text-[#5f63f6] transition-colors hover:bg-white"
                                    >
                                        {showVerificationStandards ? '收起认证标准' : '查看 5 项认证标准'}
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showVerificationStandards ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showVerificationStandards ? (
                                        <div className="mt-3 grid gap-2">
                                            {HAIGOO_VERIFICATION_STANDARDS.map((item) => (
                                                <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                                                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsNominationModalOpen(true)}
                            className="rounded-[26px] border border-[#eadfff] bg-white/82 p-5 text-left shadow-[0_20px_52px_-44px_rgba(138,86,246,0.48)] backdrop-blur transition-all hover:-translate-y-0.5"
                        >
                            <div className="flex items-start gap-4">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3ebff] text-[#8a63f6]">
                                    <Briefcase className="h-6 w-6" />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2 text-lg font-black text-slate-950">
                                        我要招聘
                                        <span className="rounded-full bg-[#f3ebff] px-2 py-0.5 text-xs font-bold text-[#8a63f6]">Hire Remote</span>
                                    </div>
                                    <p className="mt-2 text-sm leading-7 text-slate-500">有远程招聘需求？提交企业信息和岗位要求，我们将为您对接优质人才。</p>
                                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#8a63f6]">
                                        立即发布 <ArrowRight className="h-4 w-4" />
                                    </span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </section>

            <div className="relative z-10 mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
                <>
                    <div className="mb-7 flex items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                            <Sparkles className="h-4 w-4 text-[#f4b343]" />
                            只展示当前正在招聘中的企业
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/jobs')}
                            className="hidden items-center gap-2 rounded-full bg-white/82 px-4 py-2 text-sm font-bold text-[#5f6df6] shadow-sm transition-all hover:-translate-y-0.5 sm:inline-flex"
                        >
                            浏览全部岗位
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>

                    {loading && filteredCompanies.length === 0 ? (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="h-[300px] animate-pulse overflow-hidden rounded-[26px] border border-[#edf2f6] bg-white">
                                    <div className="h-[46%] bg-[#eef5ff]" />
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
                        <div className="rounded-[30px] border border-dashed border-[#dfeaf1] bg-white/72 py-20 text-center text-slate-500">
                            <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                            没有找到匹配的企业
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                                        onClick={() => navigate('/profile?tab=membership')}
                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#5f63f6] px-8 py-3.5 text-base font-bold text-white shadow-[0_20px_40px_-24px_rgba(95,99,246,0.5)] transition-all hover:-translate-y-0.5"
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
                                        className="flex items-center gap-2 rounded-full border border-[#dfeaf1] bg-white/82 px-8 py-3 font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#bcd6eb] disabled:cursor-not-allowed disabled:opacity-50"
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
