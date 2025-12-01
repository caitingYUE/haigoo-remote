import React from 'react'
import { Building2, Globe, Briefcase, CheckCircle, Clock } from 'lucide-react'
import { TrustedCompany } from '../services/trusted-companies-service'

interface HomeCompanyCardProps {
    company: TrustedCompany
    onClick?: () => void
}

export default function HomeCompanyCard({ company, onClick }: HomeCompanyCardProps) {
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

    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        try {
            const date = new Date(dateString)
            return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
        } catch (e) {
            return ''
        }
    }

    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
        >
            {/* Cover Area - 16:9 Aspect Ratio */}
            <div className="relative w-full pt-[56.25%] overflow-hidden bg-gray-50">
                {company.coverImage ? (
                    <img
                        src={company.coverImage}
                        alt={`${company.name} cover`}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className={`absolute inset-0 bg-gradient-to-r ${getGradient(company.name)}`}>
                        <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                        {/* Fallback Logo in center if no cover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                            {company.logo ? (
                                <img src={company.logo} alt={company.name} className="w-16 h-16 object-contain grayscale" />
                            ) : (
                                <Building2 className="w-16 h-16 text-gray-400" />
                            )}
                        </div>
                    </div>
                )}

                {/* Badges Overlay */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    {company.isTrusted && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border border-green-100">
                            <CheckCircle className="w-3 h-3 text-green-600 fill-green-50" />
                            <span className="text-[10px] font-bold text-green-700">已审核</span>
                        </div>
                    )}
                </div>
                <div className="absolute bottom-3 right-3">
                    {company.canRefer && (
                        <div className="px-2 py-1 bg-green-50/90 backdrop-blur-sm rounded-full shadow-sm border border-green-100 text-[10px] font-bold text-green-700">
                            可内推
                        </div>
                    )}
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                {/* Header: Name & Industry */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {company.name}
                    </h3>
                    {company.industry && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full whitespace-nowrap">
                            {company.industry}
                        </span>
                    )}
                </div>

                {/* Updated At */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                    <Clock className="w-3 h-3" />
                    <span>更新于 {formatDate(company.updatedAt || new Date().toISOString())}</span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">
                    {company.description || '暂无简介'}
                </p>

                {/* Footer Icons */}
                <div className="pt-4 border-t border-gray-50 flex items-center gap-4 text-gray-400">
                    <div className="flex items-center gap-1.5 hover:text-blue-600 transition-colors" title="官方网站">
                        <Globe className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5 hover:text-blue-600 transition-colors" title="在招职位">
                        <Briefcase className="w-4 h-4" />
                        <span className="text-xs">查看岗位</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
