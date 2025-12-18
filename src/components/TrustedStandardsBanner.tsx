import React, { useState } from 'react';
import { Building2, ChevronDown, CheckCircle2, ShieldCheck } from 'lucide-react';

interface TrustedStandardsBannerProps {
  className?: string;
  context?: 'job' | 'company';
  isMember?: boolean;
  onShowUpgrade?: () => void;
}

export const TrustedStandardsBanner: React.FC<TrustedStandardsBannerProps> = ({ className = '', context = 'job', isMember = false, onShowUpgrade }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const standards = [
    '官网、LinkedIn等主页信息正常，近期有持续更新',
    '主营业务/产品运营状态正常，且非灰黑产',
    '企业远程文化悠久或远程友好，支持员工成长',
    '有中国业务/分公司或对中国员工友好',
    '岗位来自官方招聘平台发布/内推合作，有可联系的对接人或联系方式'
  ];

  // Force rebuild trigger - v2
  const getIntroText = () => {
    if (context === 'company') {
      return isExpanded
        ? 'Haigoo 只展示经过严格验证、真实存在、对中国人才友好的企业，符合以下 5 项标准：'
        : 'Haigoo 只展示经过严格验证、真实存在、对中国人才友好的企业，让你放心探索远程工作世界。';
    }
    return isExpanded
      ? '该岗位由合作企业官方直接发布，经过 Haigoo 严格审核，符合以下 5 项标准：'
      : '该岗位由合作企业官方直接发布，经过 Haigoo 严格审核，信息真实可靠，您可以放心投递。';
  };

  const handleToggle = () => {
    if (isMember) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={`bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 border border-white/10 rounded-xl overflow-hidden shadow-xl shadow-indigo-900/20 transition-all duration-300 relative group text-white ${className}`}>
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <ShieldCheck className="w-24 h-24 text-white rotate-12" />
      </div>

      {/* Header / Collapsed View */}
      <div
        className="p-4 flex items-start gap-4 cursor-pointer relative z-10"
        onClick={handleToggle}
      >
        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-lg backdrop-blur-sm mt-1">
          <ShieldCheck className="w-5 h-5 text-teal-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-white text-base tracking-tight">Haigoo 俱乐部认证企业</h4>
              <span className="px-2 py-0.5 bg-teal-500/20 text-teal-200 text-xs font-bold rounded-full border border-teal-500/30 whitespace-nowrap shadow-sm backdrop-blur-md">Verified</span>
            </div>
            {isMember && (
              <button className={`p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5" />
              </button>
            )}
          </div>

          <p className="text-sm text-white/80 leading-relaxed pr-8 font-light">
            {getIntroText()}
          </p>
          {!isExpanded && isMember && (
            <p className="text-xs text-indigo-200 mt-2 font-medium flex items-center gap-1 hover:text-white transition-colors">
              点击查看 5 项认证标准 <ChevronDown className="w-3 h-3" />
            </p>
          )}
          {!isMember && onShowUpgrade && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowUpgrade();
              }}
              className="mt-4 px-5 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              解锁认证详情
            </button>
          )}
          {!isMember && !onShowUpgrade && (
            <p className="text-xs text-white/40 mt-2 font-medium flex items-center gap-1">
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-white/60 border border-white/5">Member Only</span>
              认证详情仅会员可见
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
                <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                <span className="text-sm text-white/70 group-hover/item:text-white transition-colors leading-relaxed font-light">
                  {standard}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-xs text-white/40 italic">
              * Haigoo 持续监控企业状态，如发现异常将立即取消认证
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
