import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Building, Users, Globe } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import SearchBar from '../components/SearchBar'
import LoadingSpinner from '../components/LoadingSpinner'

export default function TrustedCompaniesPage() {
    const navigate = useNavigate()
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [jobCounts, setJobCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [companiesData, jobsData] = await Promise.all([
                trustedCompaniesService.getAllCompanies(),
                processedJobsService.getAllProcessedJobs(1000)
            ])

            setCompanies(companiesData)

            // Calculate job counts per company
            const counts: Record<string, number> = {}
            companiesData.forEach((company: TrustedCompany) => {
                const count = jobsData.filter((job: any) =>
                    job.company && company.name &&
                    job.company.toLowerCase().includes(company.name.toLowerCase())
                ).length
                counts[company.id] = count
            })
            setJobCounts(counts)

        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.description && company.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (company.tags && company.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    )

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            {/* Hero Section */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <h1 className="text-4xl font-bold text-[#1A365D] mb-4">
                        Meet the Innovators: Our Trusted Remote Companies
                    </h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                        Discover our hand-picked selection of verified companies, celebrated for their remote culture, mission, and the opportunities they offer.
                    </p>

                    <div className="max-w-2xl mx-auto">
                        <SearchBar
                            value={searchTerm}
                            onChange={setSearchTerm}
                            onSearch={setSearchTerm}
                            placeholder="Search by company name..."
                            className="w-full shadow-md"
                        />
                    </div>

                    {/* Filters (Visual only for now as per design, can be functional later) */}
                    <div className="flex justify-center gap-4 mt-8">
                        <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 flex items-center gap-2">
                            Industry <span className="text-xs">▼</span>
                        </button>
                        <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 flex items-center gap-2">
                            Company Size <span className="text-xs">▼</span>
                        </button>
                        <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 flex items-center gap-2">
                            Region <span className="text-xs">▼</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Company Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        No companies found matching your search.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCompanies.map(company => (
                            <div
                                key={company.id}
                                onClick={() => navigate(`/company/${company.id}`)}
                                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 group overflow-hidden flex flex-col h-full"
                            >
                                {/* Large Preview Image Area */}
                                <div className="w-full h-40 bg-gray-50 relative border-b border-gray-100">
                                    {company.logo ? (
                                        <img
                                            src={company.logo}
                                            alt={company.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                // Fallback if image fails
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}

                                    {/* Fallback Icon (shown if no logo or load error) */}
                                    <div className={`w-full h-full flex items-center justify-center ${company.logo ? 'hidden' : ''}`}>
                                        <Building className="w-12 h-12 text-gray-300" />
                                    </div>

                                    {/* Verified Badge Overlay */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-[#1A365D] shadow-sm border border-gray-100">
                                        <div className="w-3 h-3 bg-[#3182CE] rounded-full flex items-center justify-center">
                                            <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2 text-white" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </div>
                                        Verified
                                    </div>
                                </div>

                                <div className="p-6 flex flex-col flex-1">

                                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#3182CE] transition-colors">
                                        {company.name}
                                    </h3>

                                    <p className="text-gray-500 text-sm mb-4 line-clamp-2 h-10">
                                        {company.description || 'No description available.'}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {company.tags && company.tags.length > 0 ? (
                                            company.tags.slice(0, 3).map((tag, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                                                    {tag}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">Remote First</span>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-gray-50">
                                        <div className="text-sm font-medium text-gray-900">
                                            Open Positions:
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            {jobCounts[company.id] > 0 ? (
                                                <span className="text-[#3182CE]">{jobCounts[company.id]} active jobs</span>
                                            ) : (
                                                'No active jobs currently'
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    )
}
