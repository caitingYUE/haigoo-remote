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
import { CompanyNominationBanner } from '../components/CompanyNominationBanner'
import { CompanyNominationModal } from '../components/CompanyNominationModal'
import { useAuth } from '../contexts/AuthContext'
import { MembershipUpgradeModal } from '../components/MembershipUpgradeModal'

export default function TrustedCompaniesPage() {
    const navigate = useNavigate()
    const { user, isMember } = useAuth()


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
            <div className="relative bg-white overflow-hidden py-8 sm:py-12">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/80 via-white to-transparent opacity-70"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3">
                        <Building className="w-3 h-3" /> Trusted Remote Companies
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">
                        发现全球顶尖<br className="sm:hidden" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600"> 远程友好企业</span>
                    </h1>
                    <p className="text-slate-500 max-w-2xl mx-auto mb-6 text-lg leading-relaxed">
                        Haigoo 严选全球远程工作机会，所有企业均经过人工审核，确保真实可靠。<br className="hidden md:block" />加入我们，开启自由职业的新篇章。
                    </p>

                    {/* Search & Filter Container */}
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl p-2 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="flex-1">
                                <SearchBar
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    onSearch={setSearchTerm}
                                    placeholder="搜索公司、行业或关键词..."
                                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 rounded-xl h-11 text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 px-1 md:px-0">
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
                                        className="px-4 h-11 flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
                                    >
                                        重置
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Banners Grid */}
                    <div className="mt-6 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TrustedStandardsBanner 
                            context="company" 
                            isMember={isMember} 
                            onShowUpgrade={() => setShowUpgradeModal(true)}
                        />
                        <CompanyNominationBanner onClick={() => setIsNominationModalOpen(true)} />
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
            {/* Modals */}
            <CompanyNominationModal 
                isOpen={isNominationModalOpen} 
                onClose={() => setIsNominationModalOpen(false)} 
            />
            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                triggerSource="general"
            />
        </div >
    )
}
