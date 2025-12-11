import React, { useState } from 'react';
import { Building2, ChevronDown, CheckCircle2, ShieldCheck } from 'lucide-react';

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
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-xl overflow-hidden shadow-sm transition-all duration-300 relative group ${className}`}>
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
          <ShieldCheck className="w-24 h-24 text-indigo-600 rotate-12" />
      </div>

      {/* Header / Collapsed View */}
      <div 
        className="p-4 flex items-start gap-4 cursor-pointer relative z-10"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 mt-1">
             <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-base">Haigoo 俱乐部认证企业</h4>
                    <span className="px-2 py-0.5 bg-white/60 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100 whitespace-nowrap">Verified</span>
                </div>
                <button className={`p-1 rounded-full hover:bg-indigo-100/50 text-indigo-400 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5" />
                </button>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed pr-8">
                {isExpanded 
                    ? '该岗位由合作企业官方直接发布，经过 Haigoo 严格审核，符合以下 5 项标准：' 
                    : '该岗位由合作企业官方直接发布，经过 Haigoo 严格审核，信息真实可靠，您可以放心投递。'
                }
            </p>
            {!isExpanded && (
                <p className="text-xs text-indigo-500 mt-2 font-medium flex items-center gap-1 hover:text-indigo-600 transition-colors">
                    点击查看 5 项认证标准 <ChevronDown className="w-3 h-3" />
                </p>
            )}
        </div>
      </div>

      {/* Expanded Content */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-5 pt-0 relative z-10 pl-[4.5rem]">
          <div className="space-y-2.5">
            {standards.map((standard, index) => (
              <div key={index} className="flex items-start gap-2.5 group/item">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                <span className="text-sm text-slate-600 group-hover/item:text-slate-900 transition-colors leading-relaxed">
                  {standard}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/50">
             <p className="text-xs text-indigo-400/80 italic">
                * Haigoo 持续监控企业状态，如发现异常将立即取消认证
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
