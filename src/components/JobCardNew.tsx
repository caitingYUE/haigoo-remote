
import React, { useMemo, useState, useEffect } from 'react';
import { MapPin, Clock, Calendar, Building2, Briefcase, TrendingUp, Trash2, Zap } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { getJobSourceType } from '../utils/job-source-helper';

const EXPERIENCE_LEVEL_MAP: Record<string, string> = {
   'Entry': '初级',
   'entry': '初级',
   'Mid': '中级',
   'mid': '中级',
   'Senior': '高级',
   'senior': '高级',
   'Lead': '专家',
   'lead': '专家',
   'Executive': '高管',
   'executive': '高管'
};

const JOB_TYPE_MAP: Record<string, string> = {
   'full-time': '全职',
   'Full-time': '全职',
   'part-time': '兼职',
   'Part-time': '兼职',
   'contract': '合同',
   'Contract': '合同',
   'freelance': '自由职业',
   'Freelance': '自由职业',
   'internship': '实习',
   'Internship': '实习',
   'remote': '远程',
   'Remote': '远程'
};
// import { FastAverageColor } from 'fast-average-color'; // Optional: Use if installed

interface JobCardNewProps {
   job: Job;
   onClick?: (job: Job) => void;
   onDelete?: (jobId: string) => void;
   matchScore?: number; // Personalized match score (0-100)
   className?: string;
   variant?: 'grid' | 'list';
   isActive?: boolean;
}

// Simple hash function to generate a stable pastel color from string
const getPastelColor = (str: string) => {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
   }
   
   // Generate HSL color with high lightness and low saturation for pastel look
   // Use hash to pick Hue (0-360)
   const h = Math.abs(hash) % 360;
   // Saturation 60-80%
   const s = 70 + (Math.abs(hash) % 20);
   // Lightness 90-96% (Very light background)
   const l = 93 + (Math.abs(hash) % 5);
   
   return `hsl(${h}, ${s}%, ${l}%)`;
};

// Generate matching text color (darker version of the same hue)
const getDarkerColor = (str: string) => {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
   }
   const h = Math.abs(hash) % 360;
   return `hsl(${h}, 70%, 30%)`;
};

export default function JobCardNew({ job, onClick, onDelete, className, variant = 'grid', isActive = false }: JobCardNewProps) {
   // const navigate = useNavigate();
   // const sourceType = getJobSourceType(job);
   const isTranslated = !!job.translations?.title;
   
   // Check if job is new (published within 3 days)
   const isNew = useMemo(() => {
      if (!job.publishedAt) return false;
      try {
         const pubDate = new Date(job.publishedAt);
         const threeDaysAgo = new Date();
         threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
         return !isNaN(pubDate.getTime()) && pubDate >= threeDaysAgo;
      } catch (e) {
         return false;
      }
   }, [job.publishedAt]);
   
   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   // Dynamic Background Color Logic
   const bgColor = useMemo(() => getPastelColor(job.company || 'default'), [job.company]);
   const textColor = useMemo(() => getDarkerColor(job.company || 'default'), [job.company]);

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

   // Redesigned Company Logo Component
   // Matching reference: Large card style, dynamic background, centered logo, company name above
   const CompanyCard = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
      
      return (
         <div 
            className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-4 rounded-xl transition-colors h-full w-[140px] relative overflow-hidden"
            style={{ backgroundColor: bgColor }}
         >
             {/* Company Name (Top) */}
            <div 
               className="text-base font-bold text-center mb-2 line-clamp-2 w-full leading-snug break-words"
               style={{ color: textColor }}
               title={job.translations?.company || job.company}
            >
               {job.translations?.company || job.company}
            </div>

            {/* Logo (Centered) */}
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center p-3 overflow-hidden">
               {job.logo ? (
                  <img
                     src={job.logo}
                     alt={job.company}
                     className="w-full h-full object-contain"
                     onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                           target.parentElement.innerHTML = `<span class="text-3xl font-bold" style="color:${textColor}">${companyInitial}</span>`;
                        }
                     }}
                  />
               ) : (
                  <span className="text-3xl font-bold" style={{ color: textColor }}>{companyInitial}</span>
               )}
            </div>
         </div>
      );
   };

   // Legacy Small Logo (for mobile or specific variants if needed)
   const CompanyLogoSmall = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
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
      return (
         <div
            onClick={() => onClick?.(job)}
            className={`group relative bg-white rounded-xl mb-3 border transition-all duration-200 cursor-pointer overflow-hidden
            ${isActive
                  ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-md'
                  : 'border-slate-100 hover:border-indigo-300 hover:shadow-md'
               } ${className || ''}`}
            id={`job-card-${job.id}`}
         >
            <div className="flex flex-col md:flex-row p-4 gap-4 items-stretch">
               {/* Left: New Company Card Style (Desktop Only) */}
               <div className="hidden md:block flex-shrink-0 self-stretch">
                  <CompanyCard />
               </div>

               {/* Mobile Logo (Fallback to old style) */}
               <div className="md:hidden flex-shrink-0 self-start">
                  <CompanyLogoSmall size="md" />
               </div>

               {/* Content Area */}
               <div className="flex-1 min-w-0 flex flex-col gap-2 py-1 relative pr-8">
                  {/* Delete Button (List View) */}
                  {onDelete && (
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(job.id);
                        }}
                        className="absolute right-0 top-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                        title="删除记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                  )}

                  {/* Row 1: Badges & Salary (Desktop) */}
                  <div className="flex items-center justify-between gap-2">
                     <div className="flex flex-wrap items-center gap-2">
                        {/* Job Type (Amber) */}
                        {job.type && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100/50">
                              <Calendar className="w-3 h-3 mr-1" />
                              {JOB_TYPE_MAP[job.type] || job.type}
                           </span>
                        )}

                        {/* Experience Level (Emerald - New) */}
                        {job.experienceLevel && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {EXPERIENCE_LEVEL_MAP[job.experienceLevel] || job.experienceLevel}
                           </span>
                        )}

                        {/* Industry (Purple - Differentiated from Category) */}
                        {job.companyIndustry && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100/50">
                              <Building2 className="w-3 h-3 mr-1" />
                              {job.companyIndustry}
                           </span>
                        )}
                        
                        {/* Category (Blue/Indigo - Role related) */}
                        {job.category && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                              <Briefcase className="w-3 h-3 mr-1" />
                              {job.category}
                           </span>
                        )}
                     </div>

                     {/* Salary (Desktop) */}
                     <div className={`hidden md:block text-base whitespace-nowrap ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-slate-900'}`}>
                        {formatSalary(job.salary)}
                     </div>
                  </div>

                  {/* Row 2: Title */}
                  <div className="flex items-center gap-2 mt-1">
                     <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1" title={job.translations?.title || job.title}>
                        {job.translations?.title || job.title}
                     </h3>
                     {isTranslated && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-[10px] text-slate-500" title="已翻译">
                           译
                        </span>
                     )}
                     {isNew && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                           New
                        </span>
                     )}
                  </div>

                  {/* Row 3: Meta Info */}
                  <div className="flex flex-wrap items-center text-sm text-slate-500 gap-x-6 gap-y-1 mt-1">
                     {/* Company Name (Mobile Only - since desktop has it in the card) */}
                     <span className="font-medium text-slate-700 md:hidden" title={job.translations?.company || job.company}>
                        {job.translations?.company || job.company}
                     </span>
                     
                     <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="truncate max-w-[200px]">{job.translations?.location || job.location}</span>
                     </div>

                     <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{DateFormatter.formatPublishTime(job.publishedAt)}</span>
                     </div>
                  </div>

                  {/* Row 4: Tags & Mobile Salary */}
                  <div className="flex items-center justify-between mt-auto pt-2">
                     <div className="flex flex-wrap items-center gap-2">
                        {displayTags.map((tag, i) => (
                           <span
                              key={i}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 bg-slate-100/80 hover:bg-slate-200 transition-colors"
                           >
                              {tag.text}
                           </span>
                        ))}
                     </div>

                     {/* Salary (Mobile) */}
                     <div className={`md:hidden text-sm whitespace-nowrap ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-slate-900'}`}>
                        {formatSalary(job.salary)}
                     </div>
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
            className={`group relative bg-white rounded-xl p-5 border transition-all duration-200 cursor-pointer shadow-sm
            ${className || ''}
            border-slate-200 hover:border-indigo-400 hover:shadow-xl h-full flex flex-col`}
         >
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
               <CompanyLogoSmall size="md" />
               <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                     <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug" title={job.translations?.title || job.title}>
                        {job.translations?.title || job.title}
                     </h3>
                     {isNew && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                           New
                        </span>
                     )}
                  </div>
                  <div className="flex items-center text-sm text-slate-500 font-medium">
                     <span className="text-slate-700 truncate mr-2 max-w-[140px]">{job.translations?.company || job.company}</span>
                     <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
                     <span className="truncate max-w-[100px]">{job.translations?.location || job.location}</span>
                  </div>
               </div>
            </div>

            {/* Tags (Rich Info Restored) */}
            <div className="flex flex-wrap gap-2 mb-4 content-start">
               {/* Job Type (Amber) */}
               {job.type && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap">
                     <Briefcase className="w-3 h-3 mr-1" />
                     {job.type === 'full-time' ? '全职' : job.type}
                  </span>
               )}
               {/* Experience Level (Emerald) */}
               {job.experienceLevel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     {EXPERIENCE_LEVEL_MAP[job.experienceLevel] || job.experienceLevel}
                  </span>
               )}
               {/* Industry (Purple) */}
               {job.companyIndustry && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap max-w-[140px] truncate">
                     <Building2 className="w-3 h-3 mr-1" />
                     {job.companyIndustry}
                  </span>
               )}
               {/* Category (Blue/Indigo - Role related) */}
               {job.category && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap max-w-[140px] truncate">
                     <Zap className="w-3 h-3 mr-1" />
                     {job.category}
                  </span>
               )}
               {/* Skill Tags (Restored - First 3) */}
               {displayTags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-1 rounded text-xs text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap max-w-[100px] truncate">
                     {tag.text}
                  </span>
               ))}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
               <div className={`text-base ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400 font-medium' : 'font-bold text-indigo-600'}`}>
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
