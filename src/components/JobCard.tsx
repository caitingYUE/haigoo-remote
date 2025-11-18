import React, { useState } from 'react';
import { MapPin, Clock, DollarSign, ExternalLink, Building, Briefcase, Globe, Award } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { processJobDescription } from '../utils/text-formatter';
// 移除语义标签行：不再使用 JobTags/tagUtils，仅保留描述下的处理后技能标签

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
      className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#3182CE]/30 transition-all duration-300 cursor-pointer relative hover:-translate-y-0.5"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-label={getJobCardAriaLabel()}
      aria-describedby={`job-${job.id}-description`}
    >
      {/* 右上角操作按钮组 - 仅保留原始链接跳转 */}
      {job.sourceUrl && (
        <div 
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          role="toolbar"
          aria-label="职位操作"
        >
          <button
            onClick={handleSourceClick}
            onKeyDown={handleSourceKeyDown}
            className="p-3 text-gray-400 hover:text-[#3182CE] hover:bg-[#EAF3FF] rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title={`在 ${job.source} 查看原始职位`}
            aria-label={`在 ${job.source} 查看原始职位`}
            tabIndex={0}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between pr-12">
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h2 
              id={`job-${job.id}-title`}
              className="font-semibold text-brand-navy text-lg md:text-xl hover:text-brand-blue transition-colors mb-1 line-clamp-2"
              title={job.translations?.title || job.title}
            >
              {job.translations?.title || job.title}
            </h2>
            
            {/* 公司信息行 - 移除来源标签，避免与底部重复 */}
            <div className="flex items-center text-gray-600 text-sm mb-2">
              <div className="flex items-center font-medium min-w-0">
                <Building className="w-4 h-4 mr-1.5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate" title={job.translations?.company || job.company}>{job.translations?.company || job.company}</span>
              </div>
            </div>
            
            {/* 核心信息行 */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {/* 薪资 - 只有当薪资数据存在且大于0时才显示 */}
              {job.salary && job.salary.min > 0 && (
                <div className="flex items-center text-haigoo-primary font-semibold">
                  <DollarSign className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
                  <span aria-label={`薪资：${formatSalary(job.salary)}`}>
                    {formatSalary(job.salary)}
                  </span>
                </div>
              )}
              
              {/* 地点（统一为历史推荐卡片风格） */}
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300 min-w-0 max-w-[200px]">
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
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    job.type === 'full-time' ? 'bg-green-100 text-green-700' :
                    job.type === 'contract' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}
                  aria-label={`工作类型：${getJobTypeLabel(job.type)}`}
                >
                  <Briefcase className="w-3 h-3 inline mr-1" aria-hidden="true" />
                  {getJobTypeLabel(job.type)}
                </span>
              </div>
              
              {/* 发布时间 */}
              <div className="flex items-center text-gray-500">
                <Clock className="w-4 h-4 mr-1" aria-hidden="true" />
                <time 
                  className="whitespace-nowrap"
                  dateTime={job.postedAt}
                  aria-label={`发布时间：${DateFormatter.formatPublishTime(job.postedAt)}`}
                >
                  {DateFormatter.formatPublishTime(job.postedAt)}
                </time>
              </div>
            </div>
            
            {/* 移除地点下方的语义标签行 */}
          </div>
        </div>
      </header>

      {/* 职位描述 - 优化HTML标签处理，优先显示翻译 */}
      {(job.translations?.description || job.description) && (
        <section className="mt-3">
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
        </section>
      )}

      {/* 技能/标签行 - 永远渲染以保证卡片高度一致；当无标签时使用兜底 */}
      <section className="mt-2">
        <SingleLineTags
          size="xs"
          tags={(
            Array.isArray((job as any).tags) && (job as any).tags.length > 0
              ? (job as any).tags
              : (job.skills || [])
          ) as string[]}
          fallback="remote"
        />
      </section>

      
    </article>
  );
}
import { SingleLineTags } from './SingleLineTags';