import React, { useMemo } from 'react';
import { MapPin, Award, Bookmark } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { processJobDescription } from '../utils/text-formatter';
// 移除语义标签行：不再使用 JobTags/tagUtils，仅保留描述下的处理后技能标签
import { SingleLineTags } from './SingleLineTags';
import { trustedCompaniesService } from '../services/trusted-companies-service';

interface JobCardProps {
  job: Job;
  onSave?: (jobId: string) => void;
  isSaved?: boolean;
  onClick?: (job: Job) => void;
  isActive?: boolean;
  variant?: 'default' | 'compact';
}

export default function JobCard({ job, onSave, isSaved, onClick, isActive, variant = 'default' }: JobCardProps) {

  // 不再生成语义标签，仅保留处理后数据的技能标签展示

  const formatSalary = (salary: Job['salary']) => {
    if (!salary || (salary.min === 0 && salary.max === 0)) return '薪资面议';

    const formatAmount = (amount: number) => {
      if (amount >= 10000) {
        return `${(amount / 10000).toFixed(1)}万`;
      }
      return amount.toLocaleString();
    };

    const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : '€';

    if (salary.min === salary.max) {
      return `${currencySymbol}${formatAmount(salary.min)}`;
    }
    return `${currencySymbol}${formatAmount(salary.min)}-${formatAmount(salary.max)}`;
  };

  const getJobTypeLabel = (jobType: string) => {
    const labels = {
      'full-time': '全职',
      'part-time': '兼职',
      'contract': '合同',
      'freelance': '自由职业',
      'internship': '实习',
      'remote': '远程'
    };
    return labels[jobType as keyof typeof labels] || jobType;
  };

  // 键盘导航处理
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(job);
    }
  };

  // 生成职位卡片的 ARIA 标签（使用翻译后的内容）
  const getJobCardAriaLabel = () => {
    const parts = [
      `职位：${job.translations?.title || job.title}`,
      `公司：${job.translations?.company || job.company}`,
      `薪资：${formatSalary(job.salary)}`,
      `地点：${job.translations?.location || job.location}`,
      `类型：${getJobTypeLabel(job.type)}`,
      `发布时间：${DateFormatter.formatPublishTime(job.postedAt)}`
    ];

    if (job.experienceLevel) {
      const experienceMap: Record<string, string> = {
        'Entry': '初级',
        'Mid': '中级',
        'Senior': '高级',
        'Lead': '资深',
        'Executive': '专家'
      };
      const experienceLabel = experienceMap[job.experienceLevel] || job.experienceLevel;
      parts.push(`经验要求：${experienceLabel}`);
    }

    if (job.isRemote) {
      parts.push('支持远程工作');
    }

    return parts.join('，') + '。';
  };

  const companyInitial = useMemo(() => (job.translations?.company || job.company || '海狗').charAt(0).toUpperCase(), [job.translations?.company, job.company]);
  const palette = useMemo(() => {
    const colors = [
      { bg: 'rgba(49, 130, 206, 0.12)', text: '#3182CE' },
      { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981' },
      { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6' },
      { bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899' },
      { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B' },
      { bg: 'rgba(6, 182, 212, 0.12)', text: '#06B6D4' },
      { bg: 'rgba(239, 68, 68, 0.12)', text: '#EF4444' },
      { bg: 'rgba(107, 114, 128, 0.12)', text: '#6B7280' },
      { bg: 'rgba(34, 197, 94, 0.12)', text: '#22C55E' },
      { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563EB' },
      { bg: 'rgba(124, 58, 237, 0.12)', text: '#7C3AED' },
      { bg: 'rgba(217, 119, 6, 0.12)', text: '#D97706' }
    ];
    const idx = Math.max(0, companyInitial.charCodeAt(0) % colors.length);
    return colors[idx];
  }, [companyInitial]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(job.logo);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!job.companyId) return;
      try {
        const data = await trustedCompaniesService.getCompanyById(job.companyId);
        if (mounted) {
          setCompany(data);
          setLogoUrl(job.logo || data?.logo);
        }
      } catch {
        if (mounted) {
          setCompany(null);
          setLogoUrl(job.logo);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, [job.companyId, job.logo]);

  if (variant === 'compact') {
    return (
      <article
        className={`group bg-white rounded-lg p-3 shadow-sm border transition-all duration-200 cursor-pointer relative flex items-start gap-3 ${isActive
          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30'
          : 'border-slate-200 hover:shadow-md hover:border-blue-200'
          }`}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        tabIndex={0}
        aria-label={getJobCardAriaLabel()}
      >
        {/* Logo */}
        <div className="w-12 h-12 rounded-lg border border-slate-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 bg-white mt-1">
          {logoUrl ? (
            <img src={logoUrl} alt="company logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold" style={{ backgroundColor: palette.bg, color: palette.text, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {companyInitial}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h2 className="font-semibold text-slate-900 text-base leading-tight truncate hover:text-blue-600 transition-colors" title={job.translations?.title || job.title}>
              {job.translations?.title || job.title}
            </h2>
            {onSave && (
              <button
                onClick={(e) => { e.stopPropagation(); onSave(job.id); }}
                className={`flex-shrink-0 p-1 rounded-md transition-colors ${isSaved ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
              >
                <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>

          <div className="text-sm text-slate-600 truncate mt-0.5">
            {job.translations?.company || job.company}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 truncate">
            <span className="truncate">{job.translations?.location || job.location}</span>
            {job.isRemote && (
              <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                远程
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="font-medium text-emerald-600 text-sm">
              {formatSalary(job.salary)}
            </div>
            <time className="text-xs text-slate-400" dateTime={job.postedAt}>
              {DateFormatter.formatPublishTime(job.postedAt)}
            </time>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`group bg-white rounded-xl p-5 shadow-sm border transition-all duration-200 cursor-pointer relative flex flex-col h-full ${isActive
        ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30'
        : 'border-slate-200 hover:shadow-md hover:border-blue-200'
        }`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-label={getJobCardAriaLabel()}
      aria-describedby={`job-${job.id}-description`}
    >
      {/* Header: Logo + Title/Company + Action */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="company logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold" style={{ backgroundColor: palette.bg, color: palette.text, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {companyInitial}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h2
              id={`job-${job.id}-title`}
              className="font-bold text-slate-900 text-lg leading-tight truncate hover:text-blue-600 transition-colors mb-1"
              title={job.translations?.title || job.title}
            >
              {job.translations?.title || job.title}
            </h2>
            {onSave && (
              <button
                onClick={(e) => { e.stopPropagation(); onSave(job.id); }}
                className={`p-1.5 -mr-1.5 rounded-lg transition-colors ${isSaved ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
                title={isSaved ? '已收藏' : '收藏'}
              >
                <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex items-center text-slate-600 text-sm gap-2 flex-wrap">
            {job.companyWebsite ? (
              <a
                href={job.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium truncate max-w-[200px] hover:text-blue-600 hover:underline"
                title={job.translations?.company || job.company}
              >
                {job.translations?.company || job.company}
              </a>
            ) : (
              <span className="font-medium truncate max-w-[200px]" title={job.translations?.company || job.company}>
                {job.translations?.company || job.company}
              </span>
            )}

            {job.companyIndustry && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                {job.companyIndustry}
              </span>
            )}

            {job.isTrusted && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                <Award className="w-3 h-3 mr-0.5" />
                认证
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags & Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
          {getJobTypeLabel(job.type)}
        </span>
        {job.isRemote && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            远程
          </span>
        )}
        {job.experienceLevel && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            {job.experienceLevel}
          </span>
        )}
      </div>

      {/* Description Preview or AI Summary */}
      <div className="flex-1 mb-4 min-h-[3rem]">
        {job.summary ? (
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <p className="text-slate-700 text-sm font-medium leading-relaxed">
              {job.summary}
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
            {processJobDescription(job.translations?.description || job.description || '', {
              formatMarkdown: false,
              maxLength: 100,
              preserveHtml: false
            })}
          </p>
        )}
      </div>

      {/* Skills Tags (Bottom) */}
      {((Array.isArray((job as any).tags) && (job as any).tags.length > 0) || (job.skills && job.skills.length > 0) || (job.companyTags && job.companyTags.length > 0)) && (
        <div className="mb-4">
          <SingleLineTags
            size="xs"
            tags={[
              ...(job.companyTags || []),
              ...((
                Array.isArray((job as any).tags) && (job as any).tags.length > 0
                  ? (job as any).tags
                  : (job.skills || [])
              ) as string[])
            ]}
          />
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-[100px]">{job.translations?.location || job.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <time dateTime={job.postedAt}>{DateFormatter.formatPublishTime(job.postedAt)}</time>
          </div>
        </div>

        <div className="font-semibold text-emerald-600 text-sm">
          {formatSalary(job.salary)}
        </div>
      </div>
    </article>
  );
}
