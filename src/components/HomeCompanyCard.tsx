import React from 'react'
import { Building2, Users, Globe } from 'lucide-react'
import { TrustedCompany } from '../services/trusted-companies-service'

interface HomeCompanyCardProps {
    company: TrustedCompany
    onClick?: () => void
}

export default function HomeCompanyCard({ company, onClick }: HomeCompanyCardProps) {
    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
        >
            <div className="p-5 flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform group-hover:border-blue-100">
                    {company.logo ? (
                        <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                    ) : (
                        <Building2 className="w-7 h-7 text-gray-300" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg truncate mb-1 group-hover:text-blue-600 transition-colors">
                        {company.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        {company.industry && <span>{company.industry}</span>}
                    </div>
                </div>
            </div>

            <div className="px-5 pb-5 mt-auto">
                <div className="flex flex-wrap gap-2 mb-4">
                    {(company.tags || []).slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md group-hover:bg-blue-50/50 group-hover:text-blue-600/80 transition-colors">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">热招职位</span>
                    <span className="text-sm font-medium text-blue-500 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        查看详情
                    </span>
                </div>
            </div>
        </div>
    )
}
