import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase, ExternalLink, MapPin, Users, Calendar, CheckCircle, Linkedin, Star } from 'lucide-react'
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

                    <div className="flex items-start gap-6">
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

                        {/* Company Info */}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">{decodedCompanyName}</h1>

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
                                <SingleLineTags tags={companyInfo.tags} size="sm" />
                            )}
                        </div>
                    </div>

                    {/* Certified Info (Member Only) */}
                    {(companyInfo?.employeeCount || companyInfo?.address || companyInfo?.foundedYear || (companyInfo?.specialties && companyInfo.specialties.length > 0) || companyInfo?.companyRating) && (
                        <div className="mt-6 bg-white rounded-lg border border-indigo-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-indigo-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                                    <h2 className="text-sm font-bold text-indigo-900">企业认证信息</h2>
                                </div>
                                {!user?.memberStatus || user.memberStatus === 'free' ? (
                                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                                        仅会员可见
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                                        已认证
                                    </span>
                                )}
                            </div>
                            
                            <div className="p-4">
                                {user?.memberStatus && user.memberStatus !== 'free' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {companyInfo.address && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg">
                                                    <MapPin className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-0.5">总部地址</div>
                                                    <div className="text-sm text-slate-900">{companyInfo.address}</div>
                                                </div>
                                            </div>
                                        )}
                                        {companyInfo.employeeCount && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg">
                                                    <Users className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-0.5">员工人数</div>
                                                    <div className="text-sm text-slate-900">{companyInfo.employeeCount}</div>
                                                </div>
                                            </div>
                                        )}
                                        {companyInfo.foundedYear && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg">
                                                    <Calendar className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-0.5">成立年份</div>
                                                    <div className="text-sm text-slate-900">{companyInfo.foundedYear}</div>
                                                </div>
                                            </div>
                                        )}
                                        {companyInfo.companyRating && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg">
                                                    <Star className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-0.5">企业评分</div>
                                                    <div className="text-sm text-slate-900 flex items-center gap-2">
                                                        <span className="font-bold text-amber-500">{companyInfo.companyRating}</span>
                                                        {companyInfo.ratingSource && (
                                                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded">
                                                                via {companyInfo.ratingSource}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {companyInfo.specialties && companyInfo.specialties.length > 0 && (
                                            <div className="flex items-start gap-3 md:col-span-2">
                                                <div className="p-2 bg-slate-50 rounded-lg">
                                                    <Briefcase className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-1">领域专长</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {companyInfo.specialties.map((spec, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                                                {spec}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 filter blur-sm select-none opacity-50">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg"><MapPin className="w-4 h-4 text-slate-500" /></div>
                                                <div><div className="text-xs text-slate-500">总部地址</div><div className="text-sm text-slate-900">United States, California, San Francisco</div></div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg"><Users className="w-4 h-4 text-slate-500" /></div>
                                                <div><div className="text-xs text-slate-500">员工人数</div><div className="text-sm text-slate-900">1000-5000</div></div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-slate-50 rounded-lg"><Star className="w-4 h-4 text-slate-500" /></div>
                                                <div><div className="text-xs text-slate-500">企业评分</div><div className="text-sm text-slate-900">4.8 (via Glassdoor)</div></div>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <button 
                                                onClick={() => navigate('/membership')}
                                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-lg transform transition hover:scale-105"
                                            >
                                                升级会员查看完整认证信息
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Company Description */}
                    {companyInfo?.description && (
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <h2 className="text-sm font-semibold text-slate-900 mb-2">公司简介</h2>
                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {companyInfo.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Job Listings */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">在招岗位</h2>

                {jobs.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
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
    )
}
