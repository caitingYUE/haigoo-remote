import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Globe, Linkedin, Briefcase, MapPin, CheckCircle, ArrowLeft, ExternalLink } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { Job } from '../types'
import JobCard from '../components/JobCard'
import { useNotificationHelpers } from '../components/NotificationSystem'
import JobDetailModal from '../components/JobDetailModal'

export default function CompanyProfilePage() {
    const { id } = useParams<{ id: string }>()
    const { showError } = useNotificationHelpers()
    const [company, setCompany] = useState<TrustedCompany | null>(null)
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedJob, setSelectedJob] = useState<Job | null>(null)

    useEffect(() => {
        if (id) {
            loadData(id)
        }
    }, [id])

    const loadData = async (companyId: string) => {
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
                return job.company && companyData.name &&
                    job.company.toLowerCase().includes(companyData.name.toLowerCase())
            })
            setJobs(relatedJobs)

        } catch (error) {
            console.error('Failed to load company data:', error)
            showError('加载失败', '无法获取企业信息')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!company) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">未找到该企业</h1>
                <Link to="/jobs" className="text-blue-600 hover:underline">返回职位列表</Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F0F4F8]">
            {/* Header / Banner */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Link to="/jobs" className="inline-flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        返回职位列表
                    </Link>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Logo */}
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex-shrink-0">
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
                                <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
                                {company.isTrusted && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-100">
                                        <CheckCircle className="w-4 h-4" />
                                        官方认证远程企业
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-4 text-gray-600 mb-6">
                                {company.website && (
                                    <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                                        <Globe className="w-4 h-4" />
                                        官网
                                    </a>
                                )}
                                {company.careersPage && (
                                    <a href={company.careersPage} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                                        <Briefcase className="w-4 h-4" />
                                        招聘主页
                                    </a>
                                )}
                                {company.linkedin && (
                                    <a href={company.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                                        <Linkedin className="w-4 h-4" />
                                        LinkedIn
                                    </a>
                                )}
                            </div>

                            <p className="text-gray-600 leading-relaxed max-w-3xl">
                                {company.description || '暂无详细介绍'}
                            </p>

                            {company.tags && company.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {company.tags.map((tag, i) => (
                                        <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {company.careersPage && (
                                <a
                                    href={company.careersPage}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm whitespace-nowrap"
                                >
                                    访问招聘官网
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Jobs Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    在招职位 ({jobs.length})
                </h2>

                {jobs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {jobs.map((job, index) => (
                            <JobCard
                                key={job.id}
                                job={job}
                                isSaved={false} // Todo: connect with saved state
                                onSave={() => { }}
                                onClick={(job) => setSelectedJob(job)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Briefcase className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">暂无在招职位</h3>
                        <p className="text-gray-500">该企业目前在我们的平台上没有活跃的职位信息。</p>
                        {company.careersPage && (
                            <a
                                href={company.careersPage}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block mt-4 text-blue-600 hover:underline"
                            >
                                前往官网查看更多 &rarr;
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Job Detail Modal */}
            {selectedJob && (
                <JobDetailModal
                    job={selectedJob}
                    isOpen={!!selectedJob}
                    onClose={() => setSelectedJob(null)}
                />
            )}
        </div>
    )
}
