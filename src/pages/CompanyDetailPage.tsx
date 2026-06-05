import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase, MapPin, Users, Calendar, Star, Info, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { trackingService } from '../services/tracking-service'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { getCompanyLogoSources } from '../utils/company-logo'

import { LocationTooltip } from '../components/LocationTooltip'

export default function CompanyDetailPage() {
    const { companyName } = useParams<{ companyName: string }>()
    const navigate = useNavigate()
    const { isAuthenticated, isMember } = useAuth()
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)

    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)
    const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
    const [currentJobIndex, setCurrentJobIndex] = useState(0)

    const decodedCompanyName = decodeURIComponent(companyName || '')
    const canShowCompanyDetails = true
    const companyLogoSources = useMemo(() => getCompanyLogoSources({
        companyId: companyInfo?.id,
        cachedLogoUrl: companyInfo?.cachedLogoUrl,
        originalLogoUrl: companyInfo?.logo,
        version: companyInfo?.updatedAt
    }), [companyInfo?.id, companyInfo?.cachedLogoUrl, companyInfo?.logo, companyInfo?.updatedAt])
    const companyLogoSourceKey = useMemo(() => companyLogoSources.join('|'), [companyLogoSources])
    const hiringLine = useMemo(() => {
        return jobs.length > 0 ? `${jobs.length} 个在招岗位` : '暂无在招岗位'
    }, [jobs.length])
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
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-orange-50/20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    const companyDecor = {
        bg: '/pic_lists/Home_pics/background04.webp',
    }
    const displayCompanyName = companyInfo?.name || decodedCompanyName || '企业详情'
    const companyDescription = companyInfo?.description || '暂无简介'
    const isRemoteAddress = Boolean(companyInfo?.address && (companyInfo.address.includes('远程') || companyInfo.address.toLowerCase().includes('remote')))

    return (
        <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f9fbff_46%,#fffdf8_100%)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[1080px] overflow-hidden">
                <img
                    src={companyDecor.bg}
                    alt=""
                    className="absolute inset-x-0 top-0 h-[900px] w-full object-cover object-[58%_44%] opacity-[0.32] saturate-[0.98]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.34)_0%,rgba(255,253,248,0.64)_48%,rgba(249,252,255,0.84)_78%,rgba(255,253,248,0.98)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,rgba(255,253,248,0)_0%,#fffdf8_86%)]" />
            </div>
            {/* Header */}
            <div className="relative z-10 pt-[82px] lg:pt-[90px]">
                {/* Back Button Section */}
                <div className="max-w-[1420px] mx-auto px-4 sm:px-6 lg:px-8 pb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#6f63f6] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">返回</span>
                    </button>
                </div>

                <div className="max-w-[1420px] mx-auto px-4 sm:px-6 lg:px-8 pb-7">
                    <div className="relative overflow-visible rounded-[30px] border border-[#eadfcf]/90 bg-[#fffdf8]/78 p-3 shadow-[0_26px_78px_-62px_rgba(139,101,54,0.34)] backdrop-blur-[2px] sm:p-4 lg:p-5">

                        <div className="relative">
                            <section className="relative min-h-[164px] overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,rgba(255,253,248,0.88)_0%,rgba(255,255,255,0.68)_48%,rgba(249,252,255,0.46)_100%)] p-4 sm:p-5 lg:min-h-[188px]">
                                <img
                                    src={companyDecor.bg}
                                    alt=""
                                    className="pointer-events-none absolute bottom-0 right-0 hidden h-[232px] w-[58%] object-cover object-[68%_62%] opacity-[0.58] lg:block"
                                />
                                <div className="pointer-events-none absolute bottom-0 right-0 hidden h-[232px] w-[72%] bg-[linear-gradient(90deg,rgba(255,253,248,0.9)_0%,rgba(255,253,248,0.46)_44%,rgba(255,253,248,0.2)_72%,rgba(255,253,248,0.56)_100%)] lg:block" />
                                <div className="relative z-10 flex items-start gap-4 lg:items-center">
                                    {canShowCompanyDetails && (companyLogoSrc ? (
                                        <div className="h-[74px] w-[74px] flex-shrink-0 overflow-hidden rounded-[22px] border border-[#dfeaf1] bg-white/94 p-2 shadow-[0_22px_48px_-32px_rgba(62,91,120,0.62)] sm:h-20 sm:w-20 lg:h-[88px] lg:w-[88px]">
                                            <img
                                                src={companyLogoSrc}
                                                alt={displayCompanyName}
                                                className="h-full w-full object-contain"
                                                onError={(e) => {
                                                    if (companyLogoIndex < companyLogoSources.length - 1) {
                                                        setCompanyLogoIndex((idx) => idx + 1)
                                                        return
                                                    }
                                                    const parent = e.currentTarget.parentElement!;
                                                    parent.classList.remove('bg-white', 'p-2', 'border', 'border-slate-100');
                                                    parent.classList.add('bg-gradient-to-br', 'from-indigo-500', 'to-indigo-600');
                                                    parent.innerHTML = `<span class="text-white font-bold text-2xl">${displayCompanyName.charAt(0)}</span>`;
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex h-[74px] w-[74px] flex-shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#8f8afe] to-[#6f63f6] shadow-[0_22px_48px_-32px_rgba(111,99,246,0.7)] sm:h-20 sm:w-20 lg:h-[88px] lg:w-[88px]">
                                            <span className="text-2xl font-bold text-white sm:text-3xl">
                                                {displayCompanyName.charAt(0)}
                                            </span>
                                        </div>
                                    ))}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex max-h-[96px] flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden">
                                            <h1 className="min-w-0 max-w-full truncate text-[30px] font-black leading-tight tracking-normal text-slate-950 sm:text-[38px]">
                                                {displayCompanyName}
                                            </h1>
                                            {companyInfo?.industry && (
                                                <div className="flex items-center gap-1.5 rounded-full border border-[#dfd8ff] bg-[#f2efff]/86 px-2.5 py-1 text-xs font-bold text-[#6f63f6] shadow-sm shadow-slate-200/30">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    <span>{companyInfo.industry}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 rounded-full border border-[#dfeaf1] bg-white/88 px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm shadow-slate-200/30">
                                                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                                                <span className="max-w-[260px] truncate">{hiringLine}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 rounded-full border border-[#dfeaf1] bg-white/88 px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm shadow-slate-200/30">
                                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                                <span>远程优先</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <section className="relative z-20 mt-3 overflow-visible rounded-[24px] border border-[#dfe8ef] bg-white/76 shadow-[0_22px_56px_-44px_rgba(62,91,120,0.26)] backdrop-blur-[2px]">
                            <div className="flex items-center gap-2 border-b border-[#edf2f6] bg-white/48 px-4 py-3">
                                <Info className="w-4 h-4 text-[#6f63f6]" />
                                <h2 className="text-sm font-black text-slate-900">企业简介与信息</h2>
                            </div>

                            <div className="p-4 sm:p-5">
                                <div className="relative overflow-hidden rounded-[22px] border border-[#e3edf4] bg-[linear-gradient(135deg,rgba(255,255,255,0.82)_0%,rgba(251,253,255,0.58)_100%)] p-4">
                                    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                        <Building2 className="h-4 w-4 text-[#6f63f6]" />
                                        <span>关于我们</span>
                                    </div>
                                    <div className="mt-3 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{companyDescription}</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {companyInfo?.website ? (
                                        <a
                                            href={companyInfo.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/90 p-3 shadow-sm transition-all hover:border-[#cfe0ea] hover:shadow-md"
                                        >
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                                                <Globe className="w-5 h-5 text-[#6f63f6]" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-0.5 text-xs font-medium text-slate-500">官方网站</div>
                                                <div className="truncate text-sm font-bold text-[#6f63f6]">点击访问</div>
                                            </div>
                                        </a>
                                    ) : (
                                        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/72 p-3">
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50">
                                                <Globe className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-0.5 text-xs font-medium text-slate-500">官方网站</div>
                                                <div className="truncate text-sm font-bold text-slate-400">待补充</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/90 p-3 shadow-sm">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                                            <Users className="w-5 h-5 text-[#49a982]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 text-xs font-medium text-slate-500">员工人数</div>
                                            <div className="truncate text-sm font-bold text-slate-900">{companyInfo?.employeeCount || '规模未知'}</div>
                                        </div>
                                    </div>

                                    <div className="relative flex min-w-0 items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/90 p-3 shadow-sm">
                                        <div
                                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 ${companyInfo?.address && !isRemoteAddress ? 'cursor-help hover:bg-sky-100' : ''}`}
                                            onMouseEnter={() => {
                                                if (companyInfo?.address && !isRemoteAddress) setShowLocationTooltip(true)
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (companyInfo?.address && !isRemoteAddress) setShowLocationTooltip(!showLocationTooltip)
                                            }}
                                        >
                                            <MapPin className="w-5 h-5 text-[#5d94c7]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 text-xs font-medium text-slate-500">总部地址</div>
                                            <div className="truncate text-sm font-bold text-slate-900" title={companyInfo?.address || '总部未知'}>
                                                {companyInfo?.address || '总部未知'}
                                            </div>
                                        </div>
                                        {companyInfo?.address && showLocationTooltip && !isRemoteAddress && (
                                            <div className="absolute left-0 top-full z-[80] mt-2">
                                                <LocationTooltip
                                                    location={companyInfo.address}
                                                    onClose={() => setShowLocationTooltip(false)}
                                                    floating
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/90 p-3 shadow-sm">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
                                            <Calendar className="w-5 h-5 text-[#c28932]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 text-xs font-medium text-slate-500">成立年份</div>
                                            <div className="truncate text-sm font-bold text-slate-900">{companyInfo?.foundedYear || '年份未知'}</div>
                                        </div>
                                    </div>

                                    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/90 p-3 shadow-sm">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50">
                                            <Star className="w-5 h-5 text-[#f2a43d]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-0.5 text-xs font-medium text-slate-500">企业评分</div>
                                            <div className="truncate text-sm font-bold text-slate-900">
                                                {companyInfo?.companyRating || '暂无评分'}
                                            </div>
                                            {companyInfo?.ratingSource && (
                                                <div className="truncate text-[10px] text-slate-400" title={`评分来源: ${companyInfo.ratingSource}`}>
                                                    来源: {companyInfo.ratingSource}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isMember && companyInfo?.hiringEmail && (
                                        <div
                                            onClick={() => {
                                                navigator.clipboard.writeText(companyInfo.hiringEmail || '')
                                                alert(`邮箱已复制: ${companyInfo.hiringEmail}`)
                                            }}
                                            className="group/email relative flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-[#e3edf4] bg-white/90 p-3 shadow-sm transition-all hover:border-[#cfe0ea]"
                                            title="点击复制完整邮箱"
                                        >
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 transition-colors group-hover/email:bg-emerald-100">
                                                <Mail className="w-5 h-5 text-[#49a982]" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-bold text-slate-900 group-hover/email:text-indigo-700">
                                                    {companyInfo.hiringEmail}
                                                </div>
                                                <div className="mt-0.5 truncate text-[10px] text-slate-400">
                                                    {companyInfo.emailType || '招聘邮箱'}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {companyInfo?.specialties && companyInfo.specialties.length > 0 && (
                                    <div className="mt-4 border-t border-[#edf2f6] pt-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="shrink-0 text-sm font-black text-slate-700">企业领域 / 专长</div>
                                            <div className="flex flex-wrap gap-2">
                                                {companyInfo.specialties.slice(0, 8).map((spec, idx) => (
                                                    <span key={idx} className="rounded-full border border-[#dfe8ef] bg-white/86 px-3 py-1 text-xs font-bold text-slate-600">
                                                        {spec}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                    {/* Job Listings - Full Width */}
                        <div className="relative z-0 mt-6 border-t border-[#e6edf3]/80 pt-5">
                            <div className="mb-4 flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                                在招岗位
                                <span className="rounded-full border border-[#dfe8ef] bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-600">
                                    {jobs.length}
                                </span>
                            </h2>
                            </div>

                        {jobs.length === 0 ? (
                                <div className="relative overflow-hidden rounded-[24px] border border-[#e3edf4] bg-white/84 py-14 text-center shadow-sm">
                                    <Briefcase className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                                    <div className="mb-2 text-lg font-bold text-slate-400">暂无在招岗位</div>
                                <p className="text-slate-500">该公司目前没有开放的职位</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:gap-7">
                                {jobs.map((job) => (
                                    <JobCardNew
                                        key={job.id}
                                        job={job}
                                        variant="list"
                                        onClick={() => handleJobClick(job)}
                                        isActive={selectedJob?.id === job.id}
                                        matchScore={job.displayMatchScore || job.matchScore || job.recommendationScore || undefined}
                                        showApplicationMethodIcons
                                        compactFeatured
                                        hideMemberBackdrop
                                    />
                                ))}
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Job Listings - Removed from here, moved to main column */}

            {/* Job Detail Modal */}
            {isJobDetailOpen && selectedJob && (
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
            )}
        </div>
    )
}
