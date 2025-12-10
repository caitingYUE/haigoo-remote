import React, { useState } from 'react';
import { Building2, ChevronDown, CheckCircle2 } from 'lucide-react';

interface TrustedStandardsBannerProps {
  className?: string;
}

export const TrustedStandardsBanner: React.FC<TrustedStandardsBannerProps> = ({ className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const standards = [
    '官网、LinkedIn等主页信息正常，近期有持续更新',
    '主营业务/产品运营状态正常，且非灰黑产',
    '企业远程文化悠久或远程友好，支持员工成长',
    '有中国业务/分公司或对中国员工友好',
    '岗位来自官方招聘平台发布/内推合作，有可联系的对接人或联系方式'
  ];

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${className}`}>
      {/* Header / Collapsed View */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 border border-blue-100 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
              俱乐部可信企业标准
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-medium hidden sm:inline-block">
                严选认证
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isExpanded ? '以下条件缺一不可，保障求职安全' : '点击查看 5 项严格筛选标准，保障求职安全'}
            </p>
          </div>
        </div>
        <button className={`p-1.5 rounded-full hover:bg-blue-100/50 text-blue-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Expanded Content */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-5 pt-0">
          <div className="h-px w-full bg-blue-100/50 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {standards.map((standard, index) => (
              <div key={index} className="flex items-start gap-2.5 group">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors leading-relaxed">
                  {standard}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
