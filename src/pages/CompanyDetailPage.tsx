import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Globe, Building2, Briefcase, ExternalLink, MapPin, Users, Calendar, CheckCircle, Linkedin, Star, Shield, Crown, Info, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import JobCardNew from '../components/JobCardNew'
import { SingleLineTags } from '../components/SingleLineTags'
import JobDetailModal from '../components/JobDetailModal'

import { LocationTooltip } from '../components/LocationTooltip'

export default function CompanyDetailPage() {
    const { companyName } = useParams<{ companyName: string }>()
    const navigate = useNavigate()
    const { user, isMember } = useAuth()
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)


    // DEBUG: Log user and membership status (removed for privacy)
    useEffect(() => {
        // if (user) {
        //     console.log('[CompanyDetail] User ID:', user.user_id);
        // }
    }, [user, isMember]);

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

    const loadCompanyData = async () => {
        setLoading(true)
        try {
            // P0 Optimization: Run requests sequentially to prioritize ID-based job fetching
            // 1. Fetch trusted company info first to get ID
            // Use 'name' parameter for precise search if available in backend
            const companiesResponse = await trustedCompaniesService.getAllCompanies({ name: decodedCompanyName });
            
            const companies = Array.isArray(companiesResponse) 
                ? companiesResponse 
                : ((companiesResponse as any)?.companies || []);

            const norm = decodedCompanyName.trim().toLowerCase()
            const trusted = companies.find((c: TrustedCompany) => c.name?.trim().toLowerCase() === norm) ||
                companies.find((c: TrustedCompany) => c.name && c.name.toLowerCase().includes(norm))

            let companyId = null;
            if (trusted) {
                setCompanyInfo({ ...trusted, isTrusted: true })
                companyId = trusted.id;
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
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">返回</span>
                    </button>

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
                                    {isMember && (
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
                                        {!isMember && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium border border-amber-200 ml-1">
                                                会员专属
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-4 relative">
                                        {isMember ? (
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                {/* Website - New Position */}
                                                {companyInfo.website && (
                                                    <a
                                                        href={companyInfo.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
                                                    >
                                                        <div className="p-1.5 bg-indigo-50 rounded-md group-hover:bg-indigo-100 transition-colors">
                                                            <Globe className="w-4 h-4 text-indigo-600" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] text-slate-500 mb-0.5">官方网站</div>
                                                            <div className="font-medium text-indigo-600 text-sm truncate">点击访问</div>
                                                        </div>
                                                    </a>
                                                )}

                                                {/* Hiring Email */}
                                                {companyInfo.hiringEmail && (
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm">
                                                        <div className="p-1.5 bg-indigo-50 rounded-md">
                                                            <Mail className="w-4 h-4 text-indigo-500" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-slate-900 text-sm truncate" title={companyInfo.hiringEmail}>
                                                                {companyInfo.hiringEmail}
                                                            </div>
                                                            {companyInfo.emailType && (
                                                                <div className="text-[9px] text-slate-400 mt-0.5">
                                                                    {companyInfo.emailType}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Rating */}
                                                {companyInfo.companyRating && (
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm">
                                                        <div className="p-1.5 bg-amber-50 rounded-md">
                                                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 mb-0.5">企业评分</div>
                                                            <div className="font-bold text-slate-900 text-sm">
                                                                {companyInfo.companyRating}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 mt-0.5">
                                                                评分来源: Haigoo用户评价
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Address */}
                                                {companyInfo.address && (
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm col-span-2 lg:col-span-1 relative">
                                                        <div
                                                            className={`p-1.5 bg-indigo-50 rounded-md transition-colors ${
                                                                companyInfo.address.includes('远程') || companyInfo.address.toLowerCase().includes('remote')
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
                                                            <MapPin className="w-4 h-4 text-indigo-500" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-[10px] text-slate-500 mb-0.5">总部地址</div>
                                                            <div className="font-medium text-slate-900 text-sm truncate" title={companyInfo.address}>
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

                                                {/* Employees */}
                                                {companyInfo.employeeCount && (
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm">
                                                        <div className="p-1.5 bg-blue-50 rounded-md">
                                                            <Users className="w-4 h-4 text-blue-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 mb-0.5">员工人数</div>
                                                            <div className="font-medium text-slate-900 text-sm">
                                                                {companyInfo.employeeCount}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Founded */}
                                                {companyInfo.foundedYear && (
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm">
                                                        <div className="p-1.5 bg-emerald-50 rounded-md">
                                                            <Calendar className="w-4 h-4 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 mb-0.5">成立年份</div>
                                                            <div className="font-medium text-slate-900 text-sm">
                                                                {companyInfo.foundedYear}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Specialties - Full Width */}
                                                {companyInfo.specialties && companyInfo.specialties.length > 0 && (
                                                    <div className="col-span-full pt-2 mt-1 border-t border-slate-100">
                                                        <div className="text-[10px] text-slate-500 mb-1.5">企业领域/专长</div>
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
                                        ) : (
                                            /* Locked State - Optimized Visual */
                                            <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/30 min-h-[300px]">
                                                {/* Simulated Content Layer (Blurred) */}
                                                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 filter blur-sm opacity-60 select-none pointer-events-none h-full">
                                                    {/* Use real-looking fake data for better blur effect */}
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 h-16">
                                                        <div className="w-8 h-8 bg-slate-100 rounded-md"></div>
                                                        <div className="space-y-1.5 flex-1">
                                                            <div className="h-2 w-12 bg-slate-100 rounded"></div>
                                                            <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 h-16">
                                                        <div className="w-8 h-8 bg-slate-100 rounded-md"></div>
                                                        <div className="space-y-1.5 flex-1">
                                                            <div className="h-2 w-12 bg-slate-100 rounded"></div>
                                                            <div className="h-3 w-16 bg-slate-200 rounded"></div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 col-span-2 lg:col-span-1 h-16">
                                                        <div className="w-8 h-8 bg-slate-100 rounded-md"></div>
                                                        <div className="space-y-1.5 flex-1">
                                                            <div className="h-2 w-12 bg-slate-100 rounded"></div>
                                                            <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 h-16">
                                                        <div className="w-8 h-8 bg-slate-100 rounded-md"></div>
                                                        <div className="space-y-1.5 flex-1">
                                                            <div className="h-2 w-12 bg-slate-100 rounded"></div>
                                                            <div className="h-3 w-14 bg-slate-200 rounded"></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Overlay */}
                                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                                    <div className="text-center p-4 w-full max-w-sm">
                                                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg shadow-indigo-200">
                                                            <Crown className="w-5 h-5 text-white" />
                                                        </div>
                                                        <h3 className="text-sm font-bold text-slate-900 mb-1">会员专属深度信息</h3>
                                                        <p className="text-slate-500 text-xs mb-3">解锁官网、评分、业务信息等企业情报，让求职更加安心</p>
                                                        <button
                                                            onClick={() => navigate('/membership')}
                                                            className="flex items-center justify-center gap-1.5 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 mx-auto w-fit"
                                                        >
                                                            <span>查看详情</span>
                                                            <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                                <div className="p-4">
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
