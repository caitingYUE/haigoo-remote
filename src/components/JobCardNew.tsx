
import React, { useMemo, useState } from 'react';
import { Briefcase, Globe, ChevronRight, Sparkles, Check, Target, Share2 } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { stripMarkdown } from '../utils/text-formatter';
import { MemberBadge } from './MemberBadge';
import { getJobSourceType } from '../utils/job-source-helper';
import { trackingService } from '../services/tracking-service';
import { ShareJobModal } from './ShareJobModal';


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
   const isTranslated = !!job.translations?.title;
   const [showCopied, setShowCopied] = useState(false);
   const [isShareModalOpen, setIsShareModalOpen] = useState(false);

   const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsShareModalOpen(true);
      trackingService.track('click_share_button', { jobId: job.id, from: 'card' });
   };

   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   const formatSalary = (salary: Job['salary']) => {
      // Handle missing/zero cases
      if (!salary) return '薪资Open';

      // Handle string type (New format or legacy string)
      if (typeof salary === 'string') {
         if (salary === '0' || salary === 'null' || salary === 'Open' || salary === '0-0') return '薪资Open';
         // Try parsing JSON string if it looks like one
         if (salary.trim().startsWith('{')) {
            try {
               const parsed = JSON.parse(salary);
               if (typeof parsed === 'object') return formatSalary(parsed);
            } catch (e) {
               // ignore
            }
         }
         return salary;
      }

      // Handle object type (Legacy format)
      if (salary.min === 0 && salary.max === 0) return '薪资Open';

      const formatAmount = (amount: number) => {
         // Safety check: if amount is null/undefined/NaN, return '0' or empty string
         if (amount === null || amount === undefined || isNaN(amount)) return '0';

         if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
         return amount.toString();
      };
      const currencySymbol = salary.currency === 'CNY' ? '¥' :
         salary.currency === 'USD' ? '$' :
            salary.currency === 'EUR' ? '€' :
               salary.currency === 'GBP' ? '£' :
                  (salary.currency || '');

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

      // 1. Merge and deduplicate tags for display (Common for both variants)
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

      if (variant === 'list') {

         return (
            <>
               <div
                  onClick={() => onClick?.(job)}
                  className={`group relative bg-white rounded-xl mb-4 border transition-all duration-300
               ${isActive
                        ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-md'
                        : 'border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5'
                     } ${className || ''}`}
               >
                  <div className="flex flex-col sm:flex-row p-6 gap-6">
                     {/* Left: Company Logo & Name (Distinct Area) */}
                     <div className="hidden sm:flex flex-col items-center justify-start pt-1 w-24 flex-shrink-0 gap-2">
                        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300">
                           {job.logo ? (
                              <img
                                 src={job.logo}
                                 alt={job.company}
                                 className="w-full h-full object-contain p-2"
                                 onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    if (target.parentElement) {
                                       const span = document.createElement('span');
                                       span.className = 'font-serif italic text-2xl text-slate-400';
                                       target.parentElement.appendChild(span);
                                    }
                                 }}
                              />
                           ) : (
                              <span className="font-serif italic text-2xl text-slate-400">{companyInitial}</span>
                           )}
                        </div>
                        <span className="text-xs font-bold text-slate-700 text-center leading-tight line-clamp-2" title={job.translations?.company || job.company}>
                           {job.translations?.company || job.company}
                        </span>
                     </div>

                     {/* Middle: Main Content */}
                     <div className="flex-1 flex flex-col gap-2 min-w-0 relative">
                        {/* Top Row: Job Type Badge */}
                        <div className="flex items-center gap-2 mb-1">
                           {job.type && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-600">
                                 {job.type === 'full-time' ? '全职' : job.type}
                              </span>
                           )}

                           {/* Source Badges */}
                           {sourceType === 'referral' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-600">
                                 <Target className="w-3 h-3 mr-1" />
                                 官方内推
                              </span>
                           )}

                           {isTranslated && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-50 text-slate-400 border border-slate-100">
                                 译
                              </span>
                           )}
                        </div>

                        {/* Title (Large & Bold) */}
                        <div className="pr-24"> {/* Padding right to avoid overlap with Date/Salary on mobile if needed, but here Date is top right absolute */}
                           <h3 className={`text-xl font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors ${isActive ? 'text-indigo-700' : ''}`} title={job.translations?.title || job.title}>
                              {job.translations?.title || job.title}
                           </h3>
                        </div>

                        {/* Meta Info (Icon + Text) - Adjusted: Moved Company to left, Removed "Remote" tag */}
                        <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 mt-1">
                           {/* Location (Clean, no extra 'Remote' pill) */}
                           <div className="flex items-center">
                              <Globe className="w-4 h-4 mr-1.5 text-slate-400" />
                              <span className="truncate max-w-[300px] font-medium text-slate-600">{job.translations?.location || job.location}</span>
                           </div>

                           {/* Industry */}
                           {(job.companyIndustry || (job as any).industry) && (
                              <div className="flex items-center">
                                 <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>
                                 <span>{(job.companyIndustry || (job as any).industry)}</span>
                              </div>
                           )}

                           {/* Category */}
                           {job.category && (
                              <div className="flex items-center">
                                 <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>
                                 <span>{job.category}</span>
                              </div>
                           )}
                        </div>

                        {/* Tags (Refined Visuals) */}
                        {displayTags.length > 0 && (
                           <div className="flex flex-wrap gap-2 mt-3">
                              {displayTags.map((tag, i) => (
                                 <span
                                    key={i}
                                    className="inline-flex items-center px-3 py-1 rounded-md bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100 hover:bg-slate-100 transition-colors"
                                 >
                                    {tag.text}
                                 </span>
                              ))}
                           </div>
                        )}
                     </div>

                     {/* Right: Salary & Date (Absolute positioning or Flex column) */}
                     <div className="flex flex-col items-end justify-between min-w-[120px] pl-4 border-l border-slate-100 border-dashed sm:border-l-0 sm:pl-0">
                        {/* Top Right: Date */}
                        <div className="text-xs text-slate-400 font-medium mb-auto">
                           {DateFormatter.formatPublishTime(job.publishedAt)}
                        </div>

                        {/* Bottom Right: Salary */}
                        <div className="text-right mt-4 sm:mt-0">
                           <div className={`text-lg sm:text-xl leading-none ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-bold' : 'font-extrabold text-slate-900'}`}>
                              {formatSalary(job.salary)}
                           </div>
                           {matchScore !== undefined && matchScore > 0 && (
                              <div className="flex items-center justify-end gap-1 mt-1.5">
                                 <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                                 <span className="text-xs font-bold text-amber-600">
                                    {matchScore}% 匹配
                                 </span>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
               <ShareJobModal
                  isOpen={isShareModalOpen}
                  onClose={() => setIsShareModalOpen(false)}
                  jobId={job.id}
                  jobTitle={job.translations?.title || job.title}
                  companyName={job.translations?.company || job.company || ''}
               />
            </>
         );
      }

      return (
         <>
            <div
               onClick={() => onClick?.(job)}
               className={`group relative bg-white rounded-2xl p-6 border border-slate-100 hover:border-indigo-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] cursor-pointer overflow-visible ${className || ''}`}
            >
               {/* Share Button (Grid) */}
               {/* Share Button (Grid) - Keep as subtle action */}
               <button
                  onClick={(e) => {
                     e.stopPropagation();
                     handleShare(e);
                  }}
                  className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all z-10"
                  title="分享职位"
               >
                  <Share2 className="w-4 h-4" />
               </button>

               {/* Top Decoration removed as requested to move tags inline */}
               {/* <div className="absolute top-0 right-0 p-0 flex flex-col items-end pointer-events-none">
            ...
         </div> */}

               <div className="flex flex-col h-full">
                  {/* Header Section */}
                  <div className="flex items-start gap-4 mb-4">
                     {/* Company Logo */}
                     <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden shadow-sm flex-shrink-0">
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

                     <div className="flex-1 min-w-0">
                        {/* Job Type & Date Row */}
                        <div className="flex items-center justify-between mb-1">
                           <div className="flex items-center gap-2">
                              {job.type && (
                                 <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {job.type === 'full-time' ? 'Full-time' : job.type}
                                 </span>
                              )}
                              {job.category && (
                                 <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {job.category}
                                 </span>
                              )}
                           </div>
                           <span className="text-[10px] text-slate-400 font-medium">
                              {DateFormatter.formatPublishTime(job.publishedAt)}
                           </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1" title={job.translations?.title || job.title}>
                           {job.translations?.title || job.title}
                        </h3>

                        <div className="flex items-center text-xs text-slate-500 font-medium truncate">
                           <span className="text-slate-700 mr-2">{job.translations?.company || job.company}</span>
                           <Globe className="w-3 h-3 mr-1 text-slate-400" />
                           <span className="truncate max-w-[100px]">{job.translations?.location || job.location}</span>
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

                  {/* Tags Section - Simple & Clean */}
                  <div className="flex flex-wrap gap-1.5 mb-4 max-h-[48px] overflow-hidden">
                     {displayTags.slice(0, 4).map((tag: any, i: number) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-100">
                           {tag.text}
                        </span>
                     ))}
                  </div>

                  {/* Info Grid - Simplified */}
                  <div className="mt-auto pt-4 border-t border-dashed border-slate-100 flex items-end justify-between">
                     <div>
                        <p className="text-xs text-slate-400 mb-0.5">Salary</p>
                        <p className="font-bold text-slate-900 text-lg leading-none">{formatSalary(job.salary)}</p>
                     </div>
                     {matchScore !== undefined && matchScore > 0 && (
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                           <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                           <span className="text-xs font-bold text-amber-700">{matchScore}%</span>
                        </div>
                     )}
                  </div>
               </div>
            </div>
            <ShareJobModal
               isOpen={isShareModalOpen}
               onClose={() => setIsShareModalOpen(false)}
               jobId={job.id}
               jobTitle={job.translations?.title || job.title}
               companyName={job.translations?.company || job.company || ''}
            />
         </>
      );
   }
