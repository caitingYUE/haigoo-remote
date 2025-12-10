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
            <div className="bg-white border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 mb-3">
                        遇见创新者：我们的可信远程企业
                    </h1>
                    
                    {/* Trusted Company Standards - Hero Banner */}
                    <div className="max-w-4xl mx-auto mb-8 text-left">
                        <TrustedStandardsBanner />
                    </div>

                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <SearchBar
                                value={searchTerm}
                                onChange={setSearchTerm}
                                onSearch={setSearchTerm}
                                placeholder="搜索岗位、公司或关键词..."
                                className="w-full shadow-sm"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
                            <MultiSelectDropdown
                                label="行业"
                                options={industryOptions}
                                selected={selectedIndustries}
                                onChange={setSelectedIndustries}
                            />
                            <MultiSelectDropdown
                                label="地区"
                                options={regionOptions}
                                selected={selectedRegions}
                                onChange={setSelectedRegions}
                            />
                            {(selectedIndustries.length > 0 || selectedRegions.length > 0) && (
                                <button 
                                    onClick={() => { setSelectedIndustries([]); setSelectedRegions([]); }}
                                    className="text-sm text-slate-500 hover:text-indigo-600 whitespace-nowrap"
                                >
                                    重置
                                </button>
                            )}
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
