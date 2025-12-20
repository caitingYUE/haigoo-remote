import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase, ExternalLink, MapPin, Users, Calendar, CheckCircle, Linkedin, Star, Shield, Crown, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import JobCardNew from '../components/JobCardNew'
import { SingleLineTags } from '../components/SingleLineTags'
import JobDetailModal from '../components/JobDetailModal'

export default function CompanyDetailPage() {
    const { companyName } = useParams<{ companyName: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    
    // Check membership (consistent with other components)
    const isMember = (
        (user?.memberStatus === 'active' && (!user.memberExpireAt || new Date(user.memberExpireAt) > new Date())) || 
        !!user?.roles?.admin
    );

    // DEBUG: Log user and membership status
    useEffect(() => {
        if (user) {
            console.log('[CompanyDetail] User:', user.email);
            console.log('[CompanyDetail] MemberStatus:', user.memberStatus);
            console.log('[CompanyDetail] ExpireAt:', user.memberExpireAt);
            console.log('[CompanyDetail] IsAdmin:', !!user.roles?.admin);
            console.log('[CompanyDetail] Calculated isMember:', isMember);
        }
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
            // Try to get trusted company info first
            const companies = await trustedCompaniesService.getAllCompanies()
            const norm = decodedCompanyName.trim().toLowerCase()
            const trusted = companies.find(c => c.name?.trim().toLowerCase() === norm) ||
                companies.find(c => c.name && c.name.toLowerCase().includes(norm))
            if (trusted) {
                setCompanyInfo(trusted)
            }

            // Fetch all jobs from this company
            const response = await processedJobsService.getProcessedJobs(1, 100, { company: decodedCompanyName })
            setJobs(response.jobs)
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

    const toggleSaveJob = async (jobId: string) => {
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
                body: JSON.stringify({ jobId })
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
                                <div className="mt-4 bg-slate-50/50 rounded-xl border border-slate-200/60 overflow-hidden">
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
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Address */}
                                                {companyInfo.address && (
                                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 shadow-sm col-span-2 lg:col-span-1">
                                                        <div className="p-1.5 bg-indigo-50 rounded-md">
                                                            <MapPin className="w-4 h-4 text-indigo-500" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] text-slate-500 mb-0.5">总部地址</div>
                                                            <div className="font-medium text-slate-900 text-sm truncate">
                                                                {companyInfo.address}
                                                            </div>
                                                        </div>
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
                                            /* Locked State */
                                            <>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 filter blur-[4px] select-none opacity-60 pointer-events-none">
                                                    <div className="h-12 bg-white rounded-lg border border-slate-100"></div>
                                                    <div className="h-12 bg-white rounded-lg border border-slate-100"></div>
                                                    <div className="h-12 bg-white rounded-lg border border-slate-100"></div>
                                                    <div className="h-12 bg-white rounded-lg border border-slate-100"></div>
                                                </div>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/10 backdrop-blur-[1px] z-10">
                                                    <div className="bg-white/90 p-4 rounded-xl shadow-lg border border-indigo-100 text-center max-w-xs mx-auto backdrop-blur-md">
                                                        <div className="flex items-center justify-center gap-2 mb-2">
                                                            <Crown className="w-4 h-4 text-amber-500" />
                                                            <h3 className="text-sm font-bold text-slate-900">解锁深度认证信息</h3>
                                                        </div>
                                                        <p className="text-slate-500 text-xs mb-3">
                                                            查看官网、评分、薪资范围等深度信息
                                                        </p>
                                                        <button 
                                                            onClick={() => navigate('/membership')}
                                                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                                                        >
                                                            立即解锁
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
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
                    onSave={() => toggleSaveJob(selectedJob.id)}
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
