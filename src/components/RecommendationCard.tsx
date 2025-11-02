import React from 'react';
import { MapPin, Clock, DollarSign, ExternalLink, Building, Briefcase, Star, Sparkles } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { processJobDescription } from '../utils/text-formatter';
import { JobTags } from './JobTag';
import { tagUtils, JobTag as JobTagType } from '../utils/tagSystem';

interface RecommendationCardProps {
  job: Job;
  onClick?: (job: Job) => void;
  className?: string;
}

export default function RecommendationCard({ job, onClick, className = '' }: RecommendationCardProps) {
  
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
    // 使用低饱和中性色，避免刺眼的高饱和配色
    const colors = [
      'bg-gradient-to-br from-gray-200 to-gray-300',
      'bg-gradient-to-br from-slate-200 to-slate-300', 
      'bg-gradient-to-br from-zinc-200 to-zinc-300',
      'bg-gradient-to-br from-neutral-200 to-neutral-300',
      'bg-gradient-to-br from-stone-200 to-stone-300',
      'bg-gradient-to-br from-gray-300 to-gray-400'
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
      className={`group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-gray-200 overflow-hidden ${className}`}
      onClick={handleCardClick}
    >
      {/* 顶部背景采用柔和中性色渐变 */}
      <div className="h-24 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 relative">
        {/* 公司Logo */}
        <div className="absolute top-3 left-4">
          <div className={`w-12 h-12 rounded-xl ${getCompanyLogo(job.company || '')} flex items-center justify-center text-gray-800 font-bold text-base border-2 border-white/30 shadow-lg backdrop-blur-sm`}>
          {(job.company || '未知公司').charAt(0).toUpperCase()}
          </div>
        </div>
        
        {/* 推荐标识 */}
        <div className="absolute top-3 right-4">
          <div className="bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">精选</span>
          </div>
        </div>
      </div>

      {/* 卡片内容 */}
      <div className="p-5">
        {/* 职位标题 */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate group-hover:text-gray-800 transition-colors" title={job.title}>
          {job.title}
        </h3>
        
        {/* 公司信息 */}
        <div className="flex items-center gap-2 mb-3">
          <Building className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600 font-medium">{job.company}</span>
        </div>
        
        {/* 工作类型和地点 */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{job.type}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{job.location}</span>
          </div>
        </div>
        
        {/* 薪资 - 只有当薪资数据存在且大于0时才显示 */}
        {job.salary && job.salary.min > 0 && (
          <div className="flex items-center gap-1 mb-4">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-600">{formatSalary(job.salary)}</span>
          </div>
        )}
        
        {/* 标签 */}
         {jobTags.length > 0 && (
           <div className="mb-4">
             <JobTags tags={jobTags} maxTags={3} />
           </div>
         )}
         
         {/* 底部信息 */}
         <div className="flex items-center justify-between pt-3 border-t border-gray-100">
           <div className="flex items-center gap-1 text-xs text-gray-500">
             <Clock className="w-3.5 h-3.5" />
             <span>{DateFormatter.formatPublishTime(job.postedAt)}</span>
           </div>
          <div className="flex items-center gap-1 text-gray-700 text-sm font-medium">
            <span>查看详情</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}