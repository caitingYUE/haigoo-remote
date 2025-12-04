import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, Briefcase } from 'lucide-react'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import JobCard from '../components/JobCard'
import { SingleLineTags } from '../components/SingleLineTags'

export default function CompanyDetailPage() {
    const { companyName } = useParams<{ companyName: string }>()
    const navigate = useNavigate()
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
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white font-bold text-2xl">
                                {decodedCompanyName.charAt(0)}
                            </span>
                        </div>

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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {jobs.map((job) => (
                            <div key={job.id} onClick={() => handleJobClick(job)}>
                                <JobCard
                                    job={job}
                                    onSave={() => toggleSaveJob(job.id)}
                                    isSaved={savedJobs.has(job.id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
