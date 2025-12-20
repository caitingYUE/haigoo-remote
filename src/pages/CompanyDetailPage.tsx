import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase, ExternalLink, MapPin, Users, Calendar, CheckCircle, Linkedin, Star, Shield, Crown, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import JobCardNew from '../components/JobCardNew'
import { SingleLineTags } from '../components/SingleLineTags'

export default function CompanyDetailPage() {
    const { companyName } = useParams<{ companyName: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())

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
        navigate(`/jobs?jobId=${job.id}`)
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

                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {/* Left Column: Identity + Certified Info (Main) */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-6 mb-8">
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

                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-3">
                                        {companyInfo?.industry && (
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="w-4 h-4" />
                                                <span>{companyInfo.industry}</span>
                                            </div>
                                        )}
                                        {companyInfo?.website && (
                                            <a
                                                href={companyInfo.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700"
                                            >
                                                <Globe className="w-4 h-4" />
                                                <span>官网</span>
                                            </a>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <Briefcase className="w-4 h-4" />
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

                            {/* Certified Info - Expanded Section (Member Feature) */}
                            {(companyInfo?.employeeCount || companyInfo?.address || companyInfo?.foundedYear || (companyInfo?.specialties && companyInfo.specialties.length > 0) || companyInfo?.companyRating) && (
                                <div className="mb-8 relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-sm">
                                    {/* Member Badge Header */}
                                    <div className="px-6 py-4 border-b border-indigo-100/50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                                        <div className="flex items-center gap-2 text-indigo-700">
                                            <div className="p-1.5 bg-indigo-100 rounded-lg">
                                                <Crown className="w-4 h-4" />
                                            </div>
                                            <h2 className="font-bold">企业认证信息</h2>
                                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium border border-amber-200">
                                                会员专属
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-6 relative">
                                        {user?.memberStatus && user.memberStatus !== 'free' ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {/* Rating */}
                                                {companyInfo.companyRating && (
                                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                                                        <div className="mt-1 p-2 bg-amber-50 rounded-lg">
                                                            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-slate-500 mb-1">企业评分</div>
                                                            <div className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                                                                {companyInfo.companyRating}
                                                            </div>
                                                            {companyInfo.ratingSource && (
                                                                <div className="text-xs text-slate-400">
                                                                    via {companyInfo.ratingSource}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Address */}
                                                {companyInfo.address && (
                                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm md:col-span-2 lg:col-span-1">
                                                        <div className="mt-1 p-2 bg-indigo-50 rounded-lg">
                                                            <MapPin className="w-5 h-5 text-indigo-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-slate-500 mb-1">总部地址</div>
                                                            <div className="font-medium text-slate-900 leading-snug">
                                                                {companyInfo.address}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Employees */}
                                                {companyInfo.employeeCount && (
                                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                                                        <div className="mt-1 p-2 bg-blue-50 rounded-lg">
                                                            <Users className="w-5 h-5 text-blue-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-slate-500 mb-1">员工人数</div>
                                                            <div className="font-medium text-slate-900">
                                                                {companyInfo.employeeCount}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Founded */}
                                                {companyInfo.foundedYear && (
                                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                                                        <div className="mt-1 p-2 bg-emerald-50 rounded-lg">
                                                            <Calendar className="w-5 h-5 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-slate-500 mb-1">成立年份</div>
                                                            <div className="font-medium text-slate-900">
                                                                {companyInfo.foundedYear}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Specialties - Full Width */}
                                                {companyInfo.specialties && companyInfo.specialties.length > 0 && (
                                                    <div className="col-span-full pt-4 mt-2 border-t border-indigo-50">
                                                        <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">领域专长</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {companyInfo.specialties.map((spec, idx) => (
                                                                <span key={idx} className="px-3 py-1 bg-white text-slate-700 rounded-lg border border-slate-200 text-sm font-medium shadow-sm">
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
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 filter blur-[5px] select-none opacity-50 pointer-events-none">
                                                    <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl"><div className="w-10 h-10 bg-amber-50 rounded-lg"></div><div className="space-y-2"><div className="w-16 h-3 bg-slate-200 rounded"></div><div className="w-12 h-5 bg-slate-200 rounded"></div></div></div>
                                                    <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl"><div className="w-10 h-10 bg-indigo-50 rounded-lg"></div><div className="space-y-2"><div className="w-16 h-3 bg-slate-200 rounded"></div><div className="w-24 h-5 bg-slate-200 rounded"></div></div></div>
                                                    <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl"><div className="w-10 h-10 bg-blue-50 rounded-lg"></div><div className="space-y-2"><div className="w-16 h-3 bg-slate-200 rounded"></div><div className="w-20 h-5 bg-slate-200 rounded"></div></div></div>
                                                    <div className="col-span-full h-20 bg-slate-50 rounded-xl"></div>
                                                </div>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 backdrop-blur-[1px] z-10">
                                                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-indigo-100 text-center max-w-sm mx-auto">
                                                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                            <Crown className="w-6 h-6" />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-slate-900 mb-2">解锁企业深度认证信息</h3>
                                                        <p className="text-slate-500 text-sm mb-6">
                                                            升级会员即可查看企业评分、薪资范围、面试评价等深度信息
                                                        </p>
                                                        <button 
                                                            onClick={() => navigate('/membership')}
                                                            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transform transition hover:-translate-y-0.5 active:translate-y-0"
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
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                    <Info className="w-4 h-4 text-slate-500" />
                                    <h2 className="font-bold text-slate-900">关于我们</h2>
                                </div>
                                <div className="p-5">
                                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {companyInfo?.description || '暂无简介'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Job Listings - Full Width */}
                    <div className="mt-10 pt-8 border-t border-slate-200/60">
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
        </div>
    )
}
