import React, { useEffect, useState } from 'react'
import { Building2, Briefcase, Clock } from 'lucide-react'
import { TrustedCompany } from '../services/trusted-companies-service'
import { trustedCompaniesService } from '../services/trusted-companies-service'
import { getCompanyLogoSources } from '../utils/company-logo'

interface HomeCompanyCardProps {
    company: TrustedCompany
    jobStats?: {
        total: number
        categories: Record<string, number>
    }
    onClick?: () => void
}

export default function HomeCompanyCard({ company, jobStats, onClick }: HomeCompanyCardProps) {
    const [coverImage, setCoverImage] = useState<string>('')
    const [isLoadingCover, setIsLoadingCover] = useState(false)
    const [hasLoadedCover, setHasLoadedCover] = useState(false)
    const logoSources = React.useMemo(() => getCompanyLogoSources({
        companyId: company.id,
        cachedLogoUrl: company.cachedLogoUrl,
        originalLogoUrl: company.logo,
        version: company.updatedAt
    }), [company.id, company.cachedLogoUrl, company.logo, company.updatedAt])
    const logoSourceKey = React.useMemo(() => logoSources.join('|'), [logoSources])
    const [logoSourceIndex, setLogoSourceIndex] = useState(0)
    const logoSrc = logoSources[logoSourceIndex] || ''

    useEffect(() => {
        setLogoSourceIndex(0)
    }, [logoSourceKey])

    // Generate a consistent gradient based on company name length
    const getGradient = (name: string) => {
        const gradients = [
            'from-blue-50 to-indigo-50',
            'from-purple-50 to-pink-50',
            'from-orange-50 to-amber-50',
            'from-emerald-50 to-teal-50',
            'from-cyan-50 to-blue-50'
        ]
        const index = name.length % gradients.length
        return gradients[index]
    }

    // 异步加载cover image
    useEffect(() => {
        // 只有当company.id存在且cover image尚未加载时才进行加载
        if (company.id && !hasLoadedCover && !isLoadingCover) {
            setIsLoadingCover(true)

            trustedCompaniesService.getCompanyCoverImage(company.id)
                .then(result => {
                    if (result && result.coverImage) {
                        setCoverImage(result.coverImage)
                    }
                    setHasLoadedCover(true)
                })
                .catch(error => {
                    console.error('Failed to load cover image for company:', company.name, error)
                    setHasLoadedCover(true)
                })
                .finally(() => {
                    setIsLoadingCover(false)
                })
        }
    }, [company.id, hasLoadedCover, isLoadingCover])

    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        try {
            const date = new Date(dateString)
            return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
        } catch (e) {
            return ''
        }
    }

    // Get top 3 categories sorted by count
    const topCategories = jobStats
        ? Object.entries(jobStats.categories)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
        : []

    return (
        <div
            onClick={onClick}
            className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-100 bg-white transition-all duration-300 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50"
        >
            {/* Cover Area - 16:9 Aspect Ratio */}
            <div className="relative w-full pt-[56.25%] overflow-hidden bg-slate-50">
                {!isLoadingCover && (
                    coverImage ? (
                        <img
                            src={coverImage}
                            alt={`${company.name} cover`}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : logoSrc ? (
                        <div className="absolute inset-0 bg-white flex items-center justify-center p-8">
                            <img
                                src={logoSrc}
                                alt={`${company.name} logo`}
                                loading="lazy"
                                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                onError={() => {
                                    if (logoSourceIndex < logoSources.length - 1) {
                                        setLogoSourceIndex((idx) => idx + 1)
                                    } else {
                                        setLogoSourceIndex(logoSources.length)
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className={`absolute inset-0 bg-gradient-to-r ${getGradient(company.name)}`}>
                            <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                            {/* Fallback Icon if absolutely no image */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                <Building2 className="w-16 h-16 text-slate-400" />
                            </div>
                        </div>
                    )
                )}

            </div>

            <div className="flex flex-1 flex-col p-4 sm:p-5">
                {/* Header: Name & Industry */}
                <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-base sm:text-lg font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
                        {company.name}
                    </h3>
                    {company.industry && (
                        <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] sm:text-xs text-indigo-600">
                            {company.industry}
                        </span>
                    )}
                </div>

                {/* Updated At */}
                <div className="mb-3 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>企业信息更新于 {formatDate(company.updatedAt || new Date().toISOString())}</span>
                </div>

                {/* Description */}
                <p className="mb-4 flex-1 line-clamp-2 text-[13px] sm:text-sm text-slate-500">
                    {company.description || '暂无简介'}
                </p>

                {/* Footer: Hiring Info */}
                <div className="flex items-center justify-between border-t border-slate-50 pt-3.5 text-sm sm:pt-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-slate-600">
                        <Briefcase className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="truncate text-[11px] sm:text-xs font-medium">
                            {company.jobCount || 0} 个在招职位
                            {topCategories.length > 0 && (
                                <span className="text-slate-400 font-normal ml-1">
                                    · {topCategories.map(([cat]) => cat).join('/')}
                                </span>
                            )}
                        </span>
                    </div>
                    <span className="ml-2 flex-shrink-0 whitespace-nowrap text-[11px] sm:text-xs font-medium text-indigo-600 transition-transform group-hover:translate-x-1">
                        查看岗位 &rarr;
                    </span>
                </div>
            </div>
        </div>
    )
}
