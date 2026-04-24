
import React, { useMemo } from 'react';
import { MapPin, Clock, Calendar, Building2, Briefcase, TrendingUp, Trash2, Star, Crown, Link2, Mail, Zap } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { resolveMatchLevel } from '../utils/match-display';
import { trackingService } from '../services/tracking-service';
import { formatSalaryForDisplay } from '../utils/salary-display';
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

const BRAND_PASTEL_TOKENS = [
   { bg: '#DCF8F0', text: '#1E8D7E', hover: '#16695D' },
   { bg: '#E5EEFF', text: '#4365D8', hover: '#2B49A8' },
   { bg: '#FFF0D8', text: '#B47319', hover: '#874F0E' },
   { bg: '#F1E7FF', text: '#7A55D1', hover: '#5A38AC' },
   { bg: '#E5F7E4', text: '#43925A', hover: '#2E6D40' },
   { bg: '#FDE6EE', text: '#BA567C', hover: '#933C60' }
];

const getBrandPalette = (str: string) => {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
   }
   return BRAND_PASTEL_TOKENS[Math.abs(hash) % BRAND_PASTEL_TOKENS.length];
};

const getPastelColor = (str: string) => getBrandPalette(str).bg;
const getDarkerColor = (str: string) => getBrandPalette(str).text;
const getHoverColor = (str: string) => getBrandPalette(str).hover;

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

   const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);

   // Dynamic Background Color Logic
   const bgColor = useMemo(() => getPastelColor(job.company || 'default'), [job.company]);
   const textColor = useMemo(() => getDarkerColor(job.company || 'default'), [job.company]);
   const hoverColor = useMemo(() => getHoverColor(job.company || 'default'), [job.company]);

   const isFeatured = job.isFeatured;
   const titleAccessoryWidth = (isTranslated ? 22 : 0) + (isNew ? 48 : 0) + (isFeatured ? 24 : 0) + (((isTranslated || isNew || isFeatured) ? 12 : 0));
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

      return tags.filter((tag) => tag.text !== '精选').slice(0, 5); // Reduce max tags for cleaner look
   }, [job.skills, job.tags, job.companyTags]);
   const compactSkillTags = isCompactFeaturedCard ? displayTags.slice(0, 4) : displayTags.slice(0, 4);
   const compactSkillTagOverflow = isCompactFeaturedCard ? Math.max(displayTags.length - compactSkillTags.length, 0) : 0;

   const salaryText = formatSalaryForDisplay(job.salary, '薪资Open');
   const isSalaryOpen = salaryText === '薪资Open' || salaryText === '薪资 Open';
   const topMetaBadges = [
      job.type ? {
         key: 'jobType',
         label: JOB_TYPE_MAP[job.type] || job.type,
         options: {
            icon: Calendar,
            tone: 'bg-slate-50 text-slate-700 border border-slate-200/80',
            maxWidthClass: isCompactFeaturedCard ? 'max-w-[7ch]' : 'max-w-[8ch]'
         }
      } : null,
      job.experienceLevel ? {
         key: 'experienceLevel',
         label: EXPERIENCE_LEVEL_MAP[job.experienceLevel] || job.experienceLevel,
         options: {
            icon: TrendingUp,
            tone: 'bg-slate-50 text-slate-700 border border-slate-200/80',
            maxWidthClass: isCompactFeaturedCard ? 'max-w-[7ch]' : 'max-w-[8ch]'
         }
      } : null,
      job.category ? {
         key: 'category',
         label: job.category,
         options: {
            icon: Briefcase,
            tone: 'bg-slate-50 text-slate-700 border border-slate-200/80',
            maxWidthClass: isCompactFeaturedCard ? 'max-w-[9ch] lg:max-w-[10ch]' : 'max-w-[10ch] lg:max-w-[14ch]'
         }
      } : null,
      job.companyIndustry ? {
         key: 'companyIndustry',
         label: job.companyIndustry,
         options: {
            icon: Building2,
            tone: 'bg-slate-50 text-slate-700 border border-slate-200/80',
            maxWidthClass: isCompactFeaturedCard ? 'max-w-[8ch] lg:max-w-[9ch]' : 'max-w-[10ch] lg:max-w-[14ch]'
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

   const compactTopBadges = isCompactFeaturedCard ? topMetaBadges.slice(0, 5) : topMetaBadges;
   const compactTopBadgeOverflow = isCompactFeaturedCard ? Math.max(topMetaBadges.length - compactTopBadges.length, 0) : 0;
   const compactSalaryDesktopWidthClass = isCompactFeaturedCard ? 'md:basis-[21%] md:max-w-[21%]' : 'md:basis-[24%] md:max-w-[24%]';
   const compactSalaryMobileWidthClass = isCompactFeaturedCard ? 'max-w-[180px]' : 'max-w-[156px]';
   const compactSalaryTextClass = salaryText.length > 28 ? 'text-[11px]' : salaryText.length > 20 ? 'text-[12px]' : 'text-[15px]';
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
            className={`inline-flex min-w-0 max-w-full shrink items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${options.tone}`}
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
            className="relative flex h-full w-full flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-white/70 px-2 py-3 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            style={{ backgroundColor: bgColor }}
         >
            {/* Featured Badge for Grid View (Hidden per user request) */}
            {/*
            {isFeatured && variant === 'grid' && (
               <div className="absolute top-0 right-0 bg-gradient-to-bl from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 shadow-sm flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
               </div>
            )}
            */}

            {/* Company Name (Top) */}
            <div
               className="flex-shrink-0 text-xs font-bold text-center mb-1.5 line-clamp-2 w-full leading-tight break-words"
               style={{ color: textColor }}
               title={job.translations?.company || job.company}
            >
               {job.translations?.company || job.company}
            </div>

            {/* Logo (Centered) */}
            <div className="relative flex-shrink-0 w-16 h-16 bg-white rounded-[18px] shadow-[0_16px_32px_-24px_rgba(15,23,42,0.45)] flex items-center justify-center p-2 overflow-hidden">
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
                        target.parentElement.style.backgroundColor = bgColor;
                        target.dataset.errorHandled = 'true';
                        const initialSpan = document.createElement('span');
                        initialSpan.className = "font-bold text-xl";
                        initialSpan.style.color = textColor;
                        initialSpan.textContent = companyInitial;
                        target.parentElement.appendChild(initialSpan);
                     }
                  }}
               />
            ) : (
               <div className="w-full h-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: bgColor, color: textColor }}>
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
               group relative flex min-h-[148px] cursor-pointer items-stretch gap-4 rounded-[26px] border p-4 transition-all duration-300
               ${isActive ? 'border-indigo-300 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(244,247,255,0.92))] shadow-[0_24px_54px_-36px_rgba(79,70,229,0.38)] ring-1 ring-indigo-200/80' : 'border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(251,252,255,0.98))] shadow-[0_18px_38px_-32px_rgba(15,23,42,0.2)] hover:border-indigo-200 hover:shadow-[0_26px_52px_-34px_rgba(79,70,229,0.18)]'}
               ${isFeatured ? 'before:absolute before:inset-y-5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-indigo-500' : ''}
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
                  <div className="mt-0.5 flex w-full min-w-0 items-center gap-2">
                     <h3
                        className={`min-w-0 truncate font-bold tracking-tight text-[color:var(--job-title-color)] transition-colors duration-200 group-hover:text-[color:var(--job-title-hover-color)] ${isCompactFeaturedCard ? 'text-[1.05rem] lg:text-[1.12rem]' : 'text-[22px]'}`}
                        style={{ maxWidth: `calc(100% - ${titleAccessoryWidth}px)`, ['--job-title-color' as any]: '#0f172a', ['--job-title-hover-color' as any]: hoverColor }}
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
                     {isFeatured && (
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500" title="精选岗位">
                           <Star className="h-3 w-3 fill-current" />
                        </span>
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
                              className={`inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-white ${isCompactFeaturedCard ? 'max-w-[96px] shrink-0' : 'max-w-full'}`}
                              title={tag.text}
                           >
                              <span className="truncate">{tag.text}</span>
                           </span>
                        ))}
                        {isCompactFeaturedCard && compactSkillTagOverflow > 0 ? (
                           <span
                              className="inline-flex shrink-0 items-center rounded-full border border-slate-200/80 bg-slate-50/95 px-2 py-1 text-[11px] font-medium text-slate-500"
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

                        <div className={`${compactSalaryMobileWidthClass} line-clamp-2 text-right text-sm leading-5 ${isSalaryOpen ? 'text-slate-500 font-semibold' : 'font-semibold text-slate-800'}`} title={salaryText}>
                           {salaryText}
                        </div>

                        {/* Hidden per user request 
                        {isFeatured && (
                           <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold border border-indigo-100 whitespace-nowrap">
                              <Sparkles className="w-3 h-3 fill-indigo-100 flex-shrink-0" />
                              <span>精选</span>
                           </div>
                        )}
                        */}

                        {hasActionControls && (
                           <div className="ml-auto flex items-center gap-2">
                              {renderActionControls(true)}
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               <div className={`hidden shrink-0 self-stretch py-1 md:flex md:flex-col md:items-end md:justify-between md:gap-3 md:text-right ${isCompactFeaturedCard ? 'pl-0' : 'pl-4 border-l border-slate-100/90'} ${compactSalaryDesktopWidthClass}`}>
                  <div className={`w-full whitespace-normal break-words leading-[1.3] ${isSalaryOpen ? 'text-slate-500 font-semibold' : 'font-semibold text-slate-800'} ${isCompactFeaturedCard ? `${compactSalaryTextClass} line-clamp-2` : `${salaryText.length > 26 ? 'text-[14px]' : salaryText.length > 18 ? 'text-[15px]' : 'text-[16px]'} line-clamp-2`}`} title={salaryText}>
                     {salaryText}
                  </div>

                  <div className="flex w-full flex-1 items-end justify-end pb-2">
                     {showMatchScore ? (
                        <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} />
                     ) : (
                        <div />
                     )}
                  </div>

                  <div className="flex items-end justify-end gap-2 shrink-0">
                     {/* Hidden per user request 
                     {isFeatured ? (
                        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[12px] font-bold border border-indigo-100 whitespace-nowrap shadow-sm">
                           <Sparkles className="w-3 h-3 fill-indigo-100 flex-shrink-0" />
                           <span>精选</span>
                        </div>
                     ) : !hasActionControls ? (
                        <div className="h-[32px]" />
                     ) : null}
                     */}

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
                     <div className="min-w-0 flex items-start gap-2">
                        <h3 className="text-lg font-bold text-slate-900 line-clamp-2 leading-snug" title={job.translations?.title || job.title}>
                           {job.translations?.title || job.title}
                        </h3>
                        {isNew && (
                           <div className="flex-shrink-0">
                              <FreshBadge />
                           </div>
                        )}
               {isFeatured && (
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500" title="精选岗位">
                     <Star className="h-3 w-3 fill-current" />
                  </span>
               )}
                     </div>
                  </div>
                  <div className="flex items-center text-sm text-slate-500 font-medium">
                     <span className="truncate mr-2 max-w-[140px]" style={{ color: textColor }}>{job.translations?.company || job.company}</span>
                     <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
                     <span className="truncate max-w-[100px]">{job.translations?.location || job.location}</span>
                  </div>
               </div>
            </div>

            {/* Tags (Rich Info Restored) */}
            <div className="flex flex-wrap gap-2 mb-4 content-start">
               {/* Job Type (Amber) */}
               {job.type && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap">
                     <Briefcase className="w-3 h-3 mr-1" />
                     {job.type === 'full-time' ? '全职' : job.type}
                  </span>
               )}
               {/* Experience Level (Emerald) */}
               {job.experienceLevel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     {EXPERIENCE_LEVEL_MAP[job.experienceLevel] || job.experienceLevel}
                  </span>
               )}
               {/* Industry (Purple) */}
               {job.companyIndustry && job.companyIndustry.length < 15 && !job.companyIndustry.includes('年以上') && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap max-w-[140px] truncate">
                     <Building2 className="w-3 h-3 mr-1" />
                     {job.companyIndustry}
                  </span>
               )}
               {/* Category (Blue/Indigo - Role related) */}
               {job.category && job.category.length < 15 && !job.category.includes('年以上') && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 whitespace-nowrap max-w-[140px] truncate">
                     <Zap className="w-3 h-3 mr-1" />
                     {job.category}
                  </span>
               )}
               {/* Skill Tags (Restored - First 3) */}
               {displayTags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-1 rounded text-xs text-slate-700 bg-slate-100 border border-slate-200 whitespace-nowrap max-w-[180px] truncate" title={tag.text}>
                     {tag.text}
                  </span>
               ))}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className={`text-[15px] ${formatSalaryForDisplay(job.salary, '薪资Open') === '薪资Open' ? 'text-slate-400' : 'font-semibold text-slate-800'}`}>
                     {formatSalaryForDisplay(job.salary, '薪资Open')}
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
