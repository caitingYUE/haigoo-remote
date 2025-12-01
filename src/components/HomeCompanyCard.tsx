import React from 'react'
import { Building2, Users, Globe } from 'lucide-react'
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

    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
        >
            {/* Cover Area */}
            <div className={`h-24 bg-gradient-to-r ${getGradient(company.name)} relative`}>
                <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
            </div>

            <div className="px-6 pb-6 flex-1 flex flex-col relative">
                {/* Logo - Overlapping Cover */}
                <div className="-mt-10 mb-4 flex justify-center">
                    <div className="w-20 h-20 rounded-xl bg-white p-1 shadow-sm border border-gray-100 group-hover:scale-105 transition-transform duration-300">
                        <div className="w-full h-full rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                            {company.logo ? (
                                <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                            ) : (
                                <Building2 className="w-8 h-8 text-gray-300" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-center mb-4">
                    <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-blue-600 transition-colors">
                        {company.name}
                    </h3>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                        {company.industry && <span>{company.industry}</span>}
                    </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {(company.tags || []).slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs rounded-full border border-gray-100">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        查看详情 &rarr;
                    </span>
                </div>
            </div>
        </div>
    )
}
