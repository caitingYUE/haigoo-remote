import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase, MapPin, Users, Calendar, Star, Info, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { trackingService } from '../services/tracking-service'
import JobCardNew from '../components/JobCardNew'
import { SingleLineTags } from '../components/SingleLineTags'
import JobDetailModal from '../components/JobDetailModal'

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
            setJobs(jobsResponse.jobs)
        } catch (error) {
            console.error('Failed to load company data:', error)
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-orange-50/20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 shadow-sm pt-20 lg:pt-24">
                {/* Back Button Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 sm:pb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">返回</span>
                    </button>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6">
                    <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
                        {/* Left Column: Identity + Certified Info (Main) */}
                        <div className="flex-1 min-w-0">
                            <div className="mb-4 flex items-start gap-3 sm:gap-4">
                                {/* Company Logo */}
                                {canShowCompanyDetails && (companyInfo?.logo ? (
                                    <div className="h-16 w-16 sm:h-20 sm:w-20 bg-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 border border-slate-100 p-2 overflow-hidden">
                                        <img
                                            src={companyInfo.logo}
                                            alt={decodedCompanyName}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                const parent = e.currentTarget.parentElement!;
                                                parent.classList.remove('bg-white', 'p-2', 'border', 'border-slate-100');
                                                parent.classList.add('bg-gradient-to-br', 'from-indigo-500', 'to-indigo-600');
                                                parent.innerHTML = `<span class="text-white font-bold text-2xl">${decodedCompanyName.charAt(0)}</span>`;
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                        <span className="text-white font-bold text-xl sm:text-2xl">
                                            {decodedCompanyName.charAt(0)}
                                        </span>
                                    </div>
                                ))}

                                {/* Company Info Header */}
                                <div className="flex-1 min-w-0">
                                    <h1 className="mb-2 flex flex-wrap items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900">
                                        {companyInfo?.name || decodedCompanyName}
                                    </h1>

                                    <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-slate-600">
                                        {companyInfo?.industry && (
                                            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium shadow-sm shadow-slate-200/40">
                                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{companyInfo.industry}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium shadow-sm shadow-slate-200/40">
                                            <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                                            <span>{jobs.length} 个在招岗位</span>
                                        </div>
                                    </div>

                                    {companyInfo?.tags && companyInfo.tags.length > 0 && (
                                        <div className="">
                                            <SingleLineTags tags={companyInfo.tags} size="sm" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Always render Certified Info for trusted companies */}
                            {canShowCompanyDetails && companyInfo?.isTrusted && (
                                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_22px_58px_-48px_rgba(15,23,42,0.38)] relative">
                                    <div className="px-4 py-3.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50/70">
                                        <Building2 className="w-4 h-4 text-indigo-600" />
                                        <h2 className="text-sm font-bold text-slate-900">企业详细信息</h2>
                                    </div>

                                    <div className="relative p-4 sm:p-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-stretch lg:grid-cols-4">
                                            {/* Website - Row 1 */}
                                            {companyInfo.website && (
                                                <a
                                                    href={companyInfo.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group h-full"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors flex items-center justify-center flex-shrink-0">
                                                        <Globe className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs text-slate-500 mb-0.5 font-medium">官方网站</div>
                                                        <div className="font-bold text-indigo-600 text-sm truncate">点击访问</div>
                                                    </div>
                                                </a>
                                            )}

                                            {/* Employees - Row 1 */}
                                            {companyInfo.employeeCount && (
                                                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-colors h-full">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                                        <Users className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs text-slate-500 mb-0.5 font-medium">员工人数</div>
                                                        <div className="font-bold text-slate-900 text-sm">
                                                            {companyInfo.employeeCount}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Address - Row 1 */}
                                            {companyInfo.address && (
                                                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-colors relative h-full">
                                                    <div
                                                        className={`w-10 h-10 rounded-lg bg-indigo-50 transition-colors flex items-center justify-center flex-shrink-0 ${companyInfo.address.includes('远程') || companyInfo.address.toLowerCase().includes('remote')
                                                            ? ''
                                                            : 'cursor-help hover:bg-indigo-100'
                                                            }`}
                                                        onMouseEnter={() => {
                                                            if (!companyInfo.address!.includes('远程') && !companyInfo.address!.toLowerCase().includes('remote')) {
                                                                setShowLocationTooltip(true)
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!companyInfo.address!.includes('远程') && !companyInfo.address!.toLowerCase().includes('remote')) {
                                                                setShowLocationTooltip(!showLocationTooltip);
                                                            }
                                                        }}
                                                    >
                                                        <MapPin className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs text-slate-500 mb-0.5 font-medium">总部地址</div>
                                                        <div className="font-bold text-slate-900 text-sm truncate" title={companyInfo.address}>
                                                            {companyInfo.address}
                                                        </div>
                                                    </div>

                                                    {/* Location Tooltip */}
                                                    {showLocationTooltip && !companyInfo.address.includes('远程') && !companyInfo.address.toLowerCase().includes('remote') && (
                                                        <div className="absolute top-full left-0 mt-2 z-50">
                                                            <LocationTooltip
                                                                location={companyInfo.address}
                                                                onClose={() => setShowLocationTooltip(false)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Founded - Row 1 */}
                                            {companyInfo.foundedYear && (
                                                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-colors h-full">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                                        <Calendar className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs text-slate-500 mb-0.5 font-medium">成立年份</div>
                                                        <div className="font-bold text-slate-900 text-sm">
                                                            {companyInfo.foundedYear}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Rating - Row 2 */}
                                            {companyInfo.companyRating && (
                                                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-colors h-full">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                                        <Star className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-baseline gap-2 mb-0.5">
                                                            <div className="text-xs text-slate-500 font-medium">企业评分</div>
                                                            <div className="font-bold text-slate-900 text-sm">
                                                                {companyInfo.companyRating}
                                                            </div>
                                                        </div>
                                                        {companyInfo.ratingSource && (
                                                            <div className="text-[10px] text-slate-400 truncate" title={`评分来源: ${companyInfo.ratingSource}`}>
                                                                来源: {companyInfo.ratingSource}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Hiring Email - Row 2 - Flexible Width */}
                                            {isMember && companyInfo.hiringEmail && (
                                                <div
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(companyInfo.hiringEmail || '');
                                                        // Optional: You could add a toast notification here if available
                                                        alert(`邮箱已复制: ${companyInfo.hiringEmail}`);
                                                    }}
                                                    className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-colors h-full col-span-1 overflow-hidden group/email cursor-pointer relative"
                                                    title="点击复制完整邮箱"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover/email:bg-indigo-100 transition-colors">
                                                        <Mail className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-slate-900 text-sm truncate group-hover/email:text-indigo-700 transition-colors">
                                                            {companyInfo.hiringEmail}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                            {companyInfo.emailType === '招聘邮箱' ? '招聘邮箱' :
                                                                companyInfo.emailType === '通用邮箱' ? '通用邮箱' :
                                                                    companyInfo.emailType === '员工邮箱' ? '员工邮箱' :
                                                                        companyInfo.emailType === '高管邮箱' ? '高管邮箱' :
                                                                            // Fallback for legacy long forms
                                                                            companyInfo.emailType === '招聘专用邮箱' ? '招聘邮箱' :
                                                                                companyInfo.emailType === '通用支持邮箱' ? '通用邮箱' :
                                                                                    (companyInfo.emailType || '招聘邮箱')}
                                                        </div>
                                                    </div>
                                                    {/* Hover Hint */}
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/email:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded">
                                                        点击复制
                                                    </div>
                                                </div>
                                            )}

                                            {/* Specialties - Full Width */}
                                            {companyInfo.specialties && companyInfo.specialties.length > 0 && (
                                                <div className="col-span-full pt-4 mt-2 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                                                    <div className="text-xs text-slate-500 font-medium flex-shrink-0">企业领域/专长</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {companyInfo.specialties.map((spec, idx) => (
                                                            <span key={idx} className="px-2 py-0.5 bg-white text-slate-600 rounded border border-slate-200 text-xs font-medium">
                                                                {spec}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Description (Sidebar) */}
                        {canShowCompanyDetails && (
                            <div className="w-full lg:h-full">
                                <div className="flex h-full min-h-[260px] lg:min-h-[360px] lg:max-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_22px_58px_-48px_rgba(15,23,42,0.38)]">
                                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70">
                                        <Info className="w-4 h-4 text-slate-500" />
                                        <h2 className="font-bold text-slate-900 text-sm">关于我们</h2>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
                                        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {companyInfo?.description || '暂无简介'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Job Listings - Full Width */}
                    <div className="mt-6 pt-6 border-t border-slate-200/60">
                        <div className="mb-5 sm:mb-6 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                在招岗位
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                    {jobs.length}
                                </span>
                            </h2>
                        </div>

                        {jobs.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
                                <div className="text-slate-400 text-lg mb-2">暂无在招岗位</div>
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
                                        showApplicationMethodIcons
                                        compactFeatured
                                    />
                                ))}
                            </div>
                        )}
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
