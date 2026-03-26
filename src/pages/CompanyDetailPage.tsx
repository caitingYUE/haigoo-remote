import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase, MapPin, Users, Calendar, Star, Shield, Crown, Info, Mail } from 'lucide-react'
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
    const { user, isAuthenticated, isMember, membershipCapabilities } = useAuth()
    const canAccessTrustedCompaniesPage = membershipCapabilities.canAccessTrustedCompaniesPage
    const canUseFreeCompanyInfoFlow = !canAccessTrustedCompaniesPage
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)

    const FREE_FEATURE_LIMIT = 3
    const [companyInfoUsageCount, setCompanyInfoUsageCount] = useState(0)
    const [unlockedCompanies, setUnlockedCompanies] = useState<string[]>([])

    // Initialize usage stats for free users
    useEffect(() => {
        if (isAuthenticated && canUseFreeCompanyInfoFlow) {
            const token = localStorage.getItem('haigoo_auth_token')
            if (!token) return;
            fetch('/api/users?resource=free-usage&type=company-info', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    setCompanyInfoUsageCount(data.usage);
                    setUnlockedCompanies(data.unlocked_companies || []);
                }
            }).catch(err => console.error('[free-usage] Failed to load company info quota:', err));
        } else {
            setCompanyInfoUsageCount(0);
            setUnlockedCompanies([]);
        }
    }, [canUseFreeCompanyInfoFlow, isAuthenticated]);


    // DEBUG: Log user and membership status (removed for privacy)
    useEffect(() => {
        // if (user) {
        //     console.log('[CompanyDetail] User ID:', user.user_id);
        // }
    }, [user]);

    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)
    const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
    const [currentJobIndex, setCurrentJobIndex] = useState(0)

    const decodedCompanyName = decodeURIComponent(companyName || '')

    useEffect(() => {
        loadCompanyData()
        loadSavedJobs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyName])

    useEffect(() => {
        if (!companyInfo?.name || !companyInfo?.isTrusted) return
        trackingService.featureExposure('company_info', {
            page_key: 'company_detail',
            module: 'company_detail',
            source_key: 'company_detail',
            entity_type: 'company',
            entity_id: companyInfo.name,
            company_name: companyInfo.name,
        })
    }, [companyInfo?.name, companyInfo?.isTrusted])

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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">返回</span>
                    </button>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        {/* Left Column: Identity + Certified Info (Main) */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-4 mb-4">
                                {/* Company Logo */}
                                {companyInfo?.logo ? (
                                    <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 border border-slate-100 p-2 overflow-hidden">
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
                                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                        <span className="text-white font-bold text-2xl">
                                            {decodedCompanyName.charAt(0)}
                                        </span>
                                    </div>
                                )}

                                {/* Company Info Header */}
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2 flex-wrap">
                                        {companyInfo?.name || decodedCompanyName}
                                        {companyInfo?.isTrusted && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold align-middle">
                                                <Shield className="w-3 h-3" />
                                                已认证
                                            </span>
                                        )}
                                    </h1>

                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-2">
                                        {companyInfo?.industry && (
                                            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                                <Building2 className="w-3.5 h-3.5" />
                                                <span>{companyInfo.industry}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                            <Briefcase className="w-3.5 h-3.5" />
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
                            {companyInfo?.isTrusted && (
                                <div className="mt-4 bg-slate-50/50 rounded-xl border border-slate-200/60 relative">
                                    {canAccessTrustedCompaniesPage && (
                                        <div className="absolute top-0 right-0 z-10">
                                            <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl shadow-sm flex items-center gap-1">
                                                <Crown className="w-3 h-3" />
                                                会员专属权益已生效
                                            </div>
                                        </div>
                                    )}
                                    <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100">
                                        <Shield className="w-4 h-4 text-indigo-600" />
                                        <h2 className="text-sm font-bold text-slate-900">企业认证信息</h2>
                                        {!canAccessTrustedCompaniesPage && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium border border-amber-200 ml-1">
                                                会员专属
                                            </span>
                                        )}
                                    </div>

                                    {(() => {
                                        const isUnlocked = canAccessTrustedCompaniesPage || (canUseFreeCompanyInfoFlow && companyInfo?.name && unlockedCompanies.includes(companyInfo.name));
                                        
                                        const handleUnlock = async (e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            trackingService.featureClick('company_info', {
                                                page_key: 'company_detail',
                                                module: 'company_detail',
                                                source_key: 'company_detail',
                                                entity_type: 'company',
                                                entity_id: companyInfo?.name,
                                                company_name: companyInfo?.name,
                                            });
                                            const token = localStorage.getItem('haigoo_auth_token');
                                            if (!token) {
                                                navigate('/login');
                                                return;
                                            }
                                            try {
                                                const res = await fetch('/api/users?resource=free-usage&type=company-info', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${token}`
                                                    },
                                                    body: JSON.stringify({
                                                        companyName: companyInfo?.name,
                                                        page_key: 'company_detail',
                                                        source_key: 'company_detail',
                                                        entity_type: 'company',
                                                        entity_id: companyInfo?.name,
                                                        flow_id: `company_info_${companyInfo?.name || decodedCompanyName}`
                                                    })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    setUnlockedCompanies(data.unlocked_companies || []);
                                                    setCompanyInfoUsageCount(data.usage);
                                                } else {
                                                    alert(data.error || '解锁失败');
                                                }
                                            } catch (err) {
                                                console.error('解锁失败', err);
                                            }
                                        };

                                        return isUnlocked ? (
                                            <div className="p-4 relative">
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                                                    {/* Website - Row 1 */}
                                                    {companyInfo.website && (
                                                        <a
                                                            href={companyInfo.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group h-full"
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
                                                        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors h-full">
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
                                                        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors relative h-full">
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
                                                        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors h-full">
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
                                                        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors h-full">
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
                                                    {companyInfo.hiringEmail && (
                                                        <div
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(companyInfo.hiringEmail || '');
                                                                // Optional: You could add a toast notification here if available
                                                                alert(`邮箱已复制: ${companyInfo.hiringEmail}`);
                                                            }}
                                                            className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors h-full col-span-1 overflow-hidden group/email cursor-pointer relative"
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
                                                        <div className="col-span-full pt-4 mt-2 border-t border-slate-100 flex items-center gap-4">
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
                                        ) : (
                                            /* Locked State - Synchronized with JobDetailPanel */
                                            <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/30 min-h-[160px] mx-4 mb-4">
                                                {/* Simulated Content Layer (Blurred) */}
                                                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 filter blur-[6px] opacity-40 select-none pointer-events-none">
                                                    <div className="h-14 bg-white rounded-lg border border-slate-100"></div>
                                                    <div className="h-14 bg-white rounded-lg border border-slate-100"></div>
                                                    <div className="h-14 bg-white rounded-lg border border-slate-100"></div>
                                                    <div className="h-14 bg-white rounded-lg border border-slate-100"></div>
                                                </div>

                                                {/* Unlock Modal Overlay */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-50/90 via-slate-50/40 to-transparent flex flex-col items-center justify-center">
                                                    <div className="text-center transform transition-transform hover:scale-[1.02] p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white shadow-sm max-w-sm">
                                                        {!isAuthenticated ? (
                                                            <>
                                                                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-slate-100">
                                                                    <Shield className="w-5 h-5 text-slate-400" />
                                                                </div>
                                                                <h4 className="text-sm font-bold text-slate-900 mb-1">企业认证信息仅会员可见</h4>
                                                                <p className="text-[11px] text-slate-500 mb-3 leading-tight px-4">
                                                                    登录后可免费体验，包含认证招聘邮箱、评分及总部地址。
                                                                </p>
                                                                <button
                                                                    onClick={() => {
                                                                        trackingService.track('feature_click', {
                                                                            page_key: 'company_detail',
                                                                            module: 'company_detail',
                                                                            feature_key: 'company_info',
                                                                            source_key: 'company_detail_login_gate',
                                                                            entity_type: 'company',
                                                                            entity_id: companyInfo?.name || decodedCompanyName,
                                                                            action: 'login_gate'
                                                                        })
                                                                        navigate('/login')
                                                                    }}
                                                                    className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center justify-center gap-1.5 mx-auto"
                                                                >
                                                                    登录免费体验
                                                                </button>
                                                            </>
                                                        ) : !canUseFreeCompanyInfoFlow ? (
                                                            <>
                                                                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100">
                                                                    <Crown className="w-5 h-5 text-emerald-600" />
                                                                </div>
                                                                <h4 className="text-sm font-bold text-slate-900 mb-1">精选企业名单仅正式会员开放</h4>
                                                                <p className="text-[11px] text-slate-500 mb-3 leading-tight px-4">
                                                                    当前体验会员已解锁远程岗位页全部核心权益，如需查看精选企业名单，请升级季度或年度会员。
                                                                </p>
                                                                <button
                                                                    onClick={() => {
                                                                        trackingService.track('upgrade_cta_click', {
                                                                            page_key: 'company_detail',
                                                                            module: 'company_detail',
                                                                            feature_key: 'company_info',
                                                                            source_key: 'company_detail_member_upgrade',
                                                                            entity_type: 'company',
                                                                            entity_id: companyInfo?.name || decodedCompanyName,
                                                                        })
                                                                        navigate('/membership')
                                                                    }}
                                                                    className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center justify-center gap-1.5 mx-auto"
                                                                >
                                                                    升级正式会员
                                                                </button>
                                                            </>
                                                        ) : companyInfoUsageCount < FREE_FEATURE_LIMIT ? (
                                                            <>
                                                                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                                                                    <Crown className="w-5 h-5 text-indigo-600" />
                                                                </div>
                                                                <h4 className="text-sm font-bold text-slate-900 mb-1">解锁企业认证深度信息</h4>
                                                                <p className="text-[11px] text-slate-500 mb-3 leading-tight px-4">
                                                                    包含认证招聘邮箱、评分详情及准确总部地址，助您精准触达。
                                                                </p>
                                                                <button
                                                                    onClick={handleUnlock}
                                                                    className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-sm transition-all flex items-center justify-center gap-1.5 mx-auto"
                                                                >
                                                                    <Crown className="w-3.5 h-3.5" />
                                                                    免费解锁 (剩 {FREE_FEATURE_LIMIT - companyInfoUsageCount} 次)
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-slate-100">
                                                                    <Shield className="w-5 h-5 text-slate-400" />
                                                                </div>
                                                                <h4 className="text-sm font-bold text-slate-900 mb-1">体验次数已达上限</h4>
                                                                <p className="text-[11px] text-slate-500 mb-3 leading-tight px-4">
                                                                    升级会员即可无限次查看所有企业的深度核验信息。
                                                                </p>
                                                                <button
                                                                    onClick={() => {
                                                                        trackingService.track('upgrade_cta_click', {
                                                                            page_key: 'company_detail',
                                                                            module: 'company_detail',
                                                                            feature_key: 'company_info',
                                                                            source_key: 'company_detail_limit_reached',
                                                                            entity_type: 'company',
                                                                            entity_id: companyInfo?.name || decodedCompanyName,
                                                                        })
                                                                        navigate('/membership')
                                                                    }}
                                                                    className="py-2 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-sm transition-all mx-auto"
                                                                >
                                                                    查看会员权益
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Description (Sidebar) */}
                        <div className="lg:w-80 flex-shrink-0">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                    <Info className="w-4 h-4 text-slate-500" />
                                    <h2 className="font-bold text-slate-900 text-sm">关于我们</h2>
                                </div>
                                <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {companyInfo?.description || '暂无简介'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Job Listings - Full Width */}
                    <div className="mt-6 pt-6 border-t border-slate-200/60">
                        <div className="flex items-center justify-between mb-6">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {jobs.map((job) => (
                                    <JobCardNew
                                        key={job.id}
                                        job={job}
                                        onClick={handleJobClick}
                                        className="h-[397px] w-full"
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
