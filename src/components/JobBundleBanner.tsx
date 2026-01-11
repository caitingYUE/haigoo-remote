import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Megaphone, Code2, Palette, Briefcase, Rocket } from 'lucide-react';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  job_ids: string[];
}

interface JobBundleBannerProps {
  bundle: JobBundle;
}

// Define Theme Configuration
type ThemeType = 'marketing' | 'dev' | 'design' | 'product' | 'general';

const getTheme = (title: string): ThemeType => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('marketing') || lowerTitle.includes('sales') || lowerTitle.includes('运营') || lowerTitle.includes('市场') || lowerTitle.includes('销售')) return 'marketing';
  if (lowerTitle.includes('dev') || lowerTitle.includes('engineer') || lowerTitle.includes('tech') || lowerTitle.includes('开发') || lowerTitle.includes('技术') || lowerTitle.includes('全栈')) return 'dev';
  if (lowerTitle.includes('design') || lowerTitle.includes('ui') || lowerTitle.includes('ux') || lowerTitle.includes('设计') || lowerTitle.includes('创意')) return 'design';
  if (lowerTitle.includes('product') || lowerTitle.includes('manager') || lowerTitle.includes('产品') || lowerTitle.includes('管理')) return 'product';
  return 'general';
};

const THEMES = {
  marketing: {
    bgClass: 'bg-orange-50/80',
    borderClass: 'border-orange-100',
    iconColor: 'text-orange-600',
    titleColor: 'text-slate-900',
    subtitleColor: 'text-slate-500',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    gradientOverlay: 'bg-gradient-to-br from-orange-50/50 via-transparent to-transparent',
    icon: Megaphone,
    accentColor: 'text-orange-600',
    hoverBorder: 'group-hover:border-orange-200',
    hoverShadow: 'hover:shadow-orange-100'
  },
  dev: {
    bgClass: 'bg-blue-50/80',
    borderClass: 'border-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-slate-900',
    subtitleColor: 'text-slate-500',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    gradientOverlay: 'bg-gradient-to-br from-blue-50/50 via-transparent to-transparent',
    icon: Code2,
    accentColor: 'text-blue-600',
    hoverBorder: 'group-hover:border-blue-200',
    hoverShadow: 'hover:shadow-blue-100'
  },
  design: {
    bgClass: 'bg-purple-50/80',
    borderClass: 'border-purple-100',
    iconColor: 'text-purple-600',
    titleColor: 'text-slate-900',
    subtitleColor: 'text-slate-500',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    gradientOverlay: 'bg-gradient-to-br from-purple-50/50 via-transparent to-transparent',
    icon: Palette,
    accentColor: 'text-purple-600',
    hoverBorder: 'group-hover:border-purple-200',
    hoverShadow: 'hover:shadow-purple-100'
  },
  product: {
    bgClass: 'bg-emerald-50/80',
    borderClass: 'border-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-slate-900',
    subtitleColor: 'text-slate-500',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    gradientOverlay: 'bg-gradient-to-br from-emerald-50/50 via-transparent to-transparent',
    icon: Briefcase,
    accentColor: 'text-emerald-600',
    hoverBorder: 'group-hover:border-emerald-200',
    hoverShadow: 'hover:shadow-emerald-100'
  },
  general: {
    bgClass: 'bg-slate-50/80',
    borderClass: 'border-slate-100',
    iconColor: 'text-indigo-600',
    titleColor: 'text-slate-900',
    subtitleColor: 'text-slate-500',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    gradientOverlay: 'bg-gradient-to-br from-slate-50/50 via-transparent to-transparent',
    icon: Rocket,
    accentColor: 'text-indigo-600',
    hoverBorder: 'group-hover:border-slate-200',
    hoverShadow: 'hover:shadow-slate-100'
  }
};

export default function JobBundleBanner({ bundle }: JobBundleBannerProps) {
  const navigate = useNavigate();
  const themeKey = getTheme(bundle.title);
  const theme = THEMES[themeKey];
  const Icon = theme.icon;

  return (
    <div 
      onClick={() => navigate(`/job-bundles/${bundle.id}`)}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer mb-6 border transition-all duration-300 ${theme.bgClass} ${theme.borderClass} ${theme.hoverBorder} shadow-sm ${theme.hoverShadow}`}
    >
      {/* Subtle Gradient Overlay */}
      <div className={`absolute inset-0 ${theme.gradientOverlay} opacity-60`} />
      
      {/* Decorative Background Elements - Subtle */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/40 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" />

      {/* Content Container */}
      <div className="relative p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        
        {/* Text Content */}
        <div className="flex-1 z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${theme.badgeBg} ${theme.badgeText}`}>
              <Icon className="w-3 h-3" /> 
              精选合集
            </span>
            <span className={`text-xs font-medium ${theme.subtitleColor} flex items-center gap-1`}>
               <span className="w-1 h-1 rounded-full bg-slate-300" />
               {bundle.job_ids?.length || 0} 个优质职位
            </span>
          </div>
          
          <h3 className={`text-xl md:text-2xl font-bold mb-1 tracking-tight ${theme.titleColor}`}>
            {bundle.title}
          </h3>
          
          <p className={`${theme.subtitleColor} text-sm font-medium max-w-xl leading-relaxed line-clamp-1`}>
            {bundle.subtitle}
          </p>
        </div>

        {/* Call to Action Button */}
        <div className="flex-shrink-0 z-10 self-end md:self-center">
            <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white rounded-full shadow-sm border border-slate-100 transition-all duration-300 group-hover:scale-105 group-hover:shadow-md ${theme.accentColor}`}>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
        </div>
      </div>
    </div>
  );
}
