
import React, { useMemo } from 'react';
import { Briefcase, Globe, ChevronRight, Sparkles, Check, Target } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { stripMarkdown } from '../utils/text-formatter';
import { MemberBadge } from './MemberBadge';
import { getJobSourceType } from '../utils/job-source-helper';


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
   const sourceType = getJobSourceType(job);

   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   const formatSalary = (salary: Job['salary']) => {
      if (!salary || (salary.min === 0 && salary.max === 0)) return '薪资Open';
      const formatAmount = (amount: number) => {
         // Safety check: if amount is null/undefined/NaN, return '0' or empty string
         if (amount === null || amount === undefined || isNaN(amount)) return '0';
         
         if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
         return amount.toString();
      };
      const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : salary.currency;
      
      // Safety checks for min/max
      const min = salary.min || 0;
      const max = salary.max || 0;
      
      if (min === max) return `${currencySymbol}${formatAmount(min)}`;
      return `${currencySymbol}${formatAmount(min)} - ${currencySymbol}${formatAmount(max)}`;
   };

   // Handle company website click
   // const handleCompanyClick = (e: React.MouseEvent) => {
   //    e.stopPropagation();
   //    // Strict: Only use companyWebsite from backend (trusted_companies)
   //    const url = job.companyWebsite;
   //    if (url) {
   //       window.open(url, '_blank', 'noopener,noreferrer');
   //    }
   // };

   if (variant === 'list') {
      const isTranslated = !!job.translations?.title;
      
      // Merge and deduplicate tags for display
      const displayTags = useMemo(() => {
         const tags: { text: string; type: 'skill' | 'benefit' | 'other' }[] = [];
         
         // 1. Skills (Priority)
         if (job.skills && job.skills.length > 0) {
            job.skills.slice(0, 5).forEach(skill => tags.push({ text: skill, type: 'skill' }));
         } else if ((job as any).tags && (job as any).tags.length > 0) {
            // Fallback to 'tags' field if skills is empty
            (job as any).tags.slice(0, 5).forEach((tag: string) => tags.push({ text: tag, type: 'skill' }));
         }

         // 2. Company Tags (Benefits/Culture)
         if (job.companyTags && job.companyTags.length > 0) {
            job.companyTags.slice(0, 3).forEach(tag => tags.push({ text: tag, type: 'benefit' }));
         }

         return tags.slice(0, 8); // Max 8 tags total
      }, [job.skills, (job as any).tags, job.companyTags]);

      return (
         <div
            onClick={() => onClick?.(job)}
            className={`group relative p-5 bg-white rounded-2xl mb-3 border cursor-pointer transition-all duration-200
               ${isActive
                  ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/40 shadow-md'
                  : 'border-slate-100 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5'
               } ${className || ''}`}
         >
            <div className="flex gap-4 items-start">
               {/* Company Logo */}
               <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl flex-shrink-0 overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 relative">
                  {job.logo ? (
                     <img
                        src={job.logo}
                        alt={job.company}
                        className="w-full h-full object-contain p-1.5"
                        onError={(e) => {
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
               </div>

               {/* Main Content */}
               <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {/* Row 1: Title & Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                     <h3 className={`font-bold text-lg text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors ${isActive ? 'text-indigo-700' : ''}`} title={job.translations?.title || job.title}>
                        {job.translations?.title || job.title}
                     </h3>
                     
                     {/* Source Badges */}
                     {sourceType === 'referral' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200" title="由 Haigoo 审核简历并转递给企业，提高有效曝光率（会员专属）">
                           <Target className="w-3 h-3" />
                           Haigoo 内推
                        </div>
                     )}
                     {sourceType === 'official' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200" title="通过公司官网直接投递，Haigoo 已人工核实企业真实性">
                           <Sparkles className="w-3 h-3" />
                           企业官网岗位
                        </div>
                     )}
                     {sourceType === 'trusted_platform' && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200" title="来自成熟招聘平台，Haigoo 已确认中国候选人可申请">
                           <Check className="w-3 h-3" />
                           可信平台投递
                        </div>
                     )}
                     
                     {isTranslated && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-medium rounded border border-indigo-100 flex-shrink-0">
                           译
                        </span>
                     )}
                  </div>

                  {/* Row 2: Meta Info (Company | Location | Exp | Degree) */}
                  <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap leading-none">
                     <span className="font-medium text-slate-700 truncate max-w-[200px]">
                        {job.translations?.company || job.company}
                     </span>
                     <span className="text-slate-300">|</span>
                     <span className="flex items-center truncate" title={job.translations?.location || job.location}>
                        {job.isRemote && <Globe className="w-3 h-3 mr-1 text-indigo-500" />}
                        {(job.translations?.location || job.location)}
                     </span>
                     {job.experienceLevel && (
                        <>
                           <span className="text-slate-300">|</span>
                           <span>{job.experienceLevel}</span>
                        </>
                     )}
                     {job.type && (
                         <>
                            <span className="text-slate-300">|</span>
                            <span>{job.type === 'full-time' ? '全职' : job.type}</span>
                         </>
                     )}
                  </div>

                  {/* Row 3: Tags & Skills */}
                  <div className="flex flex-wrap gap-2 mt-1">
                     {/* Category Tag */}
                     {job.category && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                           {job.category}
                        </span>
                     )}
                     
                     {displayTags.map((tag, i) => (
                        <span 
                           key={i} 
                           className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                              ${tag.type === 'skill' 
                                 ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                 : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}
                        >
                           {tag.text}
                        </span>
                     ))}
                  </div>
               </div>

               {/* Right Side: Salary & Date */}
               <div className="flex flex-col items-end justify-between self-stretch py-0.5 min-w-[100px]">
                   <div className="text-xs text-slate-400 font-medium">
                      {DateFormatter.formatPublishTime(job.publishedAt)}
                   </div>
                   
                   <div className="flex flex-col items-end gap-1 mt-auto">
                      <span className={`text-lg leading-tight ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium text-sm' : 'font-bold text-rose-500'}`}>
                         {formatSalary(job.salary)}
                      </span>
                      
                      {matchScore !== undefined && matchScore > 0 && (
                         <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="text-xs font-bold text-amber-700">
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
         className={`group relative bg-white rounded-2xl p-6 border border-slate-100 hover:border-indigo-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] cursor-pointer overflow-visible ${className || ''}`}
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
                     <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {sourceType === 'referral' && (
                           <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200" title="由 Haigoo 审核简历并转递给企业，提高有效曝光率（会员专属）">
                              <Target className="w-3 h-3" />
                              Haigoo 内推
                           </div>
                        )}
                        {sourceType === 'official' && (
                           <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200" title="通过公司官网直接投递，Haigoo 已人工核实企业真实性">
                              <Sparkles className="w-3 h-3" />
                              企业官网岗位
                           </div>
                        )}
                        {sourceType === 'trusted_platform' && (
                           <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200" title="来自成熟招聘平台，Haigoo 已确认中国候选人可申请">
                              <Check className="w-3 h-3" />
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
                     // Safety check for summary
                     if (typeof job.summary !== 'string') return '';
                     
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
