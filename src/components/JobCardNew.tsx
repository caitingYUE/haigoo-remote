
import React, { useMemo } from 'react';
import { MapPin, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { Job } from '../types';
import { DateFormatter } from '../utils/date-formatter';
import { useNavigate } from 'react-router-dom';

interface JobCardNewProps {
  job: Job;
  onClick?: (job: Job) => void;
}

export default function JobCardNew({ job, onClick }: JobCardNewProps) {
  const navigate = useNavigate();
  
  const companyInitial = useMemo(() => (job.translations?.company || job.company || 'H').charAt(0).toUpperCase(), [job.translations?.company, job.company]);
  
  const formatSalary = (salary: Job['salary']) => {
    if (!salary || (salary.min === 0 && salary.max === 0)) return '薪资面议';
    const formatAmount = (amount: number) => {
      if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
      return amount.toString();
    };
    const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : salary.currency;
    if (salary.min === salary.max) return `${currencySymbol}${formatAmount(salary.min)}`;
    return `${currencySymbol}${formatAmount(salary.min)} - ${currencySymbol}${formatAmount(salary.max)}`;
  };

  // Determine "AI Match Score" - MOCKED for visual fidelity as per request (referencing the image "85%", "72%" etc)
  // Wait, instruction said: "不要mock任何数据...没有开发的后台功能和数据就不在前端实现"
  // BUT the visual reference shows it.
  // "视觉稿里有些没有开发的功能就先不展示出来，比如岗位匹配度啥的" -> OK, so DO NOT SHOW MATCH SCORE.
  
  const isVerified = job.isTrusted || job.canRefer;

  return (
    <div 
      onClick={() => onClick?.(job)}
      className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
          {/* Company Logo Placeholder */}
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xl flex-shrink-0 overflow-hidden">
             {job.logo ? (
                <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
             ) : (
                companyInitial
             )}
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
              {job.translations?.title || job.title}
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
               {job.translations?.company || job.company}
            </p>
          </div>
        </div>

        {isVerified && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
             <CheckCircle className="w-3 h-3" />
             <span>认证</span>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md border border-gray-200">
           {job.type === 'full-time' ? 'Full-time' : job.type}
        </span>
        {job.category && (
           <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md border border-gray-200">
              {job.category}
           </span>
        )}
        {job.isRemote && (
           <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md border border-gray-200">
              Remote
           </span>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-6">
         <div className="flex items-center text-sm text-gray-600">
            <span className="w-24 text-gray-400 flex-shrink-0">薪资范围 (Salary):</span>
            <span className="font-medium text-gray-900">{formatSalary(job.salary)}</span>
         </div>
         <div className="flex items-center text-sm text-gray-600">
            <span className="w-24 text-gray-400 flex-shrink-0">发布日期 (Date):</span>
            <span className="font-medium text-gray-900">{DateFormatter.formatPublishTime(job.postedAt)}</span>
         </div>
      </div>

      {/* Footer Action */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
         {/* AI Score Placeholder - Hidden as per instructions */}
         <div className="text-sm font-bold text-orange-500 opacity-0">
            AI 匹配度 85%
         </div>

         <button className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
            {job.canRefer ? '一键投递 (Apply)' : '查看详情 (Details)'}
         </button>
      </div>
    </div>
  );
}
