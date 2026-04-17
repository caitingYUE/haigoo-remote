
import React, { useMemo } from 'react';
import { MapPin, Clock, Calendar, Building2, Briefcase, TrendingUp, Trash2, Sparkles, Zap, Crown, Link2, Mail } from 'lucide-react';
import { Job } from '../types';
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
   showApplicationMethodIcons?: boolean;
   compactFeatured?: boolean;
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
const MatchScoreBadge = ({ score, level, compact = false }: { score: number, level: string, compact?: boolean }) => {
   const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
   const isHigh = level === 'high';
   const title = `简历与该岗位需求匹配度 ${safeScore}%`;

   if (compact) {
      return (
         <div
            className={`flex items-center justify-center min-w-[78px] px-2.5 py-1 rounded-full border shadow-sm ${isHigh ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-sky-700 bg-sky-50 border-sky-100'}`}
            title={title}
         >
            <span className="text-[11px] font-bold whitespace-nowrap leading-none">{safeScore}% 匹配</span>
         </div>
      );
   }

   return (
      <div className="flex flex-col items-end justify-center leading-none" title={title}>
         <span className={`whitespace-nowrap text-[30px] font-bold tracking-tight ${isHigh ? 'text-indigo-600' : 'text-sky-600'}`}>
            {safeScore}
            <span className="ml-0.5 text-[15px] font-semibold">%</span>
         </span>
         <span className={`mt-1 text-[11px] font-semibold ${isHigh ? 'text-indigo-500' : 'text-sky-500'}`}>匹配</span>
      </div>
   );
};

const FreshBadge = () => (
   <span
      className="inline-flex items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-sm"
      aria-label="new"
      title="最近 3 天内上新"
   >
      new
   </span>
);

export default function JobCardNew({ job, onClick, onDelete, matchScore, className, variant = 'grid', isActive = false, applicationStatusNode, showApplicationMethodIcons = false, compactFeatured = false }: JobCardNewProps) {
   // const navigate = useNavigate();
   // const sourceType = getJobSourceType(job);
   const isTranslated = !!job.translations?.title;

   const isMemberOnlyJob = Boolean(job.memberOnly);

   const MemberBadge = () => (
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 items-center justify-center gap-1 rounded-full bg-indigo-600/95 px-2.5 py-[3px] text-center text-[10px] font-bold leading-none text-white shadow-lg shadow-indigo-500/15 backdrop-blur-[2px]">
         <Crown className="h-2.5 w-2.5" />
         <span className="whitespace-nowrap">会员</span>
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
   const titleAccessoryWidth = (isTranslated ? 22 : 0) + (isNew ? 48 : 0) + ((isTranslated || isNew) ? 12 : 0);

   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   // Dynamic Background Color Logic
   const bgColor = useMemo(() => getPastelColor(job.company || 'default'), [job.company]);
   const textColor = useMemo(() => getDarkerColor(job.company || 'default'), [job.company]);

   const isFeatured = job.isFeatured;
   const directApplyUrl = useMemo(() => {
      const value = String(job.url || job.sourceUrl || '').trim();
      if (!value || /^mailto:/i.test(value)) return '';
      return /^https?:\/\//i.test(value) ? value : '';
   }, [job.url, job.sourceUrl]);
   const directApplyEmail = useMemo(() => String(job.hiringEmail || '').trim(), [job.hiringEmail]);
   const hasDirectApplyUrl = Boolean(directApplyUrl);
   const hasDirectApplyEmail = Boolean(directApplyEmail);
   const resolvedDisplayScore = Number(
      matchScore
      ?? (job as any).displayMatchScore
      ?? (job as any).display_match_score
      ?? job.matchScore
      ?? job.recommendationScore
      ?? 0
   );
   const resolvedMatchLevel = useMemo(() => {
      const raw = resolvedDisplayScore;
      return resolveMatchLevel(raw, job.matchLevel);
   }, [job, resolvedDisplayScore]);

   const rawScoreNum = Math.round(resolvedDisplayScore);
   const showMatchScore = resolvedMatchLevel !== 'none' && rawScoreNum > 0;
   const hasActionControls = Boolean(applicationStatusNode || onDelete);
   const isCompactFeaturedCard = variant === 'list' && compactFeatured;

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
   const compactSkillTags = isCompactFeaturedCard ? displayTags.slice(0, 4) : displayTags.slice(0, 4);
   const compactSkillTagOverflow = isCompactFeaturedCard ? Math.max(displayTags.length - compactSkillTags.length, 0) : 0;

   const salaryText = formatSalary(job.salary);
   const isSalaryOpen = salaryText === '薪资Open' || salaryText === '薪资 Open';
   const topMetaBadges = [
      job.type ? {
         key: 'jobType',
         label: JOB_TYPE_MAP[job.type] || job.type,
         options: {
            icon: Calendar,
            tone: 'bg-amber-50 text-amber-700 border border-amber-100/50',
            maxWidthClass: 'max-w-[8ch]'
         }
      } : null,
      job.experienceLevel ? {
         key: 'experienceLevel',
         label: EXPERIENCE_LEVEL_MAP[job.experienceLevel] || job.experienceLevel,
         options: {
            icon: TrendingUp,
            tone: 'bg-emerald-50 text-emerald-700 border border-emerald-100/50',
            maxWidthClass: 'max-w-[8ch]'
         }
      } : null,
      job.companyIndustry ? {
         key: 'companyIndustry',
         label: job.companyIndustry,
         options: {
            icon: Building2,
            tone: 'bg-purple-50 text-purple-700 border border-purple-100/50',
            maxWidthClass: isCompactFeaturedCard ? undefined : 'max-w-[10ch] lg:max-w-[14ch]'
         }
      } : null,
      job.category ? {
         key: 'category',
         label: job.category,
         options: {
            icon: Briefcase,
            tone: 'bg-indigo-50 text-indigo-700 border border-indigo-100/50',
            maxWidthClass: isCompactFeaturedCard ? 'max-w-[10ch] lg:max-w-[12ch]' : 'max-w-[10ch] lg:max-w-[14ch]'
         }
      } : null
   ].filter(Boolean) as Array<{
      key: string;
      label: string;
      options: {
         icon: React.ComponentType<{ className?: string }>;
         tone: string;
         maxWidthClass?: string;
      };
   }>;

   const compactTopBadges = isCompactFeaturedCard ? topMetaBadges.slice(0, 3) : topMetaBadges;
   const compactTopBadgeOverflow = isCompactFeaturedCard ? Math.max(topMetaBadges.length - compactTopBadges.length, 0) : 0;
   const compactSalaryDesktopWidthClass = isCompactFeaturedCard
      ? salaryText.length > 18 ? 'md:max-w-[168px]' : 'md:max-w-[148px]'
      : 'md:max-w-[220px]';
   const compactSalaryMobileWidthClass = isCompactFeaturedCard ? 'max-w-[180px]' : 'max-w-[150px]';
   const compactSalaryTextClass = salaryText.length > 18 ? 'text-[13px]' : 'text-[15px]';
   const renderTopMetaBadge = (
      label: string,
      options: {
         icon: React.ComponentType<{ className?: string }>;
         tone: string;
         maxWidthClass?: string;
      }
   ) => {
      const Icon = options.icon;
      return (
         <span
            className={`inline-flex min-w-0 max-w-full shrink items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${options.tone}`}
            title={label}
         >
            <Icon className="h-3 w-3 shrink-0" />
            <span className={`truncate ${options.maxWidthClass || 'max-w-[12ch] lg:max-w-[16ch]'}`}>{label}</span>
         </span>
      );
   };
   const renderApplicationMethodIcons = () => {
      if (!showApplicationMethodIcons || (!hasDirectApplyUrl && !hasDirectApplyEmail)) return null;

      return (
         <div className="inline-flex items-center gap-1.5 text-slate-400">
            {hasDirectApplyUrl ? (
               <span className="inline-flex h-5 w-5 items-center justify-center" title="支持网申" aria-label="支持网申">
                  <Link2 className="h-3.5 w-3.5" />
               </span>
            ) : null}
            {hasDirectApplyEmail ? (
               <span className="inline-flex h-5 w-5 items-center justify-center" title="支持邮箱直申" aria-label="支持邮箱直申">
                  <Mail className="h-3.5 w-3.5" />
               </span>
            ) : null}
         </div>
      );
   };
   const renderActionControls = (mobile = false) => (
      <>
         {applicationStatusNode && (
            <div onClick={e => e.stopPropagation()} className={`z-10 ${mobile ? '' : 'min-w-0'}`}>
               {applicationStatusNode}
            </div>
         )}

         {onDelete && (
            <button
               onClick={(e) => {
                  e.stopPropagation();
                  onDelete(job.id);
               }}
               className={`z-10 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 ${mobile ? '' : 'border border-transparent hover:border-red-100'}`}
               title="删除记录"
            >
               <Trash2 className="w-4 h-4" />
            </button>
         )}
      </>
   );

   // Redesigned Company Logo Component
   // Matching reference: Large card style, dynamic background, centered logo, company name above
   const CompanyCard = ({ size: _size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {

      return (
         <div
            className="flex-shrink-0 flex h-full w-full flex-col items-center justify-center rounded-xl px-2 py-3 transition-colors relative overflow-hidden"
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
               <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 items-center justify-center gap-1 rounded-full bg-indigo-600/95 px-1.5 py-[2px] text-center text-[8px] font-bold leading-none text-white shadow-md shadow-indigo-500/15 backdrop-blur-[2px]">
                  <Crown className="h-2 w-2" />
                  <span className="whitespace-nowrap">会员</span>
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
               group relative bg-white rounded-2xl p-4 border transition-all duration-300 hover:shadow-lg cursor-pointer flex gap-4 items-stretch min-h-[140px]
               ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md bg-indigo-50/10' : 'border-slate-100 hover:border-indigo-200'}
               ${isFeatured ? 'bg-gradient-to-r from-white via-indigo-50/20 to-white border-indigo-100 ring-1 ring-indigo-500/10' : ''}
               ${(job.status === '已失效' || job.status === '已结束') ? 'opacity-65 grayscale hover:grayscale-0' : ''}
               ${className}
            `}
         >
            {/* Left: Company Logo Card */}
            <div className="flex-shrink-0 w-[110px] self-stretch flex">
               <CompanyCard size="sm" />
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 flex gap-4 py-0.5">
               <div className="min-w-0 flex-1 flex flex-col gap-1.5">

                  {/* Row 1: Badges & Salary (Desktop) */}
                  <div className="flex items-start gap-2 min-h-[24px]">
                     <div className={`flex min-w-0 items-center gap-2 pt-1 ${isCompactFeaturedCard ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
                        {(isCompactFeaturedCard ? compactTopBadges : topMetaBadges).map((badge) => (
                           <div key={badge.key} className="shrink-0">
                              {renderTopMetaBadge(badge.label, badge.options)}
                           </div>
                        ))}
                        {isCompactFeaturedCard && compactTopBadgeOverflow > 0 ? (
                           <span
                              className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200 bg-slate-50"
                              title={`还有 ${compactTopBadgeOverflow} 个属性标签`}
                           >
                              +{compactTopBadgeOverflow}
                           </span>
                        ) : null}

                        {(job.status === '已失效' || job.status === '已结束') && (
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              已下架
                           </span>
                        )}
                     </div>
                  </div>

                  {/* Row 2: Title */}
                  <div className="flex items-center gap-2 mt-0.5 w-full min-w-0">
                     <h3
                        className={`min-w-0 truncate font-bold text-slate-900 group-hover:text-indigo-600 transition-colors ${isCompactFeaturedCard ? 'text-[1.05rem] lg:text-[1.12rem]' : 'text-xl'}`}
                        style={{ maxWidth: `calc(100% - ${titleAccessoryWidth}px)` }}
                        title={job.translations?.title || job.title}
                     >
                        {job.translations?.title || job.title}
                     </h3>
                     {isTranslated && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-[10px] text-slate-500" title="已翻译">
                           译
                        </span>
                     )}
                     {isNew && (
                        <div className="flex-shrink-0">
                           <FreshBadge />
                        </div>
                     )}
                  </div>

                  {/* Row 3: Meta Info */}
                  <div className={`flex items-center text-sm text-slate-500 gap-x-6 gap-y-1 mt-1 ${isCompactFeaturedCard ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
                     {/* Company Name (Mobile Only - since desktop has it in the card) */}
                     <span className="font-medium text-slate-700 md:hidden" title={job.translations?.company || job.company}>
                        {job.translations?.company || job.company}
                     </span>

                     <div className={`flex items-center gap-1.5 ${isCompactFeaturedCard ? 'min-w-0 shrink overflow-hidden' : ''}`}>
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className={`truncate ${isCompactFeaturedCard ? 'max-w-[180px] lg:max-w-[220px]' : 'max-w-[200px]'}`}>{job.translations?.location || job.location}</span>
                     </div>

                     <div className="flex shrink-0 items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{DateFormatter.formatPublishTime(job.publishedAt)}</span>
                     </div>

                     {renderApplicationMethodIcons()}

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
                  <div className="mt-auto flex flex-col gap-3 pt-2 md:flex-row md:items-end md:justify-between">
                     <div className={`flex min-w-0 items-center gap-2 ${isCompactFeaturedCard ? 'flex-nowrap' : 'flex-wrap content-start md:max-h-[60px]'}`}>
                        {(isCompactFeaturedCard ? compactSkillTags : displayTags.slice(0, 4)).map((tag, i) => (
                           <span
                              key={i}
                              className={`inline-flex items-center rounded-md bg-slate-100/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 ${isCompactFeaturedCard ? 'max-w-[96px] shrink-0' : 'max-w-full'}`}
                              title={tag.text}
                           >
                              <span className="truncate">{tag.text}</span>
                           </span>
                        ))}
                        {isCompactFeaturedCard && compactSkillTagOverflow > 0 ? (
                           <span
                              className="inline-flex shrink-0 items-center rounded-md bg-slate-100/80 px-2 py-1 text-[11px] font-medium text-slate-500"
                              title={`还有 ${compactSkillTagOverflow} 个标签`}
                           >
                              +{compactSkillTagOverflow}
                           </span>
                        ) : null}
                     </div>

                     <div className="flex items-center gap-2 md:hidden">
                        {showMatchScore && (
                           <div>
                              <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} compact />
                           </div>
                        )}

                        <div className={`${compactSalaryMobileWidthClass} truncate text-sm ${isSalaryOpen ? 'text-slate-500 font-semibold' : 'font-semibold text-slate-800'}`} title={salaryText}>
                           {salaryText}
                        </div>

                        {isFeatured && (
                           <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold border border-indigo-100 whitespace-nowrap">
                              <Sparkles className="w-3 h-3 fill-indigo-100 flex-shrink-0" />
                              <span>精选</span>
                           </div>
                        )}

                        {hasActionControls && (
                           <div className="ml-auto flex items-center gap-2">
                              {renderActionControls(true)}
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className={`hidden shrink-0 self-stretch py-1 md:flex md:w-auto md:flex-col md:items-end md:justify-between md:gap-3 md:text-right ${compactSalaryDesktopWidthClass}`}>
                  <div className={`${compactSalaryDesktopWidthClass.replace('md:', '')} truncate leading-tight ${isSalaryOpen ? 'text-slate-500 font-semibold' : 'font-semibold text-slate-800'} ${isCompactFeaturedCard ? compactSalaryTextClass : 'text-[15px]'}`} title={salaryText}>
                     {salaryText}
                  </div>

                  <div className="flex w-full flex-1 items-center justify-end">
                     {showMatchScore ? (
                        <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} />
                     ) : (
                        <div />
                     )}
                  </div>

                  <div className="flex min-h-[38px] items-end justify-end gap-2">
                     {isFeatured ? (
                        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[12px] font-bold border border-indigo-100 whitespace-nowrap shadow-sm">
                           <Sparkles className="w-3 h-3 fill-indigo-100 flex-shrink-0" />
                           <span>精选</span>
                        </div>
                     ) : !hasActionControls ? (
                        <div className="h-[32px]" />
                     ) : null}

                     {hasActionControls ? (
                        <div className="flex items-center gap-2">
                           {renderActionControls()}
                        </div>
                     ) : null}
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
                        <div className="flex-shrink-0">
                           <FreshBadge />
                        </div>
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
