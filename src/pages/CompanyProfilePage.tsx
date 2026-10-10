import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, Clock3, ExternalLink } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import { useNotificationHelpers } from '../components/NotificationSystem'
import JobDetailModal from '../components/JobDetailModal'
import { getCompanyLogoSources } from '../utils/company-logo'
import { useReturnNavigation } from '../hooks/useReturnNavigation'
import { useLanguage } from '../contexts/LanguageContext'
import { trackingService } from '../services/tracking-service'
import '../styles/company-top100.css'

const formatProfileDate = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

export default function CompanyProfilePage() {
    const { text, path } = useLanguage()
    const handleBack = useReturnNavigation(path('/trusted-companies'))
    const location = useLocation()
    const fromTop100 = new URLSearchParams(location.search).get('source') === 'company_top100'
    const backToRanking = new URLSearchParams(location.search).get('returnTo') || path('/trusted-companies/top-100')
    const safeRankingReturn = backToRanking.startsWith('/') && !backToRanking.startsWith('//') ? backToRanking : path('/trusted-companies/top-100')
    const { id } = useParams<{ id: string }>()
    const { showError } = useNotificationHelpers()
    const textRef = useRef(text)

    useEffect(() => {
        textRef.current = text
    }, [text])
    const [company, setCompany] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [jobsLoading, setJobsLoading] = useState(true)
    const [jobsError, setJobsError] = useState(false)
    const [jobsRefresh, setJobsRefresh] = useState(0)
    const companyGeneration = useRef(0)
    const jobsQueryKey = useRef('')
    const [jobPage, setJobPage] = useState(1)
    const [jobTotal, setJobTotal] = useState(0)
    const [hasMoreJobs, setHasMoreJobs] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const hashScrolled = useRef('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'full-time' | 'part-time' | 'contract' | 'internship'>('all')
    const [remoteFilter, setRemoteFilter] = useState<'all' | 'remote' | 'onsite'>('all')

    const loadData = useCallback(async (companyId: string) => {
        const generation = ++companyGeneration.current
        try {
            setLoading(true)
            // 1. Fetch Company Details
            const companyData = await trustedCompaniesService.getCompanyById(companyId)
            if (generation === companyGeneration.current) setCompany(companyData)


        } catch (error) {
            if (generation !== companyGeneration.current) return
            setCompany(null)
            console.error('Failed to load company data:', error)
            showError(textRef.current('加载失败', 'Load failed'), textRef.current('无法获取企业信息', 'Could not load company information.'))
        } finally {
            if (generation === companyGeneration.current) setLoading(false)
        }
    }, [showError])

    useEffect(() => {
        if (id) {
            loadData(id)
        }
    }, [id, loadData])

    jobsQueryKey.current = `${id}:${searchTerm}:${typeFilter}:${remoteFilter}:${jobsRefresh}`
    useEffect(() => {
        if (!id) return
        let active = true
        setJobsLoading(true); setJobsError(false); setSelectedJob(null)
        const timer = setTimeout(() => {
            processedJobsService.getProcessedJobs(1, 24, {
                companyId: id, status: 'active', isApproved: true,
                search: searchTerm || undefined,
                type: typeFilter === 'all' ? undefined : typeFilter,
                isRemote: remoteFilter === 'all' ? undefined : remoteFilter === 'remote'
            }).then(result => {
                if (!active) return
                setJobs(result.jobs); setJobTotal(result.total); setHasMoreJobs(result.hasMore); setJobPage(1)
            }).catch(() => { if (active) { setJobs([]); setJobsError(true) } })
                .finally(() => { if (active) setJobsLoading(false) })
        }, 220)
        return () => { active = false; clearTimeout(timer) }
    }, [id, searchTerm, typeFilter, remoteFilter, jobsRefresh])

    useEffect(() => {
        const key = `${id}:${location.hash}`
        if (loading || jobsLoading || location.hash !== '#company-profile-open-roles' || hashScrolled.current === key) return
        hashScrolled.current = key
        requestAnimationFrame(() => document.getElementById('company-profile-open-roles')?.scrollIntoView({ block: 'start' }))
    }, [id, loading, jobsLoading, location.hash])

    const loadMoreJobs = async () => {
        if (!id || loadingMore) return
        setLoadingMore(true)
        const requestKey = jobsQueryKey.current
        try {
            const result = await processedJobsService.getProcessedJobs(jobPage + 1, 24, {
                companyId: id, status: 'active', isApproved: true,
                search: searchTerm || undefined,
                type: typeFilter === 'all' ? undefined : typeFilter,
                isRemote: remoteFilter === 'all' ? undefined : remoteFilter === 'remote'
            })
            if (requestKey !== jobsQueryKey.current) return
            setJobs(previous => [...new Map([...previous, ...result.jobs].map(job => [job.id, job])).values()])
            setHasMoreJobs(result.hasMore); setJobPage(result.page); setJobTotal(result.total)
        } catch { showError(text('岗位载入失败', 'Could not load more roles'), text('请重试或查看官方招聘页。', 'Retry or check the official careers page.')) }
        finally { setLoadingMore(false) }
    }
    const filteredJobs = jobs
    const officialCareers = useMemo(() => {
        for (const value of [company?.careersPage, company?.website]) {
            try { const url = new URL(value || ''); if (['https:','http:'].includes(url.protocol)) return { url: url.href, careers: value === company?.careersPage } } catch { /* Invalid URLs are not application links. */ }
        }
        return null
    }, [company?.careersPage, company?.website])

    const currentJobIndex = selectedJob ? filteredJobs.findIndex(j => j.id === selectedJob.id) : -1
    const logoSources = useMemo(() => getCompanyLogoSources({
        companyId: company?.id,
        cachedLogoUrl: company?.cachedLogoUrl,
        originalLogoUrl: company?.logo,
        version: company?.updatedAt
    }), [company?.id, company?.cachedLogoUrl, company?.logo, company?.updatedAt])
    const logoSourceKey = useMemo(() => logoSources.join('|'), [logoSources])
    const [logoSourceIndex, setLogoSourceIndex] = useState(0)
    const logoSrc = logoSources[logoSourceIndex] || ''

    useEffect(() => {
        setLogoSourceIndex(0)
    }, [logoSourceKey])

    if (loading) {
        return (
            <div className="hg-company-detail-page min-h-screen pt-28">
                <div className="haigoo-shell" aria-label={text('正在加载企业资料', 'Loading company profile')} aria-busy="true">
                    <div className="border-t-2 border-[#101829] py-8">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#52738c]">COMPANY PROFILE</p>
                        <div className="mt-4 h-10 w-64 animate-pulse bg-[#dfe7e8]" />
                        <div className="mt-5 h-4 w-full max-w-2xl animate-pulse bg-[#e6e1d8]" />
                    </div>
                    <div className="grid gap-6 border-y border-[#d9d3c9] py-8 md:grid-cols-3">
                        {[0, 1, 2].map(item => <div key={item} className="h-24 animate-pulse bg-[#edf4f8]" />)}
                    </div>
                </div>
            </div>
        )
    }

    if (!company) {
        return (
            <div className="hg-company-detail-page flex min-h-screen flex-col items-center justify-center p-4 text-center">
                <h1 className="font-[var(--hg-font-editorial)] text-3xl font-semibold text-[var(--hg-text-primary)]">{text('未找到该企业', 'Company not found')}</h1>
                <button type="button" onClick={handleBack} className="mt-5 min-h-11 text-sm font-bold text-[var(--hg-action-brand)]">{fromTop100 ? text('返回 Top 100', 'Back to Top 100') : text('返回远程企业', 'Back to remote companies')}</button>
            </div>
        )
    }

    const updatedLabel = formatProfileDate(company.updatedAt)

    return (
        <div className="hg-company-detail-page min-h-screen">
            <div className="haigoo-shell hg-company-detail hg-company-profile">
                <button type="button" onClick={handleBack} className="hg-company-detail__back">
                    <ArrowLeft aria-hidden="true" />
                    {fromTop100 ? text('返回 Top 100', 'Back to Top 100') : text('返回远程企业', 'Back to remote companies')}
                </button>

                {fromTop100 && <aside className="hg-company-profile__ranking-context">
                    <p>{text('你正在从 Top 100 关注榜查看这家企业。此页岗位不限大陆，请核对具体职位的所在地、合同与工作时段。', 'You arrived from the Top 100 research list. Openings here may include other locations; confirm the role’s country, contract and working hours.')}</p>
                    <Link to={safeRankingReturn}>{text('返回榜单查看研究说明', 'Return to ranking research')}</Link>
                </aside>}

                <header className="hg-company-detail__hero">
                    <div className="hg-company-detail__identity">
                        <div className="hg-company-detail__logo">
                            {logoSrc ? (
                                <img
                                    src={logoSrc}
                                    alt={company.name}
                                    onError={() => {
                                        if (logoSourceIndex < logoSources.length - 1) {
                                            setLogoSourceIndex((index) => index + 1)
                                        } else {
                                            setLogoSourceIndex(logoSources.length)
                                        }
                                    }}
                                />
                            ) : (
                                <span aria-hidden="true">{company.name.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <p className="haigoo-editorial-label">{text('COMPANY PROFILE · 企业资料', 'COMPANY PROFILE')}</p>
                            <h1>{company.name}</h1>
                            <p className="hg-company-detail__lead">{text('了解企业正在做什么，并查看最近公开的岗位。', 'Learn what the company does and review its latest public openings.')}</p>
                        </div>
                    </div>

                    <dl className="hg-company-detail__hero-facts">
                        <div>
                            <dt>{text('行业', 'Industry')}</dt>
                            <dd>{company.industry || text('待补充', 'Not available')}</dd>
                        </div>
                        <div>
                            <dt>{text('最近整理', 'Last updated')}</dt>
                            <dd>{updatedLabel || text('待补充', 'Not available')}</dd>
                        </div>
                        <div>
                            <dt>{text('当前匹配岗位', 'Matching openings')}</dt>
                            <dd>{jobsLoading ? text('载入中', 'Loading') : jobsError ? text('暂无法获取', 'Unavailable') : text(`${jobTotal} 个`, `${jobTotal} roles`)}</dd>
                        </div>
                    </dl>
                </header>

                {company.tags && company.tags.length > 0 ? (
                    <div className="hg-company-detail__taxonomy">
                        <span>{text('关注方向', 'Focus areas')}</span>
                        <div>
                            {company.tags.slice(0, 10).map((tag, index) => (
                                <span key={String(tag) + index}>{String(tag)}</span>
                            ))}
                        </div>
                    </div>
                ) : null}

                <article className="hg-company-profile__about">
                    <p className="haigoo-editorial-label">{text('ABOUT · 关于企业', 'ABOUT')}</p>
                    <h2>{text('它们在做什么', 'What the company does')}</h2>
                    <p>{company.description || text('企业介绍正在整理中。', 'The company profile is being prepared.')}</p>
                </article>

                <section className="hg-company-detail__jobs" aria-labelledby="company-profile-open-roles">
                    <header>
                        <div>
                            <p className="haigoo-editorial-label">{text('OPEN ROLES · 公开岗位', 'OPEN ROLES')}</p>
                            <h2 id="company-profile-open-roles">{text('最近公开的岗位', 'Latest public openings')}</h2>
                        </div>
                        {officialCareers && <a className="hg-company-profile__official-careers" href={officialCareers.url} target="_blank" rel="noopener noreferrer" onClick={() => trackingService.track('company_official_careers_click', { entity_id: id || '', source_key: fromTop100 ? 'company_top100' : 'company_profile', page_key: 'company_detail' })}>
                            {officialCareers.careers ? text('企业官方招聘页', 'Official careers page') : text('查看企业官网', 'Company website')}<ExternalLink size={15} aria-hidden="true" />
                        </a>}
                    </header>

                    <div className="hg-company-profile__filters">
                        <label>
                            <span>{text('搜索岗位', 'Search roles')}</span>
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder={text('岗位名称、地点或类型', 'Title, location, or type')}
                            />
                        </label>
                        <label>
                            <span>{text('工作类型', 'Employment type')}</span>
                            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
                                <option value="all">{text('全部类型', 'All types')}</option>
                                <option value="full-time">{text('全职', 'Full-time')}</option>
                                <option value="part-time">{text('兼职', 'Part-time')}</option>
                                <option value="contract">{text('合同', 'Contract')}</option>
                                <option value="internship">{text('实习', 'Internship')}</option>
                            </select>
                        </label>
                        <label>
                            <span>{text('工作地点', 'Work location')}</span>
                            <select value={remoteFilter} onChange={(event) => setRemoteFilter(event.target.value as typeof remoteFilter)}>
                                <option value="all">{text('全部地点', 'All locations')}</option>
                                <option value="remote">{text('标注为远程', 'Marked remote')}</option>
                                <option value="onsite">{text('未标注远程', 'Not marked remote')}</option>
                            </select>
                        </label>
                    </div>

                    {jobsLoading ? <p className="hg-company-profile__jobs-status" role="status">{text('正在载入岗位…', 'Loading openings…')}</p> : jobsError ? <div className="hg-company-detail__jobs-empty"><Briefcase aria-hidden="true" /><div><h3>{text('岗位信息暂不可用', 'Openings are temporarily unavailable')}</h3><p>{text('可重试载入，或通过上方入口查看官方招聘页。', 'Retry loading or check the official careers page above.')}</p><button type="button" className="hg-company-profile__load-more" onClick={() => setJobsRefresh(value => value+1)}>{text('重新载入', 'Retry')}</button></div></div> : filteredJobs.length > 0 ? (
                        <div className="hg-company-detail__job-list">
                            {filteredJobs.map((job) => (
                                <JobCardNew
                                    key={job.id}
                                    job={job}
                                    variant="list"
                                    onClick={() => setSelectedJob(job)}
                                    isActive={selectedJob?.id === job.id}
                                    compactFeatured
                                    hideMemberBackdrop
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="hg-company-detail__jobs-empty">
                            <Briefcase aria-hidden="true" />
                            <div>
                                <h3>{text('没有匹配的公开岗位', 'No matching public openings')}</h3>
                                <p>{searchTerm.trim() || typeFilter !== 'all' || remoteFilter !== 'all' ? text('试试缩短关键词，或调整一个筛选条件。', 'Try a shorter keyword or change a filter.') : text('站内暂无公开岗位，可通过上方入口查看企业官方招聘页。', 'No roles are currently listed here. Check the official careers page above.')}</p>
                            </div>
                        </div>
                    )}
                    {!jobsLoading && !jobsError && jobs.length > 0 && <div className="hg-company-profile__pagination"><span>{text(`已载入 ${jobs.length} / ${jobTotal} 个岗位`, `${jobs.length} / ${jobTotal} openings loaded`)}</span>{hasMoreJobs && <button type="button" disabled={loadingMore} onClick={loadMoreJobs}>{loadingMore ? text('正在载入…', 'Loading…') : text('载入更多岗位', 'Load more roles')}</button>}</div>}
                </section>

                <p className="hg-company-profile__source-note">
                    <Clock3 aria-hidden="true" />
                    {text('岗位与企业信息来自公开渠道，请以企业官方页面的最新信息为准。', 'Company and role information comes from public sources. Confirm the latest details on the official company page.')}
                </p>
            </div>

            {selectedJob ? (
                <JobDetailModal
                    job={selectedJob}
                    isOpen={Boolean(selectedJob)}
                    onClose={() => setSelectedJob(null)}
                    jobs={filteredJobs}
                    currentJobIndex={currentJobIndex}
                    onNavigateJob={(direction) => {
                        const nextIndex = direction === 'prev'
                            ? Math.max(0, currentJobIndex - 1)
                            : Math.min(filteredJobs.length - 1, currentJobIndex + 1)
                        setSelectedJob(filteredJobs[nextIndex])
                    }}
                />
            ) : null}
        </div>
    )
}
