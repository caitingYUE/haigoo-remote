import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, Clock3 } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import { useNotificationHelpers } from '../components/NotificationSystem'
import JobDetailModal from '../components/JobDetailModal'
import { getCompanyLogoSources } from '../utils/company-logo'
import { useReturnNavigation } from '../hooks/useReturnNavigation'
import { useLanguage } from '../contexts/LanguageContext'

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
    const handleBack = useReturnNavigation('/jobs')
    const { id } = useParams<{ id: string }>()
    const { showError } = useNotificationHelpers()
    const { text } = useLanguage()
    const textRef = useRef(text)

    useEffect(() => {
        textRef.current = text
    }, [text])
    const [company, setCompany] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'full-time' | 'part-time' | 'contract' | 'internship'>('all')
    const [remoteFilter, setRemoteFilter] = useState<'all' | 'remote' | 'onsite'>('all')

    const loadData = useCallback(async (companyId: string) => {
        try {
            setLoading(true)
            // 1. Fetch Company Details
            const companyData = await trustedCompaniesService.getCompanyById(companyId)
            setCompany(companyData)

            // 2. Fetch Related Jobs (Filter by company name)
            // Note: This is a simple client-side filter. ideally backend should support filtering by company ID if linked.
            // For now we match by name.
            // const allJobs = await processedJobsService.getAllProcessedJobs(1000) // Fetch enough jobs
            // Use specific company filter query to backend
            const jobsResponse = await processedJobsService.getProcessedJobs(1, 100, { company: companyData?.name });
            const allJobs = jobsResponse.jobs;
            
            const relatedJobs = allJobs.filter(job => {
                // Check by ID first (more accurate for trusted companies)
                if (job.companyId && job.companyId === companyId) return true

                // Fallback to name matching
                return job.company && companyData && companyData.name &&
                    job.company.toLowerCase().includes(companyData.name.toLowerCase())
            })
            setJobs(relatedJobs)

        } catch (error) {
            console.error('Failed to load company data:', error)
            showError(textRef.current('加载失败', 'Load failed'), textRef.current('无法获取企业信息', 'Could not load company information.'))
        } finally {
            setLoading(false)
        }
    }, [showError])

    useEffect(() => {
        if (id) {
            loadData(id)
        }
    }, [id, loadData])

    const filteredJobs = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase()
        return jobs.filter(job => {
            const matchKeyword = keyword.length === 0 || (
                (job.title || '').toLowerCase().includes(keyword) ||
                (job.location || '').toLowerCase().includes(keyword) ||
                (job.type || '').toLowerCase().includes(keyword)
            )
            const matchType = typeFilter === 'all' || ((job.type || '').toLowerCase() === typeFilter)
            const isRemote = job.isRemote === true || /remote/i.test(job.location || '')
            const matchRemote = remoteFilter === 'all' || (remoteFilter === 'remote' ? isRemote : !isRemote)
            return matchKeyword && matchType && matchRemote
        })
    }, [jobs, searchTerm, typeFilter, remoteFilter])

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
                <button type="button" onClick={handleBack} className="mt-5 min-h-11 text-sm font-bold text-[var(--hg-action-brand)]">{text('返回远程企业', 'Back to remote companies')}</button>
            </div>
        )
    }

    const updatedLabel = formatProfileDate(company.updatedAt)

    return (
        <div className="hg-company-detail-page min-h-screen">
            <div className="haigoo-shell hg-company-detail hg-company-profile">
                <button type="button" onClick={handleBack} className="hg-company-detail__back">
                    <ArrowLeft aria-hidden="true" />
                    {text('返回远程企业', 'Back to remote companies')}
                </button>

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
                            <dt>{text('公开在招', 'Public openings')}</dt>
                            <dd>{(() => {
                                const roles = [...new Set(jobs.map((job) => String((job as any).category || '').trim()).filter(Boolean))].slice(0, 3)
                                return roles.length > 0 ? roles.join(' / ') : text('暂未公开', 'Not currently listed')
                            })()}</dd>
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
                                <option value="remote">{text('仅远程', 'Remote only')}</option>
                                <option value="onsite">{text('非远程', 'On-site')}</option>
                            </select>
                        </label>
                    </div>

                    {filteredJobs.length > 0 ? (
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
                                <p>{text('试试缩短关键词，或调整一个筛选条件。', 'Try a shorter keyword or change a filter.')}</p>
                            </div>
                        </div>
                    )}
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
