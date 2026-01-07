
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

      return tags.slice(0, 5); // Reduce max tags for cleaner look
   }, [job.skills, (job as any).tags, job.companyTags]);

   // Common Logo Component
   const CompanyLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
      const sizeClasses = {
         sm: 'w-10 h-10 p-1.5',
         md: 'w-12 h-12 p-2',
         lg: 'w-14 h-14 p-2'
      };

      return (
         <div className={`${sizeClasses[size]} flex-shrink-0 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden relative group-hover:border-indigo-100 transition-colors`}>
            {job.logo ? (
               <img
                  src={job.logo}
                  alt={job.company}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                     const target = e.target as HTMLImageElement;
                     target.style.display = 'none';
                     if (target.parentElement) {
                        target.parentElement.classList.add('bg-indigo-50');
                        target.parentElement.innerHTML = `<span class="text-indigo-500 font-bold text-lg">${companyInitial}</span>`;
                     }
                  }}
               />
            ) : (
               <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-bold text-lg">
                  {companyInitial}
               </div>
            )}
         </div>
      );
   };

   if (variant === 'list') {
      return (
         <>
            <div
               onClick={() => onClick?.(job)}
               className={`group relative bg-white rounded-lg mb-3 border transition-all duration-200 cursor-pointer overflow-hidden
               ${isActive
                     ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-sm'
                     : 'border-slate-200 hover:border-indigo-400 hover:shadow-md'
                  } ${className || ''}`}
               id={`job-card-${job.id}`}
            >
               <div className="flex flex-col sm:flex-row p-4 gap-4 items-start sm:items-center">
                  {/* Left: Logo */}
                  <div className="hidden sm:block">
                     <CompanyLogo size="md" />
                  </div>

                  {/* Middle: Content */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                     {/* Title Row */}
                     <div className="flex items-center gap-2">
                        <h3 className={`text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 ${isActive ? 'text-indigo-700' : ''}`} title={job.translations?.title || job.title}>
                           {job.translations?.title || job.title}
                        </h3>
                        {isTranslated && (
                           <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-[10px] text-slate-500" title="已翻译">
                              译
                           </span>
                        )}
                        {/* Mobile Date */}
                        <span className="sm:hidden ml-auto text-xs text-slate-400 font-medium whitespace-nowrap">
                           {DateFormatter.formatPublishTime(job.publishedAt)}
                        </span>
                     </div>

                     {/* Company & Location Row */}
                     <div className="flex items-center text-sm text-slate-500 gap-3">
                        <span className="font-medium text-slate-700 truncate max-w-[200px]" title={job.translations?.company || job.company}>
                           {job.translations?.company || job.company}
                        </span>
                        
                        <div className="hidden sm:flex items-center gap-1 truncate text-xs">
                           <MapPin className="w-3 h-3 flex-shrink-0" />
                           <span className="truncate max-w-[150px]">{job.translations?.location || job.location}</span>
                        </div>
                     </div>

                     {/* Tags Row - Clean & Minimal */}
                     <div className="flex flex-wrap items-center gap-2">
                        {/* Job Type Badge */}
                        {job.type && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
                              {job.type === 'full-time' ? '全职' : job.type}
                           </span>
                        )}
                        
                        {/* Category Badge */}
                        {job.category && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
                              {job.category}
                           </span>
                        )}

                        {/* First 2 Tags only to avoid clutter */}
                        {displayTags.slice(0, 2).map((tag, i) => (
                           <span
                              key={i}
                              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-500 bg-white border border-slate-100"
                           >
                              {tag.text}
                           </span>
                        ))}
                     </div>
                  </div>

                  {/* Right: Salary & Action */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-2 sm:gap-1 mt-2 sm:mt-0 pl-0 sm:pl-4 border-t sm:border-t-0 border-slate-50 pt-3 sm:pt-0">
                      {/* Mobile Location (moved here to balance) */}
                      <div className="flex sm:hidden items-center gap-1 text-xs text-slate-500 truncate mr-auto">
                           <MapPin className="w-3 h-3 flex-shrink-0" />
                           <span className="truncate max-w-[120px]">{job.translations?.location || job.location}</span>
                      </div>

                      {/* Salary */}
                      <div className={`text-sm sm:text-base ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-slate-900'}`}>
                           {formatSalary(job.salary)}
                     </div>

                     {/* Date (Desktop) */}
                     <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
                        {DateFormatter.formatPublishTime(job.publishedAt)}
                     </span>
                     
                     {/* View Button (Hover) */}
                     <div className="hidden group-hover:flex items-center gap-1 text-indigo-600 text-xs font-bold transition-all mt-1">
                         View <ChevronRight className="w-3 h-3" />
                     </div>
                  </div>
               </div>
               
               {/* Share Button (List) */}
               <button
                  onClick={handleShare}
                  className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  title="分享职位"
               >
                  <Share2 className="w-4 h-4" />
               </button>
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

   // Grid Variant (Cleaned up)
   return (
      <>
         <div
            onClick={() => onClick?.(job)}
            className={`group relative bg-white rounded-xl p-5 border transition-all duration-200 cursor-pointer
            ${className || ''}
            border-slate-200 hover:border-indigo-300 hover:shadow-lg h-full flex flex-col`}
         >
            {/* Share Button */}
            <button
               onClick={(e) => {
                  e.stopPropagation();
                  handleShare(e);
               }}
               className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
               title="分享职位"
            >
               <Share2 className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
               <CompanyLogo size="md" />
               <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1" title={job.translations?.title || job.title}>
                     {job.translations?.title || job.title}
                  </h3>
                  <div className="flex items-center text-xs text-slate-500 font-medium">
                     <span className="text-slate-700 truncate mr-2 max-w-[120px]">{job.translations?.company || job.company}</span>
                     <MapPin className="w-3 h-3 mr-1 text-slate-400 flex-shrink-0" />
                     <span className="truncate max-w-[80px]">{job.translations?.location || job.location}</span>
                  </div>
               </div>
            </div>

            {/* Tags (Inline) */}
            <div className="flex flex-wrap gap-1.5 mb-4">
               {job.type && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
                     {job.type === 'full-time' ? '全职' : job.type}
                  </span>
               )}
               {displayTags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] text-slate-500 bg-white border border-slate-100">
                     {tag.text}
                  </span>
               ))}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
               <div className={`text-sm ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-slate-900'}`}>
                  {formatSalary(job.salary)}
               </div>
               <span className="text-xs text-slate-400 font-medium">
                  {DateFormatter.formatPublishTime(job.publishedAt)}
               </span>
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
