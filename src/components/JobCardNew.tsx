
import React, { useMemo } from 'react';
import { MapPin, Clock, Calendar, Building2, Briefcase, TrendingUp, Trash2, Sparkles, Zap, Crown } from 'lucide-react';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DateFormatter } from '../utils/date-formatter';
import { resolveMatchLevel } from '../utils/match-display';
import { trackingService } from '../services/tracking-service';
// import { getJobSourceType } from '../utils/job-source-helper';

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
   applicationStatusNode?: React.ReactNode;
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

// Match Score Badge
const MatchScoreBadge = ({ score, level, mode = 'pill' }: { score: number, level: string, mode?: 'pill' | 'orb' }) => {
   const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
   const isHigh = level === 'high';
   const title = `简历与该岗位需求匹配度 ${safeScore}%`;

   if (mode === 'orb') {
      return (
         <div
            className={`relative flex h-[88px] w-[88px] items-center justify-center rounded-full border bg-gradient-to-br ${isHigh ? 'from-indigo-50 via-white to-sky-50 border-indigo-200 shadow-[0_12px_28px_rgba(99,102,241,0.18)]' : 'from-sky-50 via-white to-cyan-50 border-sky-200 shadow-[0_12px_28px_rgba(14,165,233,0.16)]'}`}
            title={title}
         >
            <div className={`absolute inset-[7px] rounded-full border ${isHigh ? 'border-indigo-100 bg-white/90' : 'border-sky-100 bg-white/90'}`} />
            <div className="relative flex flex-col items-center justify-center leading-none">
               <span className={`text-[25px] font-bold tracking-tight ${isHigh ? 'text-indigo-700' : 'text-sky-700'}`}>
                  {safeScore}
                  <span className="text-[14px] font-semibold">%</span>
               </span>
               <span className={`mt-1 text-[11px] font-semibold ${isHigh ? 'text-indigo-500' : 'text-sky-500'}`}>匹配</span>
            </div>
         </div>
      );
   }

   return (
      <div 
         className={`flex items-center justify-center min-w-[72px] px-2.5 py-1 rounded-full border shadow-sm ${isHigh ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-sky-700 bg-sky-50 border-sky-100'}`}
         title={title}
      >
         <span className="text-[11px] font-bold whitespace-nowrap leading-none">{safeScore}% 匹配</span>
      </div>
   );
};

export default function JobCardNew({ job, onClick, onDelete, matchScore, className, variant = 'grid', isActive = false, applicationStatusNode }: JobCardNewProps) {
   // const navigate = useNavigate();
   // const sourceType = getJobSourceType(job);
   const { isMember } = useAuth();
   const isTranslated = !!job.translations?.title;

   // Determine if this is a member-only job (Email only, no public URL)
   const isMemberOnlyJob = useMemo(() => {
      const url = String(job.url || '').trim();
      const sourceUrl = String(job.sourceUrl || '').trim();
      const isMailto = (value: string) => value.toLowerCase().startsWith('mailto:');
      const hasPublicApplyLink = [url, sourceUrl].some(link => !!link && !isMailto(link));
      const hasEmailApply = !!String(job.hiringEmail || '').trim() || isMailto(url) || isMailto(sourceUrl);
      return hasEmailApply && !hasPublicApplyLink;
   }, [job.hiringEmail, job.url, job.sourceUrl]);

   // Label text based on membership status
   const memberLabel = isMember ? '会员专属' : '仅会员';
   const MemberBadge = () => (
      <div className={`absolute top-0 left-0 w-full ${isMember ? 'bg-indigo-600/95' : 'bg-indigo-600/95'} backdrop-blur-[2px] text-white text-[9px] font-bold text-center py-0.5 z-10 flex items-center justify-center gap-0.5`}>
         {isMember && <Crown className="w-2 h-2" />}
         {memberLabel}
      </div>
   );
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

   const isFeatured = job.isFeatured;
   const resolvedMatchLevel = useMemo(() => {
      const raw = Number(matchScore ?? job.matchScore ?? job.recommendationScore ?? 0);
      return resolveMatchLevel(raw, job.matchLevel);
   }, [job, matchScore]);

   const rawScoreNum = Math.round(Number(matchScore ?? job.matchScore ?? job.recommendationScore ?? 0));

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
      if (salary.min === 0 && salary.max === 0) {
         // Check if there is a display string (from legacy service mapping)
         const display = (salary as any).display;
         if (display && typeof display === 'string' && display !== '0') return display;
         return '薪资Open';
      }

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
      const legacyTags = (job as any).tags;

      // 1. Skills (Priority)
      if (job.skills && job.skills.length > 0) {
         job.skills.slice(0, 5).forEach(skill => {
            if (skill.length < 15 && !skill.includes('年以上')) {
               tags.push({ text: skill, type: 'skill' });
            }
         });
      } else if (legacyTags && legacyTags.length > 0) {
         // Fallback to 'tags' field if skills is empty
         legacyTags.slice(0, 5).forEach((tag: string) => {
            if (tag.length < 15 && !tag.includes('年以上')) {
               tags.push({ text: tag, type: 'skill' });
            }
         });
      }

      // 2. Company Tags (Benefits/Culture)
      if (job.companyTags && job.companyTags.length > 0) {
         job.companyTags.slice(0, 3).forEach(tag => {
            if (tag.length < 15) {
               tags.push({ text: tag, type: 'benefit' });
            }
         });
      }

      return tags.slice(0, 5); // Reduce max tags for cleaner look
   }, [job.skills, job.tags, job.companyTags]);

   const salaryText = formatSalary(job.salary);
   const isSalaryOpen = salaryText === '薪资Open' || salaryText === '薪资 Open';

   // Redesigned Company Logo Component
   // Matching reference: Large card style, dynamic background, centered logo, company name above
   const CompanyCard = ({ size: _size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {

      return (
         <div
            className="flex-shrink-0 flex flex-col items-center justify-center px-2 py-3 rounded-xl transition-colors h-full w-full relative overflow-hidden"
            style={{ backgroundColor: bgColor }}
         >
            {/* Featured Badge for Grid View */}
            {isFeatured && variant === 'grid' && (
               <div className="absolute top-0 right-0 bg-gradient-to-bl from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 shadow-sm flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
               </div>
            )}

            {/* Company Name (Top) */}
            <div
               className="flex-shrink-0 text-xs font-bold text-center mb-1.5 line-clamp-2 w-full leading-tight break-words"
               style={{ color: textColor }}
               title={job.translations?.company || job.company}
            >
               {job.translations?.company || job.company}
            </div>

            {/* Logo (Centered) */}
            <div className="relative flex-shrink-0 w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center p-2 overflow-hidden">
               {job.logo ? (
                  <img
                     src={job.logo}
                     alt={job.company}
                     className="w-full h-full object-contain"
                     onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement && !target.dataset.errorHandled) {
                           target.dataset.errorHandled = 'true';
                           const initialSpan = document.createElement('span');
                           initialSpan.className = "text-2xl font-bold";
                           initialSpan.style.color = textColor;
                           initialSpan.textContent = companyInitial;
                           target.parentElement.appendChild(initialSpan);
                        }
                     }}
                  />
               ) : (
                  <span className="text-2xl font-bold" style={{ color: textColor }}>{companyInitial}</span>
               )}

               {/* Email Only Badge */}
               {isMemberOnlyJob && <MemberBadge />}
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
                     if (target.parentElement && !target.dataset.errorHandled) {
                        target.parentElement.classList.add('bg-indigo-50');
                        target.dataset.errorHandled = 'true';
                        const initialSpan = document.createElement('span');
                        initialSpan.className = "text-indigo-500 font-bold text-xl";
                        initialSpan.textContent = companyInitial;
                        target.parentElement.appendChild(initialSpan);
                     }
                  }}
               />
            ) : (
               <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-bold text-xl">
                  {companyInitial}
               </div>
            )}

            {/* Email Only Badge */}
            {isMemberOnlyJob && (
               <div className={`absolute top-0 left-0 w-full ${isMember ? 'bg-indigo-600/95' : 'bg-indigo-600/95'} backdrop-blur-[2px] text-white text-[9px] font-bold text-center py-px tracking-wider z-10 scale-95 origin-top flex items-center justify-center gap-0.5`}>
                  {isMember && <Crown className="w-2 h-2" />}
                  {memberLabel}
               </div>
            )}
         </div>
      );
   };

   if (variant === 'list') {
      return (
         <div
            onClick={() => {
               trackingService.track('click_job_card', {
                  jobId: job.id,
                  matchScore: rawScoreNum,
                  level: resolvedMatchLevel,
                  variant: 'list'
               });
               onClick && onClick(job);
            }}
            className={`
               group relative bg-white rounded-2xl p-4 border transition-all duration-300 hover:shadow-lg cursor-pointer flex gap-4 items-start min-h-[140px]
               ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md bg-indigo-50/10' : 'border-slate-100 hover:border-indigo-200'}
               ${isFeatured ? 'bg-gradient-to-r from-white via-indigo-50/20 to-white border-indigo-100 ring-1 ring-indigo-500/10' : ''}
               ${(job.status === '已失效' || job.status === '已结束') ? 'opacity-65 grayscale hover:grayscale-0' : ''}
               ${className}
            `}
         >
            {/* Left: Company Logo Card */}
            <div className="flex-shrink-0 w-[110px] h-[110px] flex">
               <CompanyCard size="sm" />
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 flex gap-4 py-0.5">
               <div className="min-w-0 flex-1 flex flex-col gap-1.5">

                  {/* Row 1: Badges & Salary (Desktop) */}
                  <div className="flex items-start justify-between gap-2 min-h-[24px]">
                     <div className="flex flex-wrap items-center gap-2 pt-1">
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

                        {/* Deactivated Badge */}
                        {(job.status === '已失效' || job.status === '已结束') && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              已下架
                           </span>
                        )}
                     </div>
                  </div>

                  {/* Row 2: Title */}
                  <div className="flex items-center gap-2 mt-0.5 w-full">
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

                     {(job as any).appliedAt ? (
                        <div className="flex items-center gap-1.5 ml-2">
                           <span className="text-slate-400 text-xs">申请于: {new Date((job as any).appliedAt).toLocaleDateString()}</span>
                        </div>
                     ) : (job as any).savedAt ? (
                        <div className="flex items-center gap-1.5 ml-2">
                           <span className="text-slate-400 text-xs">收藏于: {new Date((job as any).savedAt).toLocaleDateString()}</span>
                        </div>
                     ) : null}
                  </div>

                  {/* Row 4: Tags & Mobile Actions */}
                  <div className="flex items-center justify-between gap-3 mt-auto pt-2">
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

                     <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                        {resolvedMatchLevel !== 'none' && rawScoreNum > 0 && (
                           <div className="md:hidden">
                              <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} />
                           </div>
                        )}

                        {/* Salary (Mobile Only) */}
                        <div className={`md:hidden text-sm whitespace-nowrap ${isSalaryOpen ? 'text-slate-500 font-semibold' : 'font-semibold text-slate-800'}`}>
                           {salaryText}
                        </div>

                        {isFeatured && (
                           <div className="md:hidden flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold border border-indigo-100 whitespace-nowrap">
                              <Sparkles className="w-3 h-3 fill-indigo-100 flex-shrink-0" />
                              <span>精选</span>
                           </div>
                        )}

                        {/* Status Dropdown (Right side, before delete) */}
                        {applicationStatusNode && (
                           <div onClick={e => e.stopPropagation()} className="ml-1 z-10">
                              {applicationStatusNode}
                           </div>
                        )}

                        {/* Delete Button */}
                        {onDelete && (
                           <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 onDelete(job.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                              title="删除记录"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                        )}
                     </div>
                  </div>
               </div>

               <div className="hidden md:flex md:w-[156px] lg:w-[172px] flex-col items-end justify-between text-right py-1">
                  <div className={`max-w-full text-[15px] leading-tight ${isSalaryOpen ? 'text-slate-500 font-semibold' : 'font-semibold text-slate-800'}`}>
                     {salaryText}
                  </div>

                  <div className="flex min-h-[92px] items-center justify-center">
                     {resolvedMatchLevel !== 'none' && rawScoreNum > 0 ? (
                        <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} mode="orb" />
                     ) : (
                        <div className="h-[88px] w-[88px]" />
                     )}
                  </div>

                  <div className="flex min-h-[32px] items-end justify-end">
                     {isFeatured ? (
                        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[12px] font-bold border border-indigo-100 whitespace-nowrap shadow-sm">
                           <Sparkles className="w-3 h-3 fill-indigo-100 flex-shrink-0" />
                           <span>精选</span>
                        </div>
                     ) : (
                        <div className="h-[32px]" />
                     )}
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
            onClick={() => {
               trackingService.track('click_job_card', {
                  jobId: job.id,
                  matchScore: rawScoreNum,
                  level: resolvedMatchLevel,
                  variant: 'grid'
               });
               onClick?.(job);
            }}
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
               {job.companyIndustry && job.companyIndustry.length < 15 && !job.companyIndustry.includes('年以上') && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap max-w-[140px] truncate">
                     <Building2 className="w-3 h-3 mr-1" />
                     {job.companyIndustry}
                  </span>
               )}
               {/* Category (Blue/Indigo - Role related) */}
               {job.category && job.category.length < 15 && !job.category.includes('年以上') && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap max-w-[140px] truncate">
                     <Zap className="w-3 h-3 mr-1" />
                     {job.category}
                  </span>
               )}
               {/* Skill Tags (Restored - First 3) */}
               {displayTags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-1 rounded text-xs text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap max-w-[180px] truncate" title={tag.text}>
                     {tag.text}
                  </span>
               ))}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className={`text-[15px] ${formatSalary(job.salary) === '薪资Open' ? 'text-slate-400' : 'font-semibold text-slate-800'}`}>
                     {formatSalary(job.salary)}
                  </div>
               </div>
               {resolvedMatchLevel !== 'none' && rawScoreNum > 0 ? (
                  <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} />
               ) : (
                  <span className="text-xs text-slate-400 font-medium">
                     {DateFormatter.formatPublishTime(job.publishedAt)}
                  </span>
               )}
            </div>
         </div>
      </>
   );
}
