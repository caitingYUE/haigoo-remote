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
      className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#3182CE]/30 transition-all duration-300 cursor-pointer relative hover:-translate-y-0.5 h-full flex flex-col"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-label={getJobCardAriaLabel()}
      aria-describedby={`job-${job.id}-description`}
    >
      {/* 右上角操作按钮组 - 仅保留原始链接跳转 */}
      <div
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2 z-10"
        role="toolbar"
        aria-label="职位操作"
      >
        {/* 收藏按钮 */}
        {onSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(job.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSave(job.id); } }}
            className={`p-2 rounded-lg transition-all duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center border ${isSaved ? 'bg-[#EAF3FF] text-[#3182CE] border-[#3182CE]/30' : 'text-gray-400 hover:text-[#3182CE] hover:bg-[#EAF3FF] border-gray-200'}`}
            title={isSaved ? '已收藏' : '收藏'}
            aria-label={isSaved ? '取消收藏职位' : '收藏职位'}
            aria-pressed={Boolean(isSaved)}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
        )}
        {/* 原始链接跳转 */}
        {job.sourceUrl && (
          <button
            onClick={handleSourceClick}
            onKeyDown={handleSourceKeyDown}
            className="p-2 text-gray-400 hover:text-[#3182CE] hover:bg-[#EAF3FF] rounded-lg transition-all duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center border border-gray-200"
            title={`在 ${job.source} 查看原始职位`}
            aria-label={`在 ${job.source} 查看原始职位`}
            tabIndex={0}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Header */}
      <header className="flex items-start justify-between pr-28 mb-3">
        <div className="flex-1 min-w-0">
          <h2
            id={`job-${job.id}-title`}
            className="font-semibold text-brand-navy text-lg hover:text-brand-blue transition-colors mb-1 line-clamp-1"
            title={job.translations?.title || job.title}
          >
            {job.translations?.title || job.title}
          </h2>

          {/* 公司信息行 */}
          <div className="flex items-center text-gray-600 text-sm mb-2 h-5">
            <div className="flex items-center font-medium min-w-0">
              <Building className="w-4 h-4 mr-1.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate" title={job.translations?.company || job.company}>{job.translations?.company || job.company}</span>
            </div>
          </div>

          {/* 核心信息行 - 固定高度 */}
          <div className="flex flex-wrap items-center gap-3 text-sm h-6 overflow-hidden">
            {/* 薪资 */}
            {job.salary && job.salary.min > 0 && (
              <div className="flex items-center text-haigoo-primary font-semibold">
                <DollarSign className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
                <span aria-label={`薪资：${formatSalary(job.salary)}`}>
                  {formatSalary(job.salary)}
                </span>
              </div>
            )}

            {/* 地点 */}
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300 min-w-0 max-w-[150px]">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
              <span
                className="truncate"
                title={job.translations?.location || job.location}
                aria-label={`工作地点：${job.translations?.location || job.location}`}
              >
                {job.translations?.location || job.location}
              </span>
            </div>

            {/* 工作类型 */}
            <div className="flex items-center">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-md ${job.type === 'full-time' ? 'bg-green-100 text-green-700' :
                  job.type === 'contract' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}
                aria-label={`工作类型：${getJobTypeLabel(job.type)}`}
              >
                {getJobTypeLabel(job.type)}
              </span>
            </div>

            {/* 来源/可信标识（内联展示，避免与右上角操作重叠） */}
            {job.isTrusted ? (
              job.canRefer ? (
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium border border-emerald-100">
                  <UserCheck className="w-3 h-3" />
                  可内推
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100">
                  <Award className="w-3 h-3" />
                  已审核
                </div>
              )
            ) : (
              <div className="flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-0.5 rounded text-xs font-medium border border-gray-200">
                <Globe className="w-3 h-3" />
                第三方
              </div>
            )}

            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-4">
                {/* Logo */}
                <div className="w-12 h-12 rounded-lg border border-gray-100 flex items-center justify-center bg-white shadow-sm flex-shrink-0 overflow-hidden">
                  {job.logo ? (
                    <img src={job.logo} alt={job.company} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-400 font-bold text-xl">
                      {job.company?.charAt(0) || <Building className="w-6 h-6" />}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-lg text-gray-900 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                    {job.translations?.title || job.title}
                  </h3>
                  <div className="flex items-center text-gray-500 text-sm">
                    <Building className="w-3.5 h-3.5 mr-1" />
                    <span className="mr-3">{job.translations?.company || job.company}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* 发布时间 */}
            <div className="flex items-center text-gray-400 text-xs ml-auto">
              <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
              <time
                className="whitespace-nowrap"
                dateTime={job.postedAt}
                aria-label={`发布时间：${DateFormatter.formatPublishTime(job.postedAt)}`}
              >
                {DateFormatter.formatPublishTime(job.postedAt)}
              </time>
            </div>
          </div>
        </div>
      </header>

      {/* 职位描述 - 固定高度，保证对齐 */}
      <section className="mt-auto mb-3 h-[42px] overflow-hidden">
        {(job.translations?.description || job.description) ? (
          <p
            id={`job-${job.id}-description`}
            className="text-gray-600 text-sm line-clamp-2 leading-relaxed"
            aria-label="职位描述"
          >
            {processJobDescription(job.translations?.description || job.description || '', {
              formatMarkdown: false,
              maxLength: 120,
              preserveHtml: false
            })}
          </p>
        ) : (
          <p className="text-gray-400 text-sm italic">暂无描述</p>
        )}
      </section>

      {/* 技能/标签行 - 固定高度容器 */}
      <section className="mt-auto h-[28px] overflow-hidden">
        <SingleLineTags
          size="xs"
          tags={(
            Array.isArray((job as any).tags) && (job as any).tags.length > 0
              ? (job as any).tags
              : (job.skills || [])
          ) as string[]}
        />
      </section>
    </article>
  );
}
