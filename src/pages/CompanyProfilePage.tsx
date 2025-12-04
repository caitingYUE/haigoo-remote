import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Briefcase, CheckCircle, ArrowLeft } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { Job } from '../types'
import JobCard from '../components/JobCard'
import { useNotificationHelpers } from '../components/NotificationSystem'
import JobDetailModal from '../components/JobDetailModal'

export default function CompanyProfilePage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const { showError } = useNotificationHelpers()
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
            const allJobs = await processedJobsService.getAllProcessedJobs(1000) // Fetch enough jobs
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
            showError('加载失败', '无法获取企业信息')
        } finally {
            setLoading(false)
        }
    }, [showError])

    useEffect(() => {
        if (id) {
            loadData(id)
        }
    }, [id, loadData])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!company) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">未找到该企业</h1>
                <Link to="/jobs" className="text-blue-600 hover:underline">返回职位列表</Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F0F4F8]">
            {/* Header / Banner */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回
                    </button>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Logo */}
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex-shrink-0">
                            {company.logo ? (
                                <img src={company.logo} alt={company.name} className="w-full h-full object-contain rounded-xl" />
                            ) : (
                                <div className="w-full h-full bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-4xl">
                                    {company.name.charAt(0)}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900">{company.name}</h1>
                                {company.isTrusted && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-100">
                                        <CheckCircle className="w-4 h-4" />
                                        已审核
                                    </span>
                                )}
                                {company.canRefer && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100">
                                        可内推
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-slate-600 mb-6">
                                {/* Links hidden as per request */}
                            </div>

                            <p className="text-slate-600 leading-relaxed max-w-3xl">
                                {company.description || '暂无详细介绍'}
                            </p>

                            {company.tags && company.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {company.tags.map((tag, i) => (
                                        <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions - Hidden */}
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {/* Careers link removed */}
                        </div>
                    </div>
                </div>
            </div>

            {/* Jobs Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-6 flex flex-col lg:flex-row lg:items-end gap-4 lg:justify-between">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        在招职位 ({jobs.length})
                    </h2>

                    {/* Search & Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        {/* Search */}
                        <div className="flex-1 sm:flex-none">
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm min-w-[260px]">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="搜索职位名称、地点、类型..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as any)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm"
                        >
                            <option value="all">全部类型</option>
                            <option value="full-time">全职</option>
                            <option value="part-time">兼职</option>
                            <option value="contract">合同</option>
                            <option value="internship">实习</option>
                        </select>

                        {/* Remote Filter */}
                        <select
                            value={remoteFilter}
                            onChange={e => setRemoteFilter(e.target.value as any)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm"
                        >
                            <option value="all">全部地点</option>
                            <option value="remote">仅远程</option>
                            <option value="onsite">非远程</option>
                        </select>
                    </div>
                </div>

                {/* Filtered Jobs */}
                {(() => {
                    const keyword = searchTerm.trim().toLowerCase()
                    const filtered = jobs.filter(job => {
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
                    return (
                        filtered.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filtered.map((job) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        isSaved={false}
                                        onSave={() => { }}
                                        onClick={(job) => setSelectedJob(job)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                    <Briefcase className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 mb-1">未找到匹配的职位</h3>
                                <p className="text-slate-500">试试调整搜索关键词或筛选条件。</p>
                            </div>
                        )
                    )
                })()}
            </div>

            {/* Job Detail Modal */}
            {
                selectedJob && (
                    <JobDetailModal
                        job={selectedJob}
                        isOpen={!!selectedJob}
                        onClose={() => setSelectedJob(null)}
                    />
                )
            }
        </div >
    )
}
