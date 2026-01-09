
import React, { useMemo } from 'react';
import { MapPin, Clock, Calendar, ArrowUpRight, ChevronDown } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { getJobSourceType } from '../utils/job-source-helper';



interface JobCardNewProps {
   job: Job;
   onClick?: (job: Job) => void;
   matchScore?: number; // Personalized match score (0-100)
   className?: string;
   variant?: 'grid' | 'list';
   isActive?: boolean;
}

export default function JobCardNew({ job, onClick, className, variant = 'grid', isActive = false }: JobCardNewProps) {
   // const navigate = useNavigate();
   // const sourceType = getJobSourceType(job);
   const isTranslated = !!job.translations?.title;
   
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
   const CompanyLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
      const sizeClasses = {
         sm: 'w-10 h-10 p-1.5',
         md: 'w-12 h-12 p-2',
         lg: 'w-14 h-14 p-2',
         xl: 'w-20 h-20 p-3'
      };

      return (
         <div className={`${sizeClasses[size]} flex-shrink-0 bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden relative group-hover:border-indigo-100 transition-colors shadow-sm`}>
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
                        target.parentElement.innerHTML = `<span class="text-indigo-500 font-bold text-xl">${companyInitial}</span>`;
                     }
                  }}
               />
            ) : (
               <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-bold text-xl">
                  {companyInitial}
               </div>
            )}
         </div>
      );
   };

   if (variant === 'list') {
      const isNew = new Date(job.publishedAt).getTime() > Date.now() - 3 * 24 * 60 * 60 * 1000;

      return (
         <div
            onClick={() => onClick?.(job)}
            className={`group relative bg-white rounded-2xl mb-4 border transition-all duration-200 cursor-pointer overflow-hidden
            ${isActive
                  ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-md'
                  : 'border-slate-100 hover:border-indigo-300 hover:shadow-lg'
               } ${className || ''}`}
            id={`job-card-${job.id}`}
         >
            <div className="flex flex-col md:flex-row p-6 gap-6 items-start">
               {/* Left: Logo (Large Box) */}
               <div className="hidden md:block flex-shrink-0">
                  <CompanyLogo size="xl" />
               </div>

               {/* Middle: Content */}
               <div className="flex-1 min-w-0 flex flex-col">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                     {/* Job Type */}
                     {job.type && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100/50">
                           <Calendar className="w-3 h-3 mr-1" />
                           {job.type === 'full-time' ? '全职' : job.type}
                        </span>
                     )}
                     
                     {/* Category */}
                     {job.category && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                           <MapPin className="w-3 h-3 mr-1" />
                           {job.category}
                        </span>
                     )}

                     {/* New Badge */}
                     {isNew && (
                        <span className="text-xs font-bold text-rose-500 ml-1 animate-pulse">
                           New
                        </span>
                     )}
                  </div>

                  {/* Title */}
                  <div className="flex items-center gap-2 mb-2">
                     <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1" title={job.translations?.title || job.title}>
                        {job.translations?.title || job.title}
                     </h3>
                     {isTranslated && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] text-slate-500" title="已翻译">
                           译
                        </span>
                     )}
                  </div>

                  {/* Meta Info Row */}
                  <div className="flex flex-wrap items-center text-sm text-slate-500 gap-4 mb-4">
                     {/* Company Name (Mobile/Tablet or consistent display) */}
                     <span className="font-medium text-slate-700" title={job.translations?.company || job.company}>
                        {job.translations?.company || job.company}
                     </span>
                     
                     <div className="hidden sm:flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="truncate max-w-[200px]">{job.translations?.location || job.location}</span>
                     </div>

                     <div className="hidden sm:flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{DateFormatter.formatPublishTime(job.publishedAt)}</span>
                     </div>
                  </div>

                  {/* Skills Tags (Pill Shape) */}
                  <div className="flex flex-wrap items-center gap-2 mt-auto">
                     {displayTags.map((tag, i) => (
                        <span
                           key={i}
                           className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                           {tag.text}
                        </span>
                     ))}
                  </div>
               </div>

               {/* Right: Salary & Action */}
               <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 md:pl-6 md:border-l md:border-slate-50 min-w-[140px]">
                   {/* Mobile Logo (visible only on mobile) */}
                   <div className="md:hidden">
                       <CompanyLogo size="md" />
                   </div>

                   <div className="flex flex-col items-end gap-1">
                       {/* Salary */}
                       <div className={`text-lg md:text-xl whitespace-nowrap ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-slate-900'}`}>
                            {formatSalary(job.salary)}
                      </div>
                      <div className="text-xs text-slate-400">
                         {job.type === 'contract' || job.type === 'freelance' ? '/hr' : '/year'} (est.)
                      </div>
                   </div>

                   {/* Action Button */}
                   <button className="hidden md:flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors shadow-sm hover:shadow group-hover:scale-105 transform duration-200">
                      View job
                      <ArrowUpRight className="w-4 h-4" />
                   </button>

                   {/* Mobile View Button (Simple) */}
                   <div className="md:hidden">
                      <ArrowUpRight className="w-6 h-6 text-slate-900" />
                   </div>

                   {/* Expand Details (Desktop) */}
                   <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 mt-auto hover:text-indigo-600 transition-colors pt-4">
                      Expand details
                      <ChevronDown className="w-3 h-3" />
                   </div>
               </div>
            </div>
         </div>
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
      </>
   );
}
