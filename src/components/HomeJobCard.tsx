import React from 'react'
import { MapPin, Building2, DollarSign } from 'lucide-react'
import { Job } from '../types'

interface HomeJobCardProps {
    job: Job
    onClick?: () => void
}

export default function HomeJobCard({ job, onClick }: HomeJobCardProps) {
    const formatSalary = () => {
        if (!job.salary) return '薪资面议'
        const { min, max } = job.salary
        if (min && max) {
            return `${min / 1000}k-${max / 1000}k`
        }
        return '薪资面议'
    }

    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-xl p-5 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col h-full"
        >
            <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-900 text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {job.title}
                </h3>
                <span className="text-red-500 font-bold text-base whitespace-nowrap ml-2">
                    {formatSalary()}
                </span>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                {job.location && (
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded text-xs">
                        {job.location}
                    </span>
                )}
                <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded text-xs">
                    {job.experienceLevel || '经验不限'}
                </span>
            </div>

            <div className="mt-auto flex items-center gap-3 pt-4 border-t border-gray-50">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                    {job.logo ? (
                        <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
                    ) : (
                        <Building2 className="w-4 h-4 text-gray-300" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.company}</p>
                    <p className="text-xs text-gray-500 truncate">{job.companyIndustry || '互联网'}</p>
                </div>
            </div>
        </div>
    )
}
