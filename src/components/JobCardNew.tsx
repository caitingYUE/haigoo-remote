
import React, { useMemo, useState } from 'react';
import { MapPin, ChevronRight, Sparkles, Check, Share2, Gem, Clock } from 'lucide-react';
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
               className={`group relative bg-white rounded-xl mb-3 border transition-all duration-300
               ${isActive
                     ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-md'
                     : 'border-slate-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5'
                  } ${className || ''}`}
            >
               <div className="flex flex-col sm:flex-row p-4 gap-4">
                  {/* Left: Company Logo & Name (Redesigned like Fig 2) */}
                  <div className="hidden sm:flex flex-col items-center justify-center w-28 h-28 flex-shrink-0 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden relative group-hover:border-indigo-100 transition-colors">
                     {job.logo ? (
                        <>
                           <div className="flex-1 w-full flex items-center justify-center p-2">
                              <img
                                 src={job.logo}
                                 alt={job.company}
                                 className="max-w-full max-h-full object-contain"
                                 onError={(e) => {
                                    // Fallback if image fails
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement?.classList.add('hidden');
                                    // Logic to show text fallback is handled by parent state or conditional rendering, 
                                    // but here simpler to just hide img and let text show? 
                                    // Actually, let's keep it simple: if error, hide img.
                                 }}
                              />
                           </div>
                           <span className="text-xs font-bold text-slate-700 text-center w-full px-1 pb-2 truncate" title={job.translations?.company || job.company}>
                              {job.translations?.company || job.company}
                           </span>
                        </>
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-50/30 p-2 text-center">
                           <span className="font-serif italic font-bold text-slate-800 text-lg leading-tight line-clamp-3 break-words" title={job.translations?.company || job.company}>
                              {job.translations?.company || job.company}
                           </span>
                        </div>
                     )}
                  </div>

                  {/* Middle: Main Content */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 relative py-1">
                     <div>
                        {/* Top Row: Tags (Job Type, Category) */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                           {/* Job Type */}
                           {job.type && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                 <Clock className="w-3 h-3" />
                                 {job.type === 'full-time' ? '全职' : job.type}
                              </span>
                           )}

                           {/* Category - Improved Style (Fig 2) */}
                           {job.category && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                 <Gem className="w-3 h-3" />
                                 {job.category}
                              </span>
                           )}

                           {/* Source Badges */}
                           {sourceType === 'referral' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-600">
                                 官方内推
                              </span>
                           )}
                        </div>

                        {/* Title */}
                        <div className="flex items-center gap-2 mb-1.5">
                           <h3 className={`text-lg font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1 ${isActive ? 'text-indigo-700' : ''}`} title={job.translations?.title || job.title}>
                              {job.translations?.title || job.title}
                           </h3>
                           {isTranslated && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] text-slate-500 font-serif" title="已翻译">
                                 译
                              </span>
                           )}
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                           <div className="flex items-center">
                              <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              <span className="truncate max-w-[200px] font-medium">{job.translations?.location || job.location}</span>
                           </div>

                           {(job.companyIndustry || (job as any).industry) && (
                              <div className="flex items-center">
                                 <span className="w-1 h-1 rounded-full bg-slate-300 mr-2"></span>
                                 <span>{(job.companyIndustry || (job as any).industry)}</span>
                              </div>
                           )}
                           
                           {/* Mobile Company Name */}
                           <div className="sm:hidden flex items-center">
                                <span className="w-1 h-1 rounded-full bg-slate-300 mr-2"></span>
                                <span className="font-medium text-slate-700">{job.translations?.company || job.company}</span>
                           </div>
                        </div>
                     </div>

                     {/* Bottom Row: Tags (Skills/Benefits) */}
                     {displayTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                           {displayTags.map((tag, i) => (
                              <span
                                 key={i}
                                 className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-transparent hover:bg-slate-200 transition-colors"
                              >
                                 {tag.text}
                              </span>
                           ))}
                        </div>
                     )}
                  </div>

                  {/* Right: Salary, Date & Action */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center min-w-[140px] pl-4 border-l border-slate-100 border-dashed sm:border-l-0 sm:pl-0 gap-1">
                     {/* Salary */}
                     <div className="text-right">
                        <div className={`text-lg leading-tight ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-bold' : 'font-extrabold text-slate-900'}`}>
                           {formatSalary(job.salary)}
                        </div>
                     </div>
                     
                     {/* Publish Date (Moved here) */}
                     <div className="text-[10px] text-slate-400 font-medium mt-1 mb-1">
                        {DateFormatter.formatPublishTime(job.publishedAt)}
                     </div>
                     
                     {matchScore !== undefined && matchScore > 0 && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                           <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
                           <span className="text-xs font-bold text-amber-600">
                              {matchScore}%
                           </span>
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
                  <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden shadow-sm flex-shrink-0 relative group-hover:border-indigo-100 transition-colors">
                     {job.logo ? (
                        <img
                           src={job.logo}
                           alt={job.company}
                           className="w-full h-full object-contain p-1.5"
                           onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              // No text fallback here as it might be too small, or we can use the same logic?
                              // Grid logo is 48x48 (w-12), List logo is 112x112 (w-28).
                              // For 48x48, full text is too small. Initial is better.
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
                     {/* Date (Top Row) */}
                     <div className="flex items-center justify-end mb-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                           {DateFormatter.formatPublishTime(job.publishedAt)}
                        </span>
                     </div>

                     <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1" title={job.translations?.title || job.title}>
                        {job.translations?.title || job.title}
                     </h3>

                     {/* Tags Row (Moved Below Title) */}
                     <div className="flex items-center gap-2 mb-2">
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

                     <div className="flex items-center text-xs text-slate-500 font-medium truncate">
                        <span className="text-slate-700 mr-2">{job.translations?.company || job.company}</span>
                        <MapPin className="w-3 h-3 mr-1 text-slate-400" />
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
