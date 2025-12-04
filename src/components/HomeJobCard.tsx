import React from 'react'
import { Building2 } from 'lucide-react'
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
            className="group bg-white rounded-xl p-6 border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50/50 transition-all duration-300 cursor-pointer flex flex-col h-full relative overflow-hidden"
        >
            {/* Hover Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:border-blue-100 transition-colors flex-shrink-0">
                            {job.logo ? (
                                <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
                            ) : (
                                <Building2 className="w-6 h-6 text-slate-300" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {job.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-slate-500 font-medium">{job.company}</span>
                                {job.companyIndustry && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                        <span className="text-xs text-slate-400">{job.companyIndustry}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {job.location && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-xs font-medium">
                            {job.location}
                        </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 text-xs font-medium">
                        {job.experienceLevel || '经验不限'}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-green-50 text-green-600 text-xs font-medium">
                        {formatSalary()}
                    </span>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400">
                    <span>刚刚发布</span>
                    <span className="group-hover:translate-x-1 transition-transform text-blue-500 font-medium opacity-0 group-hover:opacity-100">
                        立即申请 &rarr;
                    </span>
                </div>
            </div>
        </div>
    )
}
