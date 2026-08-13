import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, Building, Search } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import CompanyDirectoryEntry from '../components/CompanyDirectoryEntry'
import { CompanyNominationModal } from '../components/CompanyNominationModal'
import { useAuth } from '../contexts/AuthContext'
import { getCompanyDetailPath } from '../utils/share-link-helper'
import { useLanguage } from '../contexts/LanguageContext'
import { COMPLIANCE_FEATURES } from '../config/compliance'
import HaigooCompanyCard from '../components/HaigooCompanyCard'

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
    const { isEnglish, text } = useLanguage()
    // The directory is a Club Partner benefit. A verified free account should
    // retain the same 12-company preview as a guest instead of bypassing it.
    const canAccessTrustedCompaniesPage = membershipCapabilities.canAccessTrustedCompaniesPage


    // Filters
    const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
    // Removed sortBy state as we now default to backend sort (updatedAt) and user cannot change it
    // const [sortBy, setSortBy] = useState<'jobCount' | 'createdAt'>('jobCount')
    const [selectedJobCategories, setSelectedJobCategories] = useState<string[]>([])

    // Add missing state variables
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
    const [availableJobCategories, setAvailableJobCategories] = useState<string[]>([]) // New State
    const [isNominationModalOpen, setIsNominationModalOpen] = useState(false)

    // Pagination State
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const PAGE_SIZE = 12 // Reduced initial batch size for faster paint
    const visibleCompanies = useMemo(
        () => canAccessTrustedCompaniesPage ? filteredCompanies : filteredCompanies.slice(0, 12),
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

    useEffect(() => {
        if (canAccessTrustedCompaniesPage) return
        if (searchTerm || selectedIndustries.length > 0 || selectedJobCategories.length > 0) {
            setSearchTerm('')
            setSelectedIndustries([])
            setSelectedJobCategories([])
        }
    }, [canAccessTrustedCompaniesPage, searchTerm, selectedIndustries.length, selectedJobCategories.length])

    // 当搜索或过滤条件变化时，重新加载数据 (reset to page 1)
    useEffect(() => {
        const timer = setTimeout(() => {
            loadFilteredData(1, true)
        }, 300)
        return () => clearTimeout(timer)
    }, [canAccessTrustedCompaniesPage, searchTerm, selectedIndustries, selectedJobCategories])

    const loadFilteredData = async (pageNum: number, isReset: boolean = false, silent: boolean = false) => {
        try {
            if (!silent) setLoading(true)
            const effectiveSearch = canAccessTrustedCompaniesPage ? searchTerm : ''
            const effectiveIndustries = canAccessTrustedCompaniesPage ? selectedIndustries : []
            const effectiveJobCategories = canAccessTrustedCompaniesPage ? selectedJobCategories : []
            const result = await trustedCompaniesService.getCompaniesWithJobStats({
                page: pageNum,
                limit: PAGE_SIZE,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                search: effectiveSearch,
                industry: effectiveIndustries.length > 0 ? effectiveIndustries[0] : undefined,
                jobCategories: effectiveJobCategories,
                minJobs: 1
            })

            const newList = result.companies || []

            if (isReset) {
                setFilteredCompanies(newList)
                setPage(1)

                // Cache the first page result if no filters active
                if (pageNum === 1 && !effectiveSearch && effectiveIndustries.length === 0 && effectiveJobCategories.length === 0) {
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

    const featuredCompanies = visibleCompanies.slice(0, 2)
    const directoryCompanies = visibleCompanies.slice(2)
    // Always leave an explicit continuation point for the preview. The first
    // response can contain fewer than 12 entries when public data changes,
    // but that must not make the restricted directory look like it has ended.
    const isRestrictedPreview = !canAccessTrustedCompaniesPage && filteredCompanies.length > 0
    return (
        <div className="hg-companies-page min-h-screen">
            <section className="hg-companies-hero">
                <div className="haigoo-shell hg-companies-hero__grid">
                    <div>
                        <p className="haigoo-editorial-label">{text('REMOTE COMPANY INDEX · 远程企业', 'REMOTE COMPANY INDEX')}</p>
                        <h1>
                            {isEnglish
                                ? <><span>Remote companies</span><span>worth following</span></>
                                : <><span>值得长期关注的</span><span>远程企业</span></>}
                        </h1>
                    </div>
                    <div className="hg-companies-hero__deck">
                        <p>{text('了解它们做什么、如何工作，以及在哪里查看最新机会。', 'Learn what they do, how they work, and where to find their latest openings.')}</p>
                        <p>{text('企业资料与岗位线索整理自官网、官方 Careers 页面及公开渠道。公开信息可能随时变化，请以企业官方页面为准。', 'Profiles and role signals come from official websites, Careers pages, and public sources. Always confirm the latest information on the company site.')}</p>
                    </div>
                </div>

                <div className="haigoo-shell hg-companies-promise" aria-label={text('企业信息说明', 'Company information notes')}>
                    <div>
                        <span>{text('了解业务', 'WHAT THEY DO')}</span>
                        <strong>{text('先看它们在解决什么问题', 'Understand the work first')}</strong>
                    </div>
                    <div>
                        <span>{text('理解方式', 'HOW THEY WORK')}</span>
                        <strong>{text('关注公开的远程协作方式', 'Review published work practices')}</strong>
                    </div>
                    <div>
                        <span>{text('回到官网', 'WHERE TO APPLY')}</span>
                        <strong>{text('最新机会以企业页面为准', 'Confirm openings at the source')}</strong>
                    </div>
                </div>
            </section>

            <div className="haigoo-shell hg-companies-main">
                <section className="hg-companies-tools" aria-label={text('搜索与筛选企业', 'Search and filter companies')}>
                    <div className="hg-companies-search">
                        <Search aria-hidden="true" />
                        <label className="sr-only" htmlFor="company-directory-search">{text('搜索企业、行业或岗位方向', 'Search companies, industries, or roles')}</label>
                        <input
                            id="company-directory-search"
                            value={searchTerm}
                            onChange={(event) => {
                                if (!canAccessTrustedCompaniesPage) return
                                setSearchTerm(event.target.value)
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && canAccessTrustedCompaniesPage) {
                                    loadFilteredData(1, true)
                                }
                            }}
                            disabled={!canAccessTrustedCompaniesPage}
                            placeholder={canAccessTrustedCompaniesPage
                                ? text('搜索企业、行业或岗位方向', 'Search companies, industries, or roles')
                                : text('完整企业搜索暂未开放', 'Full company search is not available yet')}
                        />
                        <button
                            type="button"
                            onClick={() => loadFilteredData(1, true)}
                            disabled={!canAccessTrustedCompaniesPage}
                            aria-label={text('搜索企业', 'Search companies')}
                        >
                            <ArrowRight aria-hidden="true" />
                        </button>
                    </div>

                    <div className="hg-companies-filters">
                        <MultiSelectDropdown
                            label={text('行业', 'Industry')}
                            options={industryOptions}
                            selected={selectedIndustries}
                            onChange={setSelectedIndustries}
                            disabled={!canAccessTrustedCompaniesPage}
                            disabledMessage={text('行业筛选暂未开放', 'Industry filters are not available yet')}
                        />
                        <MultiSelectDropdown
                            label={text('岗位方向', 'Role')}
                            options={jobCategoryOptions}
                            selected={selectedJobCategories}
                            onChange={setSelectedJobCategories}
                            disabled={!canAccessTrustedCompaniesPage}
                            disabledMessage={text('岗位筛选暂未开放', 'Role filters are not available yet')}
                        />
                        {(selectedIndustries.length > 0 || selectedJobCategories.length > 0) ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedIndustries([])
                                    setSelectedJobCategories([])
                                }}
                                className="hg-companies-clear"
                            >
                                {text('清除筛选', 'Clear filters')}
                            </button>
                        ) : null}
                    </div>
                </section>

                {!canAccessTrustedCompaniesPage ? (
                    <p className="hg-companies-access-note">
                        {text('当前可浏览部分远程企业资料，完整名单暂不对外开放。', 'Some remote-company profiles are available to browse. The full directory is not publicly available.')}
                    </p>
                ) : null}

                {COMPLIANCE_FEATURES.employerRecruitmentIntake ? (
                    <button
                        type="button"
                        onClick={() => setIsNominationModalOpen(true)}
                        className="hg-companies-intake"
                    >
                        <Briefcase aria-hidden="true" />
                        <span>
                            <strong>{text('企业合作 / 发布远程岗位', 'Hire remote talent / Post a job')}</strong>
                            <small>{text('提交企业与岗位信息', 'Share company and role information')}</small>
                        </span>
                        <ArrowRight aria-hidden="true" />
                    </button>
                ) : null}

                <section className="hg-companies-directory">
                    <header className="hg-companies-directory__header">
                        <div>
                            <p className="haigoo-editorial-label">{text('RECENTLY UPDATED · 最近更新', 'RECENTLY UPDATED')}</p>
                            <h2>{text('正在公开招聘的远程企业', 'Remote companies with public openings')}</h2>
                        </div>
                        <div className="hg-companies-directory__summary">
                            <button type="button" onClick={() => navigate('/jobs')}>
                                {text('浏览全部岗位', 'Browse all jobs')}
                                <ArrowRight aria-hidden="true" />
                            </button>
                        </div>
                    </header>

                    {loading && filteredCompanies.length === 0 ? (
                        <div className="hg-companies-loading" aria-label={text('正在加载企业', 'Loading companies')}>
                            {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="hg-companies-empty">
                            <Search aria-hidden="true" />
                            <h3>{text('没有找到匹配的企业', 'No matching companies')}</h3>
                            <p>{text('试试缩短关键词，或清除一个筛选条件。', 'Try a shorter keyword or remove a filter.')}</p>
                        </div>
                    ) : (
                        <>
                            {featuredCompanies.length > 0 ? (
                                <div className="hg-companies-featured">
                                    {featuredCompanies.map((company) => (
                                        <CompanyDirectoryEntry
                                            key={company.id}
                                            company={company}
                                            featured
                                            jobStats={jobCounts[company.id]}
                                            onClick={() => navigate(getCompanyDetailPath(company.name))}
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {directoryCompanies.length > 0 ? (
                                <div className="hg-companies-records">
                                    {directoryCompanies.map((company) => (
                                        <CompanyDirectoryEntry
                                            key={company.id}
                                            company={company}
                                            jobStats={jobCounts[company.id]}
                                            onClick={() => navigate(getCompanyDetailPath(company.name))}
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {isRestrictedPreview ? (
                                <div className="hg-companies-login-gate">
                                    <div>
                                        <strong>{text('完整企业名单暂未开放', 'The full company directory is not yet open')}</strong>
                                        <p>{text('当前可浏览部分远程企业资料，完整名单暂不对外开放。', 'Some remote-company profiles are available to browse. The full directory is not publicly available.')}</p>
                                    </div>
                                </div>
                            ) : null}

                            {canAccessTrustedCompaniesPage && hasMore ? (
                                <div className="hg-companies-load-more">
                                    <button type="button" onClick={handleLoadMore} disabled={loading}>
                                        {loading ? text('正在加载…', 'Loading…') : text('加载更多企业', 'Load more companies')}
                                        <Building aria-hidden="true" />
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </section>

                <HaigooCompanyCard />
            </div>

            {COMPLIANCE_FEATURES.employerRecruitmentIntake ? (
                <CompanyNominationModal
                    isOpen={isNominationModalOpen}
                    onClose={() => setIsNominationModalOpen(false)}
                />
            ) : null}
        </div>
    )
}
