
import React, { useMemo } from 'react';
import { Briefcase, Globe, ChevronRight, Sparkles } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
// import { useNavigate } from 'react-router-dom';

interface JobCardNewProps {
   job: Job;
   onClick?: (job: Job) => void;
   matchScore?: number; // Personalized match score (0-100)
}

export default function JobCardNew({ job, onClick, matchScore }: JobCardNewProps) {
   // const navigate = useNavigate();

   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   const formatSalary = (salary: Job['salary']) => {
      if (!salary || (salary.min === 0 && salary.max === 0)) return '薪资面议';
      const formatAmount = (amount: number) => {
         if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
         return amount.toString();
      };
      const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : salary.currency;
      if (salary.min === salary.max) return `${currencySymbol}${formatAmount(salary.min)}`;
      return `${currencySymbol}${formatAmount(salary.min)} - ${currencySymbol}${formatAmount(salary.max)}`;
   };

   const isVerified = job.isTrusted || job.canRefer;

   return (
      <div
         onClick={() => onClick?.(job)}
         className="group relative bg-white rounded-2xl p-6 border border-slate-100 hover:border-indigo-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer overflow-hidden"
      >
         {/* Top Decoration for Verified Jobs */}
         {isVerified && (
            <div className="absolute top-0 right-0 p-0">
               <div className="bg-gradient-to-bl from-blue-500 to-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  CLUB VERIFIED
               </div>
            </div>
         )}

         <div className="flex flex-col h-full">
            {/* Header Section */}
            <div className="flex items-start gap-4 mb-5">
               {/* Company Logo */}
               <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl shadow-inner flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  {job.logo ? (
                     <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
                  ) : (
                     <span className="font-serif italic">{companyInitial}</span>
                  )}
               </div>

               <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                     <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate tracking-tight">
                        {job.translations?.title || job.title}
                     </h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                     <span>{job.translations?.company || job.company}</span>
                  </div>
               </div>
            </div>

            {/* Job Description Summary - NEW */}
            {(() => {
               // Generate job summary
               const getJobSummary = (): string => {
                  // Try description first
                  if (job.description) {
                     const cleanText = job.description
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/\s+/g, ' ') // Merge whitespace
                        .trim()

                     if (cleanText.length > 200) {
                        return cleanText.substring(0, 200) + '...'
                     }
                     return cleanText
                  }

                  // Fallback to summary
                  if (job.summary) {
                     return job.summary.length > 200
                        ? job.summary.substring(0, 200) + '...'
                        : job.summary
                  }

                  return ''
               }

               const summary = getJobSummary()

               return summary ? (
                  <p className="text-sm text-slate-600 leading-relaxed mb-5 line-clamp-2">
                     {summary}
                  </p>
               ) : null
            })()}

            {/* Tags Section - Pill Shape */}
            <div className="flex flex-wrap gap-2 mb-6">
               <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100">
                  <Briefcase className="w-3 h-3 mr-1.5 text-slate-400" />
                  {job.type === 'full-time' ? '全职' : job.type}
               </span>
               {job.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100">
                     {job.category}
                  </span>
               )}
               <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-100">
                  <Globe className="w-3 h-3 mr-1.5 text-indigo-500" />
                  {job.isRemote ? '远程' : (job.translations?.location || job.location)}
               </span>
               {matchScore !== undefined && matchScore > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-yellow-50 to-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                     <Sparkles className="w-3 h-3 mr-1.5 text-amber-500 fill-amber-500" />
                     匹配 {matchScore}%
                  </span>
               )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6 py-4 border-t border-dashed border-slate-100">
               <div>
                  <p className="text-xs text-slate-400 mb-1">薪资范围 (Salary)</p>
                  <p className="font-bold text-slate-900">{formatSalary(job.salary)}</p>
               </div>
               <div>
                  <p className="text-xs text-slate-400 mb-1">发布日期 (Date)</p>
                  <p className="font-bold text-slate-900">{DateFormatter.formatPublishTime(job.postedAt)}</p>
               </div>
            </div>

            {/* Footer Action */}
            <div className="mt-auto pt-2">
               <button className="w-full group/btn relative flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow-sm hover:shadow-indigo-200 hover:shadow-lg overflow-hidden">
                  <span className="relative z-10">{job.canRefer ? '一键投递 (Apply Now)' : '查看详情 (View Details)'}</span>
                  <ChevronRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-indigo-600 transform scale-x-0 group-hover/btn:scale-x-100 transition-transform origin-left duration-300"></div>
               </button>
            </div>
         </div>
      </div>
   );
}
