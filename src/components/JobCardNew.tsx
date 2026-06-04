
import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Building2, Briefcase, TrendingUp, Trash2, Star, Crown, Zap, Bookmark } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { resolveMatchLevel } from '../utils/match-display';
import { trackingService } from '../services/tracking-service';
import { formatSalaryForDisplay } from '../utils/salary-display';
import { getCompanyLogoSources } from '../utils/company-logo';
import { useAuth } from '../contexts/AuthContext';
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

// import { FastAverageColor } from 'fast-average-color'; // Optional: Use if installed

interface JobCardNewProps {
   job: Job;
   onClick?: (job: Job) => void;
   onDelete?: (jobId: string) => void;
   matchScore?: number; // Personalized match score (0-100)
   className?: string;
   variant?: 'grid' | 'list';
   isActive?: boolean;
   isSaved?: boolean;
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

const resolveDirectConnectEmailLabel = (rawType: string) => {
   const emailType = String(rawType || '').trim();
   const normalized = emailType.toLowerCase();
   const haystack = `${normalized} ${emailType}`;

   if (/(boss|ceo|chief|founder|vp|head|director|高管|老板|创始|负责人)/i.test(haystack)) {
      return '直连企业BOSS邮箱';
   }
   if (/(hr|human resources|people|人力|人事|hr邮箱)/i.test(haystack)) {
      return '直连企业HR邮箱';
   }
   if (/(招聘|recruit|recruiter|hiring|career|talent|talent acquisition)/i.test(haystack)) {
      return '直连企业招聘邮箱';
   }
   if (/(员工|employee|staff|teammate|team)/i.test(haystack)) {
      return '直连企业员工邮箱';
   }
   if (emailType && emailType.includes('邮箱')) {
      return `直连企业${emailType}`;
   }
   return '直连企业邮箱';
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
      className="inline-flex h-5 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 px-2 text-[10px] font-black leading-none text-white shadow-[0_10px_18px_-14px_rgba(16,185,129,0.55)]"
      aria-label="new"
      title="最近 3 天内上新"
   >
      New
   </span>
);

const GuestMaskedValue = ({ className = 'w-20' }: { className?: string }) => (
   <span
      className={`inline-flex h-3.5 rounded-full bg-slate-300/80 blur-[2px] ${className}`}
      aria-label="登录后查看"
      title="登录后查看"
   />
);

export default function JobCardNew({ job, onClick, onDelete, matchScore, className, variant = 'grid', isActive = false, isSaved = false, applicationStatusNode, showApplicationMethodIcons = false, compactFeatured = false }: JobCardNewProps) {
   // const navigate = useNavigate();
   // const sourceType = getJobSourceType(job);
   const { isAuthenticated } = useAuth();
   const isTranslated = !!job.translations?.title;

   const isMemberOnlyJob = Boolean(job.memberOnly);
   const shouldMaskGuestMeta = !isAuthenticated;
   const showMemberOnlySignals = isAuthenticated;

   const MemberBadge = () => (
      <div className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 items-center gap-0.5 rounded-full border border-white bg-[#6f63ff] px-1.5 text-white shadow-[0_10px_18px_-12px_rgba(79,70,229,0.8)]">
         <Crown className="h-2.5 w-2.5 fill-current" />
         <span className="text-[8px] font-black leading-none tracking-wide">VIP</span>
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
   const websiteLogoFallbacks = useMemo(() => {
      const rawWebsite = String(job.companyWebsite || '').trim();
      if (!rawWebsite) return [];
      try {
         const withProtocol = /^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`;
         const host = new URL(withProtocol).hostname.replace(/^www\./, '');
         return host
            ? [`https://logo.clearbit.com/${host}`, `https://www.google.com/s2/favicons?domain=${host}&sz=128`]
            : [];
      } catch {
         return [];
      }
   }, [job.companyWebsite]);
   const logoSources = useMemo(() => {
      const baseSources = getCompanyLogoSources({
         companyId: job.companyId,
         cachedLogoUrl: job.cachedLogoUrl || job.cachedCompanyLogoUrl,
         originalLogoUrl: job.logo || job.companyLogo || websiteLogoFallbacks[0],
         version: job.updatedAt || job.publishedAt
      });
      return Array.from(new Set([...baseSources, ...websiteLogoFallbacks]));
   }, [job.companyId, job.cachedLogoUrl, job.cachedCompanyLogoUrl, job.logo, job.companyLogo, websiteLogoFallbacks, job.updatedAt, job.publishedAt]);
   const logoSourceKey = useMemo(() => logoSources.join('|'), [logoSources]);
   const [logoSourceIndex, setLogoSourceIndex] = useState(0);
   const resolvedLogoSrc = logoSources[logoSourceIndex] || '';

   useEffect(() => {
      setLogoSourceIndex(0);
   }, [logoSourceKey]);

   // Dynamic Background Color Logic
   const bgColor = useMemo(() => getPastelColor(job.company || 'default'), [job.company]);
   const textColor = useMemo(() => getDarkerColor(job.company || 'default'), [job.company]);
   const hoverColor = useMemo(() => getHoverColor(job.company || 'default'), [job.company]);

   const isFeatured = job.isFeatured;
   const directApplyEmail = useMemo(() => String(
      job.hiringEmail
      || (job as any).hiring_email
      || (job as any).trusted_hiring_email
      || ''
   ).trim(), [job]);
   const hasDirectApplyEmail = Boolean(directApplyEmail);
   const rawReferralTypes: string[] = (Array.isArray(job.referralContactTypes)
      ? job.referralContactTypes
      : (Array.isArray((job as any).referral_contact_types) ? (job as any).referral_contact_types : [])
   ).map((item: unknown) => String(item || '').trim()).filter(Boolean);
   const directConnectLabels = useMemo(() => {
      const authoritativeTypes = rawReferralTypes;
      const fallbackTypes = hasDirectApplyEmail
         ? [
            job.emailType,
            (job as any).email_type,
            (job as any).trusted_email_type
         ].map((item) => String(item || '').trim()).filter(Boolean)
         : [];
      const rawTypes = authoritativeTypes.length > 0 ? authoritativeTypes : fallbackTypes;
      if (rawTypes.length === 0) return [];

      const labels = rawTypes.map(resolveDirectConnectEmailLabel);

      return [...new Set(labels)].slice(0, 4);
   }, [hasDirectApplyEmail, job, rawReferralTypes]);
   const hasReferralContactSignal = directConnectLabels.length > 0;
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
   const showMatchScore = rawScoreNum >= 80;
   const hasActionControls = Boolean(applicationStatusNode || onDelete);
   const isCompactFeaturedCard = variant === 'list' && compactFeatured;
   const listCardTone = isActive
      ? 'border-[#acd4ea] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,252,255,0.98))] shadow-[0_24px_54px_-36px_rgba(69,111,142,0.28)] ring-1 ring-[#d6eaf4]'
      : isMemberOnlyJob
         ? 'border-[#e7d8bd] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,250,241,0.98))] shadow-[0_22px_48px_-36px_rgba(139,111,66,0.24)] hover:border-[#d8c39a] hover:shadow-[0_28px_58px_-38px_rgba(139,111,66,0.28)]'
         : 'border-[#e3edf4]/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(251,253,255,0.98))] shadow-[0_18px_38px_-34px_rgba(40,65,90,0.18)] hover:border-[#c9def0] hover:shadow-[0_26px_52px_-36px_rgba(69,111,142,0.22)]';

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
   const companyRatingText = String(job.companyRating || (job as any).company_rating || '').trim();
   const renderApplicationMethodBadges = () => {
      if (!showApplicationMethodIcons || !hasReferralContactSignal) return null;

      return (
         <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {directConnectLabels.map((label) => (
               <span
                  key={label}
                  className="inline-flex max-w-[170px] items-center gap-1.5 rounded-full border border-emerald-200/80 bg-[#f4fbf6] px-2.5 py-1 text-[11px] font-bold leading-none text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
                  title={label}
               >
                  <span className="relative flex h-2 w-2 shrink-0">
                     <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-35 animate-ping" />
                     <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="truncate">{label}</span>
               </span>
            ))}
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
            className="relative flex h-full w-full flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-white/70 px-1.5 py-2 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
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
            <div className="relative flex-shrink-0 w-[72px] h-[72px] bg-white rounded-[18px] shadow-[0_16px_32px_-24px_rgba(15,23,42,0.45)] flex items-center justify-center p-1 overflow-hidden">
               {resolvedLogoSrc ? (
                  <img
                     src={resolvedLogoSrc}
                     alt={job.company}
                     className="w-full h-full object-contain"
                     onError={(e) => {
                        if (logoSourceIndex < logoSources.length - 1) {
                           setLogoSourceIndex((idx) => idx + 1);
                           return;
                        }
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
               {showMemberOnlySignals && isMemberOnlyJob && <MemberBadge />}
            </div>
         </div>
      );
   };

   // Legacy Small Logo (for mobile or specific variants if needed)
   const CompanyLogoSmall = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
      const sizeClasses = {
         sm: 'h-10 w-10 p-1',
         md: 'h-12 w-12 p-1',
         lg: 'h-14 w-14 p-1.5',
         xl: 'h-20 w-20 p-2'
      };

      return (
         <div className={`${sizeClasses[size]} relative flex flex-shrink-0 items-center justify-center overflow-visible rounded-[14px] border border-[#dfe8f1] bg-white shadow-[0_10px_22px_-18px_rgba(15,23,42,0.42)] transition-colors group-hover:border-[#c7d9ef]`}>
            {resolvedLogoSrc ? (
               <img
                  src={resolvedLogoSrc}
                  alt={job.company}
                  className="h-full w-full rounded-[10px] object-contain"
                  onError={(e) => {
                     if (logoSourceIndex < logoSources.length - 1) {
                        setLogoSourceIndex((idx) => idx + 1);
                        return;
                     }
                     const target = e.target as HTMLImageElement;
                     target.style.display = 'none';
                     if (target.parentElement && !target.dataset.errorHandled) {
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
               <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-50 text-xl font-bold" style={{ color: textColor }}>
                  {companyInitial}
               </div>
            )}

            {showMemberOnlySignals && isMemberOnlyJob && <MemberBadge />}
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
               group relative min-h-[118px] cursor-pointer rounded-[22px] border p-3.5 transition-all duration-300 md:rounded-[24px] md:p-4
               ${listCardTone}
               ${(job.status === '已失效' || job.status === '已结束') ? 'opacity-65 grayscale hover:grayscale-0' : ''}
               ${className}
            `}
         >
            {isMemberOnlyJob ? (
               <img src="/pic_lists/Home_pics/background04.webp" alt="" className="pointer-events-none absolute inset-y-0 right-0 h-full w-[46%] object-cover object-right opacity-[0.1]" />
            ) : null}
            <div className="flex min-w-0 items-start gap-3">
               <div className="hidden sm:block">
                  <CompanyLogoSmall size="md" />
               </div>

               <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                     <h3
                        className={`min-w-0 shrink truncate font-bold tracking-tight text-slate-950 transition-colors duration-200 group-hover:text-[color:var(--job-title-hover-color)] ${isCompactFeaturedCard ? 'text-[1rem] lg:text-[1.08rem]' : 'text-[17px] sm:text-[18px] md:text-[20px]'}`}
                        style={{ ['--job-title-hover-color' as any]: hoverColor }}
                        title={job.translations?.title || job.title}
                     >
                        {job.translations?.title || job.title}
                     </h3>
                     {isTranslated ? (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold leading-none text-slate-500" title="已翻译">
                           译
                        </span>
                     ) : null}
                     {isNew ? <FreshBadge /> : null}
                     {isSaved ? (
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eaf3ff] text-[#2f6ed8]" title="已收藏">
                           <Bookmark className="h-3 w-3 fill-current" />
                        </span>
                     ) : null}
                     {(job.status === '已失效' || job.status === '已结束') ? (
                        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                           已下架
                        </span>
                     ) : null}
                  </div>

                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500 md:text-[13px]">
                     <span className="min-w-0 max-w-[172px] truncate font-medium text-slate-700 sm:max-w-[132px]" title={job.translations?.company || job.company}>
                        {job.translations?.company || job.company}
                     </span>
                     {companyRatingText ? (
                        <>
                           <span className="text-slate-300">·</span>
                           <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-amber-500">
                              <Star className="h-3 w-3 fill-current" />
                              {shouldMaskGuestMeta ? <GuestMaskedValue className="w-7" /> : companyRatingText}
                           </span>
                        </>
                     ) : null}
                     <span className="text-slate-300">·</span>
                     <span className={`max-w-[150px] truncate ${isSalaryOpen ? 'font-medium text-slate-500' : 'font-semibold text-slate-800'}`} title={shouldMaskGuestMeta ? '登录后查看' : salaryText}>
                        {shouldMaskGuestMeta ? <GuestMaskedValue className="w-24" /> : salaryText}
                     </span>
                     {showMatchScore ? (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-[#d9eaf5] bg-[#f3fbff] px-2 py-0.5 text-[11px] font-bold text-[#3a6f92]">
                           {rawScoreNum}% 匹配
                        </span>
                     ) : null}
                  </div>

                  {(job as any).appliedAt || (job as any).savedAt ? (
                     <div className="mt-1 text-[11px] text-slate-400">
                        {(job as any).appliedAt
                           ? `申请于 ${new Date((job as any).appliedAt).toLocaleDateString()}`
                           : `收藏于 ${new Date((job as any).savedAt).toLocaleDateString()}`}
                     </div>
                  ) : null}
               </div>

               {hasActionControls ? (
                  <div className="hidden shrink-0 items-center gap-2 md:flex">
                     {renderActionControls()}
                  </div>
               ) : null}
            </div>

            {(() => {
               const applicationBadges = renderApplicationMethodBadges();
               return applicationBadges ? (
               <div className="mt-2.5">
                  {applicationBadges}
               </div>
               ) : null;
            })()}

            {displayTags.length > 0 ? (
               <div className={`${hasReferralContactSignal ? 'mt-2' : 'mt-2.5'} flex min-w-0 flex-wrap items-center gap-2`}>
                  {(isCompactFeaturedCard ? compactSkillTags : displayTags.slice(0, 4)).map((tag, i) => (
                     <span
                        key={i}
                        className={`inline-flex items-center rounded-full border border-[#dfe8ef] bg-[#fbfcfa] px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-[#cfe0ea] hover:bg-white ${isCompactFeaturedCard ? 'max-w-[96px] shrink-0' : 'max-w-full'}`}
                        title={tag.text}
                     >
                        <span className="truncate">{tag.text}</span>
                     </span>
                  ))}
                  {isCompactFeaturedCard && compactSkillTagOverflow > 0 ? (
                     <span
                        className="inline-flex shrink-0 items-center rounded-full border border-[#dfe8ef] bg-[#fbfcfa] px-2 py-1 text-[11px] font-medium text-slate-500"
                        title={`还有 ${compactSkillTagOverflow} 个标签`}
                     >
                        +{compactSkillTagOverflow}
                     </span>
                  ) : null}
               </div>
            ) : null}

            <div className="mt-2 flex items-center gap-2 md:hidden">
               {hasActionControls ? <div className="ml-auto flex items-center gap-2">{renderActionControls(true)}</div> : null}
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
                     {shouldMaskGuestMeta ? <GuestMaskedValue className="w-16" /> : job.companyIndustry}
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
                     {shouldMaskGuestMeta ? <GuestMaskedValue className="w-24" /> : formatSalaryForDisplay(job.salary, '薪资Open')}
                  </div>
               </div>
               {resolvedMatchLevel !== 'none' && showMatchScore ? (
                  <MatchScoreBadge score={rawScoreNum} level={resolvedMatchLevel} />
               ) : (
                  <span className="text-xs text-slate-400 font-medium">
                     {shouldMaskGuestMeta ? <GuestMaskedValue className="w-16" /> : DateFormatter.formatPublishTime(job.publishedAt)}
                  </span>
               )}
            </div>
         </div>
      </>
   );
}
