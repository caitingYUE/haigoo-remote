import React, { useState } from 'react';
import { MapPin, Clock, DollarSign, ExternalLink, Building, Briefcase, Globe, Award, Bookmark, UserCheck } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { processJobDescription } from '../utils/text-formatter';
// 移除语义标签行：不再使用 JobTags/tagUtils，仅保留描述下的处理后技能标签
import { SingleLineTags } from './SingleLineTags';

interface JobCardProps {
  job: Job;
  onSave?: (jobId: string) => void;
  isSaved?: boolean;
  onClick?: (job: Job) => void;
}

export default function JobCard({ job, onSave, isSaved, onClick }: JobCardProps) {

  // 不再生成语义标签，仅保留处理后数据的技能标签展示

  const formatSalary = (salary: Job['salary']) => {
    if (!salary || (salary.min === 0 && salary.max === 0)) return 'None';

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
    return `${currencySymbol}${formatAmount(salary.min)} - ${formatAmount(salary.max)}`;
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

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (job.sourceUrl) {
      window.open(job.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSourceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (job.sourceUrl) {
        window.open(job.sourceUrl, '_blank', 'noopener,noreferrer');
      }
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

  return (
    <article
      className="group bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer relative h-full flex flex-col"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-label={getJobCardAriaLabel()}
      aria-describedby={`job-${job.id}-description`}
    >
      {/* Source Badge - Top-left */}
      <div className="absolute -top-2 -left-2 z-10">
        {job.isTrusted ? (
          job.canRefer ? (
            <div className="flex items-center gap-1 bg-purple-500 text-white px-2.5 py-1 rounded text-xs font-medium shadow-sm">
              <UserCheck className="w-3 h-3" />
              内推
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-medium shadow-sm">
              <Award className="w-3 h-3" />
              已审核
            </div>
          )
        ) : (
          <div className="flex items-center gap-1 bg-gray-500 text-white px-2.5 py-1 rounded text-xs font-medium shadow-sm">
            <Globe className="w-3 h-3" />
            第三方
          </div>
        )}
      </div>

      {/* Bookmark Button - Top-right */}
      {onSave && (
        <button
          onClick={(e) => { e.stopPropagation(); onSave(job.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSave(job.id); } }}
          className={`absolute top-3 right-3 p-1.5 rounded transition-colors ${isSaved ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
          title={isSaved ? '已收藏' : '收藏'}
          aria-label={isSaved ? '取消收藏职位' : '收藏职位'}
          aria-pressed={Boolean(isSaved)}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
      )}

      {/* Company Name */}
      <div className="flex items-center text-gray-600 text-sm mb-2 mt-1">
        <Building className="w-4 h-4 mr-1.5 flex-shrink-0" aria-hidden="true" />
        <span className="truncate font-medium" title={job.translations?.company || job.company}>
          {job.translations?.company || job.company}
        </span>
      </div>

      {/* Job Title */}
      <h2
        id={`job-${job.id}-title`}
        className="font-semibold text-gray-900 text-base mb-3 truncate leading-snug"
        title={job.translations?.title || job.title}
      >
        {job.translations?.title || job.title}
      </h2>

      {/* Location, Type, and Time Row */}
      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3 min-w-0">
        {/* Location - Flexible width with truncation */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <MapPin className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate" title={job.translations?.location || job.location}>
            {job.translations?.location || job.location}
          </span>
        </div>

        {/* Job Type Badge - Fixed width */}
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700 flex-shrink-0">
          {getJobTypeLabel(job.type)}
        </span>

        {/* Posted Time - Fixed width */}
        <div className="flex items-center text-gray-400 text-xs flex-shrink-0">
          <time dateTime={job.postedAt} aria-label={`发布时间：${DateFormatter.formatPublishTime(job.postedAt)}`}>
            {DateFormatter.formatPublishTime(job.postedAt)}
          </time>
        </div>
      </div>

      {/* Job Description */}
      <section className="flex-1 mb-3">
        {(job.translations?.description || job.description) ? (
          <p
            id={`job-${job.id}-description`}
            className="text-gray-600 text-sm leading-relaxed line-clamp-3"
            aria-label="职位描述"
          >
            {processJobDescription(job.translations?.description || job.description || '', {
              formatMarkdown: false,
              maxLength: 150,
              preserveHtml: false
            })}
          </p>
        ) : (
          <p className="text-gray-400 text-sm italic">暂无描述</p>
        )}
      </section>

      {/* Tags - Only show if available */}
      {((Array.isArray((job as any).tags) && (job as any).tags.length > 0) || (job.skills && job.skills.length > 0)) && (
        <section className="mt-auto">
          <SingleLineTags
            size="xs"
            tags={(
              Array.isArray((job as any).tags) && (job as any).tags.length > 0
                ? (job as any).tags
                : (job.skills || [])
            ) as string[]}
          />
        </section>
      )}
    </article>
  );
}
