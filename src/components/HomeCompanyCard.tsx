import React, { useEffect, useState } from 'react'
import { Building2, Briefcase, CheckCircle, Clock, Target } from 'lucide-react'
import { TrustedCompany } from '../services/trusted-companies-service'
import { trustedCompaniesService } from '../services/trusted-companies-service'
import { MemberBadge } from './MemberBadge'

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
            className="group bg-white rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
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
                    ) : company.logo ? (
                        <div className="absolute inset-0 bg-white flex items-center justify-center p-8">
                            <img
                                src={company.logo}
                                alt={`${company.name} logo`}
                                loading="lazy"
                                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
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

                {/* Badges Overlay */}
                <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                    {company.canRefer ? (
                        <div title="可内推">
                            <MemberBadge variant="referral" size="sm" className="shadow-sm border-0" />
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                {/* Header: Name & Industry */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 text-lg line-clamp-1 group-hover:text-indigo-600 transition-colors">
                        {company.name}
                    </h3>
                    {company.industry && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full whitespace-nowrap">
                            {company.industry}
                        </span>
                    )}
                </div>

                {/* Updated At */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <Clock className="w-3 h-3" />
                    <span>更新于 {formatDate(company.updatedAt || new Date().toISOString())}</span>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">
                    {company.description || '暂无简介'}
                </p>

                {/* Footer: Hiring Info */}
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0 flex items-center gap-2 text-slate-600">
                        <Briefcase className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="font-medium text-xs truncate">
                            {company.jobCount || 0} 个在招职位
                            {topCategories.length > 0 && (
                                <span className="text-slate-400 font-normal ml-1">
                                    · {topCategories.map(([cat]) => cat).join('/')}
                                </span>
                            )}
                        </span>
                    </div>
                    <span className="text-xs text-indigo-600 font-medium group-hover:translate-x-1 transition-transform whitespace-nowrap flex-shrink-0 ml-2">
                        查看岗位 &rarr;
                    </span>
                </div>
            </div>
        </div>
    )
}
