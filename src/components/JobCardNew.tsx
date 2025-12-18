
import React, { useMemo } from 'react';
import { Briefcase, Globe, ChevronRight, Sparkles, Building2, ExternalLink, Check } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { stripMarkdown } from '../utils/text-formatter';
import { SingleLineTags } from './SingleLineTags';
import { MemberBadge } from './MemberBadge';

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
      const isTranslated = !!job.translations?.title;

      return (
         <div
            onClick={() => onClick?.(job)}
            className={`group relative p-6 bg-white rounded-2xl mb-4 border transition-all duration-300 cursor-pointer 
               ${isActive
                  ? 'border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10 bg-indigo-50/5'
                  : 'border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-0.5'
               } ${className || ''}`}
         >
            {/* Corner Tag */}
            <div className="absolute top-0 right-0 z-10 flex flex-col items-end">
               {job.canRefer ? (
                  <div
                     className="px-3 py-1.5 rounded-bl-xl rounded-tr-xl text-white shadow-sm flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/20"
                     title="由 Haigoo 审核简历并转递给企业，提高有效曝光率（会员专属）"
                  >
                     <MemberBadge variant="referral" size="sm" className="!border-0 !bg-transparent !text-white !p-0" />
                  </div>
               ) : job.isTrusted ? (
                  <div
                     className="px-3 py-1.5 rounded-bl-xl rounded-tr-xl text-white shadow-sm flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-indigo-500/20"
                     title="通过公司官网直接投递，Haigoo 已人工核实企业真实性"
                  >
                     <MemberBadge variant="verified" size="sm" className="!border-0 !bg-transparent !text-white !p-0" />
                  </div>
               ) : (job.sourceType === 'rss' || job.sourceType === 'third-party') ? (
                  <div
                     className="text-[10px] font-medium px-3 py-1 rounded-bl-xl rounded-tr-xl text-slate-500 shadow-sm flex items-center gap-1 bg-slate-50 border-l border-b border-slate-100"
                     title="来自成熟招聘平台，Haigoo 已确认中国候选人可申请"
                  >
                     可信平台投递
                  </div>
               ) : null}
            </div>

            <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
               <div className="flex gap-5 flex-1">
                  {/* Company Logo */}
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl flex-shrink-0 overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-105 relative group/logo">
                     {job.logo ? (
                        <img
                           src={job.logo}
                           alt={job.company}
                           className="w-full h-full object-contain p-2"
                           onError={(e) => {
                              // Fallback to initial on error
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                 const span = document.createElement('span');
                                 span.className = 'font-serif italic text-lg';
                                 span.textContent = companyInitial;
                                 target.parentElement.appendChild(span);
                              }
                           }}
                        />
                     ) : (
                        <span className="font-serif italic text-lg">{companyInitial}</span>
                     )}
                     {/* Hover Overlay for Link */}
                     {job.companyWebsite && (
                        <div
                           onClick={handleCompanyClick}
                           className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer backdrop-blur-[1px]"
                           title="访问来源"
                        >
                           <ExternalLink className="w-4 h-4 text-white" />
                        </div>
                     )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                     <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-base text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors ${isActive ? 'text-indigo-700' : ''}`} title={job.translations?.title || job.title}>
                           {job.translations?.title || job.title}
                        </h3>
                        {isTranslated && (
                           <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-medium rounded border border-indigo-100 flex-shrink-0">
                              译
                           </span>
                        )}
                     </div>

                     <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span
                           className={`font-medium truncate max-w-[200px] transition-colors ${job.companyWebsite ? 'hover:text-indigo-600 hover:underline cursor-pointer' : ''}`}
                           onClick={job.companyWebsite ? handleCompanyClick : undefined}
                        >
                           {job.translations?.company || job.company}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center truncate" title={job.translations?.location || job.location}>
                           <Globe className="w-3 h-3 mr-1" />
                           {(job.translations?.location || job.location)}
                        </span>
                        <span className="text-slate-300 hidden sm:inline">|</span>
                        <span className="hidden sm:inline">{DateFormatter.formatPublishTime(job.publishedAt)}</span>
                     </div>

                     {/* Job Tags */}
                     <div className="flex flex-wrap gap-1.5 mt-1">
                        {/* Job Type Tag */}
                        {job.type && (
                           <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-medium rounded border border-slate-300">
                              {job.type === 'full-time' ? '全职' : job.type}
                           </span>
                        )}

                        {/* Category Tag */}
                        {job.category && (
                           <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-medium rounded border border-blue-200">
                              {job.category}
                           </span>
                        )}

                        {/* Experience Level Tag */}
                        {job.experienceLevel && (
                           <span className="px-1.5 py-0.5 bg-orange-50 text-orange-800 text-[10px] font-medium rounded border border-orange-200">
                              {job.experienceLevel}
                           </span>
                        )}

                        {/* Language Requirement Tag */}
                        {job.languages && job.languages.length > 0 && (
                           <span className="px-1.5 py-0.5 bg-purple-50 text-purple-800 text-[10px] font-medium rounded border border-purple-200 flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" />
                              {job.languages[0]}
                           </span>
                        )}

                        {job.companyTags && job.companyTags.slice(0, 2).map((tag, i) => (
                           <span key={i} className="px-1.5 py-0.5 bg-slate-50 text-slate-700 text-[10px] rounded border border-slate-200 truncate max-w-[80px]">
                              {tag}
                           </span>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Right Side Info */}
               <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 sm:pl-4 sm:border-l border-t sm:border-t-0 border-slate-100 w-full sm:w-auto min-w-[120px] flex-shrink-0 py-2 sm:py-0 pt-3 sm:pt-0">
                  <div className="sm:hidden text-xs text-slate-400">
                     {DateFormatter.formatPublishTime(job.publishedAt)}
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                     <span className={`text-base ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium text-xs' : 'font-bold text-rose-500'}`}>
                        {formatSalary(job.salary)}
                     </span>

                     {matchScore !== undefined && matchScore > 0 && (
                        <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                           <span className={`text-xs font-extrabold ${matchScore >= 80 ? 'text-emerald-500' : matchScore >= 60 ? 'text-indigo-500' : 'text-amber-500'}`}>
                              {matchScore}% 匹配
                           </span>
                        </div>
                     )}
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
         {/* Top Decoration removed as requested to move tags inline */}
         {/* <div className="absolute top-0 right-0 p-0 flex flex-col items-end pointer-events-none">
            ...
         </div> */}

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
                  <div className="flex flex-col gap-1.5">
                     <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <span>{job.translations?.company || job.company}</span>
                     </div>

                     {/* Source Tag Inline */}
                     <div className="flex items-center gap-2 mt-0.5">
                        {job.canRefer && <MemberBadge variant="referral" size="sm" />}
                        {job.isTrusted && !job.canRefer && <MemberBadge variant="verified" size="sm" />}
                        {(job.sourceType === 'rss' || job.sourceType === 'third-party') && !job.isTrusted && !job.canRefer && (
                           <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              可信平台投递
                           </div>
                        )}
                     </div>
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
               {/* {(job.sourceType === 'rss' || job.sourceType === 'third-party') && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200">
                     第三方
                  </span>
               )} */}
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
