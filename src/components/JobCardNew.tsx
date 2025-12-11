
import React, { useMemo } from 'react';
import { Briefcase, Globe, ChevronRight, Sparkles, Building2, ExternalLink, Check } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { stripMarkdown } from '../utils/text-formatter';
import { SingleLineTags } from './SingleLineTags';

interface JobCardNewProps {
   job: Job;
   onClick?: (job: Job) => void;
   matchScore?: number; // Personalized match score (0-100)
   className?: string;
   variant?: 'grid' | 'list';
   isActive?: boolean;
}

export default function JobCardNew({ job, onClick, matchScore, className, variant = 'grid', isActive = false }: JobCardNewProps) {
   // const navigate = useNavigate();

   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   const formatSalary = (salary: Job['salary']) => {
      if (!salary || (salary.min === 0 && salary.max === 0)) return '薪资Open';
      const formatAmount = (amount: number) => {
         if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
         return amount.toString();
      };
      const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : salary.currency;
      if (salary.min === salary.max) return `${currencySymbol}${formatAmount(salary.min)}`;
      return `${currencySymbol}${formatAmount(salary.min)} - ${currencySymbol}${formatAmount(salary.max)}`;
   };

   const isVerified = job.isTrusted || job.canRefer;
   
   // Handle company website click
   const handleCompanyClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Strict: Only use companyWebsite from backend (trusted_companies)
      const url = job.companyWebsite;
      if (url) {
         window.open(url, '_blank', 'noopener,noreferrer');
      }
   };

   if (variant === 'list') {
      return (
         <div
            onClick={() => onClick?.(job)}
            className={`group relative p-6 border-b border-slate-100 hover:bg-slate-50/80 transition-all duration-300 cursor-pointer ${isActive ? 'bg-indigo-50/60' : ''} ${className || ''}`}
         >
            {/* Active Indicator */}
            {isActive && (
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
            )}

               {/* Corner Tag */}
               <div className="absolute top-0 right-0 z-10 flex flex-col items-end">
                  {job.canRefer ? (
                     <div className="text-[10px] font-bold px-3 py-1 rounded-bl-xl text-white shadow-sm flex items-center gap-1 bg-gradient-to-bl from-amber-400 to-orange-500 shadow-amber-200 mb-1">
                        <Sparkles className="w-3 h-3" />
                        内推
                     </div>
                  ) : job.isTrusted ? (
                     <div className="text-[10px] font-bold px-3 py-1 rounded-bl-xl text-white shadow-sm flex items-center gap-1 bg-gradient-to-bl from-blue-500 to-indigo-600 shadow-blue-200 mb-1">
                        <Building2 className="w-3 h-3" />
                        官网直申
                     </div>
                  ) : (job.sourceType === 'rss' || job.sourceType === 'third-party') ? (
                     <div className="text-[10px] font-bold px-3 py-1 rounded-bl-xl text-slate-500 shadow-sm flex items-center gap-1 bg-slate-100 border-l border-b border-slate-200 mb-1">
                        第三方
                     </div>
                  ) : null}
               </div>

            <div className="flex gap-5 items-start">
               {/* Company Logo */}
               <div className="w-16 h-16 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-lg flex-shrink-0 overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-105 relative group/logo">
                  {job.logo ? (
                     <img 
                        src={job.logo} 
                        alt={job.company} 
                        className="w-full h-full object-contain p-1" 
                        onError={(e) => {
                           // Fallback to initial on error
                           const target = e.target as HTMLImageElement;
                           target.style.display = 'none';
                           if (target.parentElement) {
                              const span = document.createElement('span');
                              span.className = 'font-serif italic text-2xl';
                              span.textContent = companyInitial;
                              target.parentElement.appendChild(span);
                           }
                        }}
                     />
                  ) : (
                     <span className="font-serif italic text-2xl">{companyInitial}</span>
                  )}
                  {/* Hover Overlay for Link */}
                  {job.companyWebsite && (
                     <div 
                        onClick={handleCompanyClick}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer backdrop-blur-[1px]"
                        title="访问来源"
                     >
                        <ExternalLink className="w-5 h-5 text-white" />
                     </div>
                  )}
               </div>

               <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div>
                     <div className="flex justify-between items-start gap-3 mb-1">
                        <div className="flex-1 min-w-0">
                           <h3 className={`font-bold text-lg text-slate-900 truncate group-hover:text-indigo-600 transition-colors ${isActive ? 'text-indigo-700' : ''}`}>
                              {job.translations?.title || job.title}
                           </h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span 
                                 className={`text-sm font-medium text-slate-600 truncate max-w-[200px] transition-colors ${job.companyWebsite ? 'hover:text-indigo-600 hover:underline cursor-pointer' : ''}`}
                                 onClick={job.companyWebsite ? handleCompanyClick : undefined}
                              >
                                 {job.translations?.company || job.company}
                              </span>
                           </div>
                        </div>
                        
                        {/* Match Score */}
                        {matchScore !== undefined && matchScore > 0 && (
                           <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                 <span className="text-xs font-bold text-slate-400">匹配度</span>
                                 <span className={`text-sm font-extrabold ${matchScore >= 80 ? 'text-emerald-500' : matchScore >= 60 ? 'text-indigo-500' : 'text-amber-500'}`}>
                                    {matchScore}%
                                 </span>
                              </div>
                           </div>
                        )}
                     </div>

                     {/* Job Tags */}
                     <div className="flex flex-wrap gap-2 mt-2">
                        {/* Job Type Tag */}
                        {job.type && (
                           <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">
                              {job.type === 'full-time' ? '全职' : job.type}
                           </span>
                        )}
                        
                        {/* Category Tag */}
                        {job.category && (
                           <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-md">
                              {job.category}
                           </span>
                        )}

                        {/* Experience Level Tag */}
                        {job.experienceLevel && (
                           <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs font-medium rounded-md">
                              {job.experienceLevel}
                           </span>
                        )}

                        {/* Custom Tags */}
                        {(job.sourceType === 'rss' || job.sourceType === 'third-party') && (
                           <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-md border border-slate-200">
                              第三方
                           </span>
                        )}

                        {job.companyTags && job.companyTags.slice(0, 3).map((tag, i) => (
                           <span key={i} className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-md border border-gray-100 truncate max-w-[100px]">
                              {tag}
                           </span>
                        ))}
                     </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
                     <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span className={`text-sm ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md'}`}>
                           {formatSalary(job.salary)}
                        </span>
                        
                        <div className="flex items-center gap-4 text-slate-400 font-medium">
                           <span className="flex items-center hover:text-indigo-500 transition-colors">
                              <Globe className="w-3.5 h-3.5 mr-1" />
                              {(job.translations?.location || job.location)}
                           </span>
                           <span className="flex items-center">
                              {DateFormatter.formatPublishTime(job.publishedAt)}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div
         onClick={() => onClick?.(job)}
         className={`group relative bg-white rounded-2xl p-6 border border-slate-100 hover:border-indigo-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer overflow-hidden ${className || ''}`}
      >
         {/* Top Decoration for Verified Jobs */}
         <div className="absolute top-0 right-0 p-0 flex flex-col items-end pointer-events-none">
            {job.canRefer ? (
               <div className="bg-gradient-to-bl from-amber-400 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1 pointer-events-auto mb-1">
                  <Sparkles className="w-3 h-3" />
                  内推
               </div>
            ) : job.isTrusted ? (
               <div className="bg-gradient-to-bl from-blue-500 to-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1 pointer-events-auto mb-1">
                  <Building2 className="w-3 h-3" />
                  官网直申
               </div>
            ) : (job.sourceType === 'rss' || job.sourceType === 'third-party') ? (
               <div className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1 pointer-events-auto border-l border-b border-slate-200 mb-1">
                  第三方
               </div>
            ) : null}
         </div>

         <div className="flex flex-col h-full">
            {/* Header Section */}
            <div className="flex items-start gap-4 mb-5">
               {/* Company Logo */}
               <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl shadow-inner flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  {job.logo ? (
                     <img 
                        src={job.logo} 
                        alt={job.company} 
                        className="w-full h-full object-contain p-1" 
                        onError={(e) => {
                           const target = e.target as HTMLImageElement;
                           target.style.display = 'none';
                           if (target.parentElement) {
                              target.parentElement.classList.remove('bg-white');
                              target.parentElement.classList.add('bg-gradient-to-br', 'from-slate-50', 'to-slate-100');
                              const span = document.createElement('span');
                              span.className = 'font-serif italic';
                              span.textContent = companyInitial;
                              target.parentElement.appendChild(span);
                           }
                        }}
                     />
                  ) : (
                     <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                        <span className="font-serif italic">{companyInitial}</span>
                     </div>
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

            {/* Job Description Summary - Prioritize translation */}
            {(() => {
               // Generate job summary
               const getJobSummary = (): string => {
                  // Try translated description first
                  const descToUse = job.translations?.description || job.description

                  if (descToUse) {
                     const cleanText = stripMarkdown(descToUse)

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
               {(job.sourceType === 'rss' || job.sourceType === 'third-party') && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200">
                     第三方
                  </span>
               )}
               <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-100 max-w-[200px] truncate" title={job.location}>
                  <Globe className="w-3 h-3 mr-1.5 text-indigo-500 flex-shrink-0" />
                  {(job.translations?.location || job.location)}
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
                  <p className="font-bold text-slate-900">{DateFormatter.formatPublishTime(job.publishedAt)}</p>
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
