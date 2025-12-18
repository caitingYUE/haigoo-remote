import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import SearchBar from '../components/SearchBar'
import LoadingSpinner from '../components/LoadingSpinner'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { TrustedStandardsBanner } from '../components/TrustedStandardsBanner'

export default function TrustedCompaniesPage() {
    const navigate = useNavigate()
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [jobCounts, setJobCounts] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})

    // Filters
    const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
    const [selectedRegions, setSelectedRegions] = useState<string[]>([])

    const [allJobs, setAllJobs] = useState<any[]>([])

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
            setAllJobs(jobsData)

            // Calculate job counts per company
            const counts: Record<string, { total: number, categories: Record<string, number> }> = {}
            const normalize = (name: string) => name?.toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ').trim() || ''

            companiesData.forEach((company: TrustedCompany) => {
                const companyNameNorm = normalize(company.name)

                const companyJobs = jobsData.filter((job: any) => {
                    if (!job.company) return false
                    const jobCompanyNorm = normalize(job.company)
                    return jobCompanyNorm === companyNameNorm || jobCompanyNorm.includes(companyNameNorm) || companyNameNorm.includes(jobCompanyNorm)
                })

                const categories: Record<string, number> = {}
                companyJobs.forEach((job: any) => {
                    const cat = job.category || '其他'
                    categories[cat] = (categories[cat] || 0) + 1
                })

                counts[company.id] = {
                    total: companyJobs.length,
                    categories
                }
            })
            setJobCounts(counts)

        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Derived Filter Options
    const industryOptions = useMemo(() => {
        const industries = new Set<string>()
        companies.forEach(c => {
            if (c.industry) industries.add(c.industry)
        })
        return Array.from(industries).sort().map(i => ({ label: i, value: i }))
    }, [companies])

    const regionOptions = useMemo(() => {
        const regions = new Set<string>()
        companies.forEach(c => {
            if (c.address) {
                // Extract country or city from address if possible, or just use full address
                // Simple strategy: split by comma and take the last part as Country/Region
                const parts = c.address.split(',')
                const region = parts[parts.length - 1].trim()
                if (region) regions.add(region)
            }
        })
        return Array.from(regions).sort().map(r => ({ label: r, value: r }))
    }, [companies])

    const filteredCompanies = companies.filter(company => {
        const searchLower = searchTerm.toLowerCase()
        // Basic company info match
        const infoMatch =
            company.name.toLowerCase().includes(searchLower) ||
            (company.description && company.description.toLowerCase().includes(searchLower)) ||
            (company.tags && company.tags.some(tag => tag.toLowerCase().includes(searchLower)))

        // Job title match
        const hasMatchingJobs = allJobs.some(job =>
            job.company &&
            company.name &&
            job.company.toLowerCase().includes(company.name.toLowerCase()) &&
            job.title &&
            job.title.toLowerCase().includes(searchLower)
        )

        // Industry Filter
        const industryMatch = selectedIndustries.length === 0 || (company.industry && selectedIndustries.includes(company.industry))

        // Region Filter
        const regionMatch = selectedRegions.length === 0 || (company.address && selectedRegions.some(r => company.address?.includes(r)))

        return (infoMatch || hasMatchingJobs) && industryMatch && regionMatch
    })

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Hero Section */}
            <div className="relative bg-slate-900 overflow-hidden py-16 sm:py-24">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                    <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl mix-blend-screen animate-blob"></div>
                    <div className="absolute top-32 right-10 w-72 h-72 rounded-full bg-purple-600/30 blur-3xl mix-blend-screen animate-blob animation-delay-2000"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-sm">
                        <Building className="w-3 h-3" /> Trusted Remote Companies
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                        发现全球顶尖<br className="sm:hidden" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-200">远程友好企业</span>
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto mb-10 text-lg">
                        Haigoo 严选全球远程工作机会，所有企业均经过人工审核，确保真实可靠。<br className="hidden md:block" />加入我们，开启自由职业的新篇章。
                    </p>

                    {/* Search & Filter Container */}
                    <div className="max-w-5xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-2xl">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1">
                                <SearchBar
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    onSearch={setSearchTerm}
                                    placeholder="搜索公司、行业或关键词..."
                                    className="w-full bg-white/90 border-0 focus:ring-0 rounded-xl h-12"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 px-1 md:px-0">
                                <MultiSelectDropdown
                                    label="行业"
                                    options={industryOptions}
                                    selected={selectedIndustries}
                                    onChange={setSelectedIndustries}
                                //  className="bg-white/90 border-0 rounded-xl h-12"
                                />
                                <MultiSelectDropdown
                                    label="地区"
                                    options={regionOptions}
                                    selected={selectedRegions}
                                    onChange={setSelectedRegions}
                                //  className="bg-white/90 border-0 rounded-xl h-12"
                                />
                                {(selectedIndustries.length > 0 || selectedRegions.length > 0) && (
                                    <button
                                        onClick={() => { setSelectedIndustries([]); setSelectedRegions([]); }}
                                        className="px-4 h-12 flex items-center text-sm font-medium text-white hover:bg-white/10 rounded-xl transition-colors whitespace-nowrap"
                                    >
                                        重置
                                    </button>
                                )}
                            </div>
                        </div>
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
                    <div className="text-center py-20 text-slate-500">
                        No companies found matching your search.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCompanies.map(company => (
                            <HomeCompanyCard
                                key={company.id}
                                company={company}
                                jobStats={jobCounts[company.id]}
                                onClick={() => navigate(`/companies/${encodeURIComponent(company.name)}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div >
    )
}
