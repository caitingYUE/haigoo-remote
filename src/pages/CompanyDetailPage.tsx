import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Briefcase, Calendar, Clock3, Globe, Lock, Mail, MapPin, Star, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { trackingService } from '../services/tracking-service'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { getCompanyLogoSources } from '../utils/company-logo'

import { LocationTooltip } from '../components/LocationTooltip'
import { useReturnNavigation } from '../hooks/useReturnNavigation'
import { useLanguage } from '../contexts/LanguageContext'

const formatCompanyDate = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

export default function CompanyDetailPage() {
    const { companyName } = useParams<{ companyName: string }>()
    const navigate = useNavigate()
    const location = useLocation()
    const handleBack = useReturnNavigation('/companies')
    const { isAuthenticated, isMember } = useAuth()
    const { text } = useLanguage()
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)

    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)
    const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
    const [currentJobIndex, setCurrentJobIndex] = useState(0)
    const autoOpenedJobIdRef = useRef('')

    const decodedCompanyName = decodeURIComponent(companyName || '')
    const canShowCompanyDetails = isAuthenticated
    const companyLogoSources = useMemo(() => getCompanyLogoSources({
        companyId: companyInfo?.id,
        cachedLogoUrl: companyInfo?.cachedLogoUrl,
        originalLogoUrl: companyInfo?.logo,
        version: companyInfo?.updatedAt
    }), [companyInfo?.id, companyInfo?.cachedLogoUrl, companyInfo?.logo, companyInfo?.updatedAt])
    const companyLogoSourceKey = useMemo(() => companyLogoSources.join('|'), [companyLogoSources])
    const hiringLine = useMemo(() => {
        const roles = [...new Set(jobs.map((job) => String((job as any).category || '').trim()).filter(Boolean))].slice(0, 3)
        return roles.length > 0
            ? text(`在招 ${roles.join(' / ')}`, `Hiring ${roles.join(' / ')}`)
            : text('暂未公开', 'Not currently listed')
    }, [jobs, text])
    const [companyLogoIndex, setCompanyLogoIndex] = useState(0)
    const companyLogoSrc = companyLogoSources[companyLogoIndex] || ''

    useEffect(() => {
        setCompanyLogoIndex(0)
    }, [companyLogoSourceKey])

    useEffect(() => {
        loadCompanyData()
        loadSavedJobs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyName])

    useEffect(() => {
        const requestedJobId = new URLSearchParams(location.search).get('jobId') || ''
        if (!requestedJobId || autoOpenedJobIdRef.current === requestedJobId || jobs.length === 0) return
        const index = jobs.findIndex((job) => job.id === requestedJobId)
        if (index < 0) return
        autoOpenedJobIdRef.current = requestedJobId
        setSelectedJob(jobs[index])
        setCurrentJobIndex(index)
        setIsJobDetailOpen(true)
    }, [jobs, location.search])

    useEffect(() => {
        if (!isAuthenticated || !companyInfo?.name || !companyInfo?.isTrusted) return
        trackingService.featureExposure('company_info', {
            page_key: 'company_detail',
            module: 'company_detail',
            source_key: 'company_detail',
            entity_type: 'company',
            entity_id: companyInfo.name,
            company_name: companyInfo.name,
        })
    }, [companyInfo?.name, companyInfo?.isTrusted, isAuthenticated])

    const loadCompanyData = async () => {
        setLoading(true)
        try {
            // P0 Optimization: Run requests sequentially to prioritize ID-based job fetching
            // 1. Fetch trusted company info first to get ID
            // Use 'name' parameter for precise search if available in backend
            let companiesResponse = await trustedCompaniesService.getAllCompanies({ name: decodedCompanyName });

            let companies = Array.isArray(companiesResponse)
                ? companiesResponse
                : ((companiesResponse as any)?.companies || []);

            const norm = decodedCompanyName.trim().toLowerCase()
            let trusted = companies.find((c: TrustedCompany) => c.name?.trim().toLowerCase() === norm) ||
                companies.find((c: TrustedCompany) => c.name && c.name.toLowerCase().includes(norm))

            // Fallback: If exact name match fails (e.g. company was renamed from "Macro" -> "Makro"),
            // try fuzzy search using the search parameter which uses ILIKE matching
            if (!trusted && decodedCompanyName) {
                console.log(`[CompanyDetail] Exact name match failed for "${decodedCompanyName}", trying fuzzy search...`);
                try {
                    const fuzzyResponse = await trustedCompaniesService.getAllCompanies({ search: decodedCompanyName });
                    const fuzzyCompanies = Array.isArray(fuzzyResponse)
                        ? fuzzyResponse
                        : ((fuzzyResponse as any)?.companies || []);
                    // Pick the best match: exact > includes > first available
                    trusted = fuzzyCompanies.find((c: TrustedCompany) => c.name?.trim().toLowerCase() === norm) ||
                        fuzzyCompanies.find((c: TrustedCompany) => c.name && c.name.toLowerCase().includes(norm)) ||
                        fuzzyCompanies[0]; // last resort: take first result
                    if (trusted) {
                        console.log(`[CompanyDetail] Fuzzy match found: "${trusted.name}"`);
                        companies = fuzzyCompanies;
                    }
                } catch (e) {
                    console.error('[CompanyDetail] Fuzzy search failed:', e);
                }
            }

            let companyId = null;
            if (trusted) {
                // Always fetch full details by ID to ensure all fields (coverImage, etc.) are present
                let fullTrusted = trusted;
                if (trusted.id) {
                    try {
                        const details = await trustedCompaniesService.getCompanyById(trusted.id);
                        if (details) {
                            fullTrusted = details;
                        }
                    } catch (e) {
                        console.error('Failed to fetch full company details:', e);
                    }
                }

                setCompanyInfo({ ...fullTrusted, isTrusted: true })
                companyId = fullTrusted.id;
            }

            // 2. Fetch jobs using company ID if available (much faster), otherwise fallback to name
            const jobsQuery = companyId
                ? { companyId, isApproved: true, skipAggregations: true }
                : { company: decodedCompanyName, isApproved: true, skipAggregations: true };

            const jobsResponse = await processedJobsService.getProcessedJobs(1, 100, jobsQuery);
            setJobs(jobsResponse.jobs || [])
        } catch (error) {
            console.error('Failed to load company data:', error)
            setJobs([])
        } finally {
            setLoading(false)
        }
    }

    const loadSavedJobs = async () => {
        try {
            const token = localStorage.getItem('haigoo_auth_token')
            if (!token) return

            const resp = await fetch('/api/user-profile?action=favorites', {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (resp.ok) {
                const data = await resp.json()
                const ids: string[] = (data?.favorites || []).map((f: any) => f.id)
                setSavedJobs(new Set(ids))
            }
        } catch (error) {
            console.error('Failed to load saved jobs:', error)
        }
    }

    const toggleSaveJob = async (jobId: string, job?: Job) => {
        const token = localStorage.getItem('haigoo_auth_token')
        if (!token) {
            navigate('/login')
            return
        }

        const isSaved = savedJobs.has(jobId)
        trackingService.track('click_save_job', {
            page_key: 'company_detail',
            module: 'company_detail_jobs',
            feature_key: 'favorite',
            source_key: 'company_detail',
            entity_type: 'job',
            entity_id: jobId,
            job_id: jobId,
            company: decodedCompanyName,
            action: isSaved ? 'remove' : 'add',
        })
        setSavedJobs(prev => {
            const s = new Set(prev)
            isSaved ? s.delete(jobId) : s.add(jobId)
            return s
        })

        try {
            await fetch(`/api/user-profile?action=${isSaved ? 'favorites_remove' : 'favorites_add'}&jobId=${encodeURIComponent(jobId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId, job })
            })
        } catch (error) {
            // Revert on error
            setSavedJobs(prev => {
                const s = new Set(prev)
                isSaved ? s.add(jobId) : s.delete(jobId)
                return s
            })
        }
    }

    const handleJobClick = (job: Job) => {
        const index = jobs.findIndex(j => j.id === job.id)
        setSelectedJob(job)
        setCurrentJobIndex(index !== -1 ? index : 0)
        setIsJobDetailOpen(true)
    }

    const handleNavigateJob = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev'
            ? Math.max(0, currentJobIndex - 1)
            : Math.min(jobs.length - 1, currentJobIndex + 1)
        setCurrentJobIndex(newIndex)
        setSelectedJob(jobs[newIndex])
    }

    if (loading) {
        return (
            <div className="hg-company-detail-page min-h-screen pt-28">
                <div className="haigoo-shell" aria-label={text('正在加载企业资料', 'Loading company profile')} aria-busy="true">
                    <div className="border-t-2 border-[#101829] py-8">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#52738c]">COMPANY PROFILE</p>
                        <div className="mt-4 h-10 w-64 animate-pulse bg-[#dfe7e8]" />
                        <div className="mt-5 h-4 w-full max-w-2xl animate-pulse bg-[#e6e1d8]" />
                        <div className="mt-2 h-4 w-2/3 max-w-xl animate-pulse bg-[#edf1ee]" />
                    </div>
                    <div className="grid gap-6 border-y border-[#d9d3c9] py-8 md:grid-cols-3">
                        {[0, 1, 2].map(item => <div key={item} className="h-24 animate-pulse bg-[#edf4f8]" />)}
                    </div>
                </div>
            </div>
        )
    }

    const displayCompanyName = companyInfo?.name || decodedCompanyName || text('企业详情', 'Company details')
    const companyDescription = companyInfo?.description || text('企业介绍正在整理中。', 'The company profile is being prepared.')
    const isRemoteAddress = Boolean(companyInfo?.address && (companyInfo.address.includes('远程') || companyInfo.address.toLowerCase().includes('remote')))
    const companyTags = Array.isArray(companyInfo?.tags)
        ? companyInfo.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : []
    const companySpecialties = Array.isArray(companyInfo?.specialties)
        ? companyInfo.specialties.map((specialty) => String(specialty).trim()).filter(Boolean)
        : []
    const updatedLabel = formatCompanyDate(companyInfo?.updatedAt)
    const officialSource = companyInfo?.careersPage || companyInfo?.website || ''
    const officialSourceLabel = companyInfo?.careersPage
        ? text('官方 Careers 页面', 'Official Careers page')
        : text('官方网站', 'Official website')
    const loginRedirect = '/login?redirect=' + encodeURIComponent(location.pathname + location.search)
    const LockedField = ({ width = '70%' }: { width?: string }) => (
        <span className="hg-company-detail__locked-field" style={{ width }}>
            <span className="sr-only">{text('登录后可见', 'Log in to view')}</span>
        </span>
    )

    return (
        <div className="hg-company-detail-page min-h-screen">
            <div className="haigoo-shell hg-company-detail">
                <button type="button" onClick={handleBack} className="hg-company-detail__back">
                    <ArrowLeft aria-hidden="true" />
                    {text('返回远程企业', 'Back to remote companies')}
                </button>

                <header className="hg-company-detail__hero">
                    <div className="hg-company-detail__identity">
                        <div className="hg-company-detail__logo">
                            {companyLogoSrc ? (
                                <img
                                    src={companyLogoSrc}
                                    alt={displayCompanyName}
                                    onError={() => {
                                        if (companyLogoIndex < companyLogoSources.length - 1) {
                                            setCompanyLogoIndex((index) => index + 1)
                                        } else {
                                            setCompanyLogoIndex(companyLogoSources.length)
                                        }
                                    }}
                                />
                            ) : (
                                <span aria-hidden="true">{displayCompanyName.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <p className="haigoo-editorial-label">{text('COMPANY PROFILE · 企业资料', 'COMPANY PROFILE')}</p>
                            <h1>{displayCompanyName}</h1>
                            <p className="hg-company-detail__lead">
                                {text('从公开资料认识这家公司，再回到官方页面确认最新机会。', 'Use public information to understand the company, then confirm the latest openings at the source.')}
                            </p>
                        </div>
                    </div>

                    <dl className="hg-company-detail__hero-facts">
                        <div>
                            <dt>{text('行业', 'Industry')}</dt>
                            <dd>{canShowCompanyDetails ? (companyInfo?.industry || text('待补充', 'Not available')) : <LockedField width="58%" />}</dd>
                        </div>
                        <div>
                            <dt>{text('最近整理', 'Last updated')}</dt>
                            <dd>{updatedLabel || text('待补充', 'Not available')}</dd>
                        </div>
                        <div>
                            <dt>{text('岗位方向', 'Role categories')}</dt>
                            <dd>{hiringLine}</dd>
                        </div>
                    </dl>
                </header>

                {(companyTags.length > 0 || companySpecialties.length > 0) ? (
                    <div className="hg-company-detail__taxonomy">
                        <span>{text('关注方向', 'Focus areas')}</span>
                        <div>
                            {[...companyTags, ...companySpecialties].slice(0, 10).map((item, index) => (
                                <span key={item + index}>
                                    {canShowCompanyDetails ? item : <LockedField width={index % 2 === 0 ? '5.5rem' : '4rem'} />}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                <section className="hg-company-detail__overview">
                    <article className="hg-company-detail__about">
                        <p className="haigoo-editorial-label">{text('ABOUT · 关于企业', 'ABOUT')}</p>
                        <h2>{text('它们在做什么', 'What the company does')}</h2>
                        {canShowCompanyDetails ? (
                            <p className="hg-company-detail__description">{companyDescription}</p>
                        ) : (
                            <div className="hg-company-detail__locked-copy">
                                <LockedField width="94%" />
                                <LockedField width="88%" />
                                <LockedField width="72%" />
                                <div>
                                    <Lock aria-hidden="true" />
                                    <span>{text('登录后查看企业简介与公开资料。', 'Log in to view the company overview and public profile.')}</span>
                                    <button type="button" onClick={() => navigate(loginRedirect)}>
                                        {text('登录查看', 'Log in to view')}
                                        <ArrowUpRight aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </article>

                    <aside className="hg-company-detail__facts" aria-labelledby="company-facts-title">
                        <div className="hg-company-detail__facts-heading">
                            <p className="haigoo-editorial-label">{text('PUBLIC FACTS · 公开资料', 'PUBLIC FACTS')}</p>
                            <h2 id="company-facts-title">{text('企业资料', 'Company facts')}</h2>
                        </div>

                        <div className="hg-company-detail__fact-row">
                            <Globe aria-hidden="true" />
                            <span>{officialSourceLabel}</span>
                            {canShowCompanyDetails && officialSource ? (
                                <a href={officialSource} target="_blank" rel="noopener noreferrer">
                                    {text('打开来源', 'Open source')}
                                    <ArrowUpRight aria-hidden="true" />
                                </a>
                            ) : canShowCompanyDetails ? (
                                <strong>{text('待补充', 'Not available')}</strong>
                            ) : (
                                <LockedField width="5.5rem" />
                            )}
                        </div>

                        <div className="hg-company-detail__fact-row">
                            <Users aria-hidden="true" />
                            <span>{text('员工人数', 'Company size')}</span>
                            <strong>{canShowCompanyDetails ? (companyInfo?.employeeCount || text('待补充', 'Not available')) : <LockedField width="5.5rem" />}</strong>
                        </div>

                        <div className="hg-company-detail__fact-row hg-company-detail__fact-row--location">
                            <MapPin aria-hidden="true" />
                            <span>{text('总部地址', 'Headquarters')}</span>
                            <button
                                type="button"
                                disabled={!canShowCompanyDetails || !companyInfo?.address}
                                onMouseEnter={() => {
                                    if (companyInfo?.address && !isRemoteAddress) setShowLocationTooltip(true)
                                }}
                                onMouseLeave={() => setShowLocationTooltip(false)}
                                onClick={() => {
                                    if (companyInfo?.address && !isRemoteAddress) setShowLocationTooltip((value) => !value)
                                }}
                            >
                                {canShowCompanyDetails ? (companyInfo?.address || text('待补充', 'Not available')) : <LockedField width="6.5rem" />}
                            </button>
                            {canShowCompanyDetails && companyInfo?.address && showLocationTooltip && !isRemoteAddress ? (
                                <div className="hg-company-detail__location-tooltip">
                                    <LocationTooltip
                                        location={companyInfo.address}
                                        onClose={() => setShowLocationTooltip(false)}
                                        floating
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="hg-company-detail__fact-row">
                            <Calendar aria-hidden="true" />
                            <span>{text('成立年份', 'Founded')}</span>
                            <strong>{canShowCompanyDetails ? (companyInfo?.foundedYear || text('待补充', 'Not available')) : <LockedField width="4.5rem" />}</strong>
                        </div>

                        <div className="hg-company-detail__fact-row">
                            <Star aria-hidden="true" />
                            <span>{text('公开评分', 'Public rating')}</span>
                            <strong>
                                {canShowCompanyDetails ? (companyInfo?.companyRating || text('暂无公开评分', 'No public rating')) : <LockedField width="4.5rem" />}
                                {canShowCompanyDetails && companyInfo?.ratingSource ? (
                                    <small>{text('来源', 'Source')}: {companyInfo.ratingSource}</small>
                                ) : null}
                            </strong>
                        </div>

                        {isMember && companyInfo?.hiringEmail ? (
                            <button
                                type="button"
                                className="hg-company-detail__fact-row hg-company-detail__member-email"
                                onClick={() => {
                                    navigator.clipboard.writeText(companyInfo.hiringEmail || '')
                                    alert(text('招聘邮箱已复制', 'Hiring email copied'))
                                }}
                            >
                                <Mail aria-hidden="true" />
                                <span>{companyInfo.emailType || text('会员招聘邮箱', 'Member hiring email')}</span>
                                <strong>{companyInfo.hiringEmail}</strong>
                            </button>
                        ) : null}

                        <p className="hg-company-detail__source-note">
                            <Clock3 aria-hidden="true" />
                            {text('公开信息可能随时变化，请以企业官方页面的最新信息为准。', 'Public information can change. Confirm the latest details on the official company page.')}
                        </p>
                    </aside>
                </section>

                <section className="hg-company-detail__jobs" aria-labelledby="company-open-roles-title">
                    <header>
                        <div>
                            <p className="haigoo-editorial-label">{text('OPEN ROLES · 公开岗位', 'OPEN ROLES')}</p>
                            <h2 id="company-open-roles-title">{text('最近公开的岗位', 'Latest public openings')}</h2>
                        </div>
                    </header>

                    {jobs.length === 0 ? (
                        <div className="hg-company-detail__jobs-empty">
                            <Briefcase aria-hidden="true" />
                            <div>
                                <h3>{text('目前没有公开在招岗位', 'No public openings right now')}</h3>
                                <p>{text('我们会继续关注公开渠道的岗位状态；也可以稍后回到企业官网查看。', 'We will keep monitoring public sources. You can also check the company site again later.')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="hg-company-detail__job-list">
                            {jobs.map((job) => (
                                <JobCardNew
                                    key={job.id}
                                    job={job}
                                    variant="list"
                                    onClick={() => handleJobClick(job)}
                                    isActive={selectedJob?.id === job.id}
                                    showApplicationMethodIcons
                                    compactFeatured
                                    hideMemberBackdrop
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {isJobDetailOpen && selectedJob ? (
                <JobDetailModal
                    job={selectedJob}
                    isOpen={isJobDetailOpen}
                    onClose={() => setIsJobDetailOpen(false)}
                    onSave={() => selectedJob && toggleSaveJob(selectedJob.id, selectedJob)}
                    isSaved={savedJobs.has(selectedJob.id)}
                    jobs={jobs}
                    currentJobIndex={currentJobIndex}
                    onNavigateJob={handleNavigateJob}
                    variant="center"
                />
            ) : null}
        </div>
    )
}
