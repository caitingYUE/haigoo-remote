import React from 'react';
import { MapPin, Clock, DollarSign, ExternalLink, Building, Briefcase, Bookmark } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { processJobDescription } from '../utils/text-formatter';
import { JobTags } from './JobTag';
import { tagUtils, JobTag as JobTagType } from '../utils/tagSystem';

interface RecommendationCardProps {
  job: Job;
  onClick?: (job: Job) => void;
  className?: string;
  onApply?: (jobId: string) => void;
  onToggleSave?: (jobId: string) => void;
  isSaved?: boolean;
  showActions?: boolean;
  /** 是否显示来源外链按钮（默认不显示，以免误认作分享） */
  showSourceLink?: boolean;
  /** 是否显示岗位类型、地点等次要信息（历史卡片默认不显示） */
  showMeta?: boolean;
  /** 仅显示岗位类型 */
  showType?: boolean;
  /** 仅显示地点 */
  showLocation?: boolean;
  /** 仅显示薪资 */
  showSalary?: boolean;
}

export default function RecommendationCard({ job, onClick, className = '', onApply, onToggleSave, isSaved = false, showActions = true, showSourceLink = false, showMeta = true, showType, showLocation, showSalary }: RecommendationCardProps) {
  
  // 生成推荐标签数据
  const generateRecommendationTags = (job: Job): JobTagType[] => {
    const tagTexts: string[] = [];
    
    // 工作类型
    if (job.type) {
      const jobTypeMap: Record<string, string> = {
        'full-time': '全职',
        'part-time': '兼职',
        'contract': '合同',
        'freelance': '自由职业',
        'internship': '实习',
        'remote': '远程'
      };
      tagTexts.push(jobTypeMap[job.type] || job.type);
    }
    
    // 经验要求
    if (job.experienceLevel) {
      const experienceMap: Record<string, string> = {
        'Entry': '初级',
        'Mid': '中级', 
        'Senior': '高级',
        'Lead': '资深',
        'Executive': '专家'
      };
      tagTexts.push(experienceMap[job.experienceLevel] || job.experienceLevel);
    }
    
    // 远程工作标识
    if (job.isRemote) {
      tagTexts.push('远程');
    }
    
    return tagUtils.process(tagTexts);
  };

  const jobTags = generateRecommendationTags(job);

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

  const getCompanyLogo = (company: string) => {
    // 推荐页普通卡片：品牌色系更贴近整体风格
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500'
    ];
    const colorIndex = company.length % colors.length;
    return colors[colorIndex];
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

  // 键盘导航处理
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  // 生成职位卡片的 ARIA 标签
  const getJobCardAriaLabel = () => {
    const parts = [
      `推荐职位：${job.title}`,
      `公司：${job.company}`,
      `薪资：${formatSalary(job.salary)}`,
      `地点：${job.location}`,
      `发布时间：${DateFormatter.formatPublishTime(job.postedAt)}`
    ];
    
    return parts.join('，') + '。点击查看详情';
  };

  return (
    <div 
      className={`cursor-pointer transition-all duration-300 group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}
      onClick={handleCardClick}
      role="article"
      aria-label={getJobCardAriaLabel()}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <div 
            className={`w-12 h-12 rounded-xl ${getCompanyLogo(job.company || '')} flex items-center justify-center text-white font-semibold text-sm mr-4 flex-shrink-0 shadow-sm`}
            aria-hidden="true"
          >
            {(job.company || '未知公司').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 
              className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-haigoo-primary transition-colors mb-1 line-clamp-1"
              title={job.title}
            >
              {job.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Building className="w-4 h-4" />
              <span className="font-medium truncate">{job.company}</span>
            </div>
          </div>
        </div>
        {/* 原始链接按钮（可选） */}
        {showSourceLink && job.sourceUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); window.open(job.sourceUrl!, '_blank', 'noopener,noreferrer'); }}
            className="p-3 text-gray-400 hover:text-haigoo-primary hover:bg-haigoo-primary/10 rounded-lg transition-all duration-200 focus-ring min-w-[44px] min-h-[44px] flex items-center justify-center"
            title={`在 ${job.source} 查看原始职位`}
            aria-label={`在 ${job.source} 查看原始职位`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 关键信息：按当天卡布局，将地点（以及可选薪资）放在描述下方 */}
      {/* 注意：不在此处展示类型，保持与当天卡一致 */}

      {/* 描述 */}
      {job.description && (
        <p id={`job-${job.id}-description`} className="mt-3 text-gray-700 dark:text-gray-300 text-sm line-clamp-2">
          {processJobDescription(job.description, { formatMarkdown: false, maxLength: 120, preserveHtml: false })}
        </p>
      )}

      {(() => {
        const showLocationFinal = (showLocation ?? showMeta) && !!job.location
        const showSalaryFinal = (showSalary ?? showMeta) && !!(job.salary && job.salary.min > 0)
        if (!showLocationFinal && !showSalaryFinal) return null
        return (
          <div className="mt-3 flex items-center justify-between">
            {showLocationFinal && (
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate whitespace-nowrap overflow-hidden" title={job.location}>{job.location}</span>
              </div>
            )}
            {showSalaryFinal && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xl font-bold text-violet-600 dark:text-violet-400">{formatSalary(job.salary)}</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* 技能标签 - 最多3个 +N */}
      {Array.isArray(job.skills) && job.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 mb-2">
          {job.skills.slice(0, 3).map((skill, idx) => (
            <span key={idx} className="px-3 py-1 bg-haigoo-primary/10 text-haigoo-primary rounded-full text-sm font-medium">
              {skill}
            </span>
          ))}
          {job.skills.length > 3 && (
            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm">+{job.skills.length - 3}</span>
          )}
        </div>
      )}

      {/* 底部信息与操作 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700 mt-2">
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{DateFormatter.formatPublishTime(job.postedAt)}</span>
        </div>

        {showActions ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onApply && onApply(job.id); }}
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 text-sm"
            >
              立即申请
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleSave && onToggleSave(job.id); }}
              className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-violet-400 dark:hover:border-violet-500 text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              aria-pressed={isSaved}
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? 'text-violet-600 dark:text-violet-400 fill-current' : ''}`} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 text-sm font-medium">
            <span>查看详情</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}