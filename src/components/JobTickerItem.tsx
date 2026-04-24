import React from 'react';
import { formatSalaryForDisplay } from '../utils/salary-display';

export default function JobTickerItem({ job, onOpen }: { job: any, onOpen?: (job: any) => void }) {
    const logos = Array.isArray(job.logo_candidates) ? job.logo_candidates.filter(Boolean) : []
    const [logoIndex, setLogoIndex] = React.useState(0)
    const currentLogo = logos[logoIndex] || job.company_logo || ''
    const salaryText = formatSalaryForDisplay(job.salary ?? job.salary_range, '薪资Open')

    const handleOpen = () => {
        if (onOpen) {
            onOpen(job)
            return
        }
        window.location.href = `/job/${job.id}`
    }

    return (
        <div 
            className="flex-shrink-0 flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full border border-slate-100 px-4 py-2 mx-2 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group min-w-[240px]"
            onClick={handleOpen}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpen()
                }
            }}
            role="button"
            tabIndex={0}
        >
            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {currentLogo ? (
                    <img
                        src={currentLogo}
                        alt={job.company_name}
                        className="w-full h-full object-contain"
                        onError={() => setLogoIndex((prev) => (prev < logos.length - 1 ? prev + 1 : prev))}
                    />
                ) : (
                    <span className="text-[10px] font-bold text-slate-400">
                        {job.company_name?.slice(0, 2).toUpperCase()}
                    </span>
                )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="font-bold text-slate-800 text-xs truncate max-w-[140px] group-hover:text-indigo-600 transition-colors">
                    {job.title}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="truncate max-w-[80px]">{job.company_name}</span>
                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                    <span>{salaryText}</span>
                </div>
            </div>

            <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </div>
        </div>
    )
}
