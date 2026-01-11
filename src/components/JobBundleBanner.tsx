import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Megaphone, Code2, Palette, Briefcase, TrendingUp, Globe2, Rocket } from 'lucide-react';

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
    gradient: 'from-orange-500 via-rose-500 to-pink-600',
    bgLight: 'bg-orange-50',
    textLight: 'text-orange-600',
    borderLight: 'border-orange-100',
    icon: Megaphone,
    shadowColor: 'shadow-orange-500/20',
    accentColor: 'text-orange-500'
  },
  dev: {
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    bgLight: 'bg-blue-50',
    textLight: 'text-blue-600',
    borderLight: 'border-blue-100',
    icon: Code2,
    shadowColor: 'shadow-blue-500/20',
    accentColor: 'text-blue-500'
  },
  design: {
    gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
    bgLight: 'bg-fuchsia-50',
    textLight: 'text-fuchsia-600',
    borderLight: 'border-fuchsia-100',
    icon: Palette,
    shadowColor: 'shadow-fuchsia-500/20',
    accentColor: 'text-fuchsia-500'
  },
  product: {
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    bgLight: 'bg-emerald-50',
    textLight: 'text-emerald-600',
    borderLight: 'border-emerald-100',
    icon: Briefcase,
    shadowColor: 'shadow-emerald-500/20',
    accentColor: 'text-emerald-500'
  },
  general: {
    gradient: 'from-indigo-500 via-purple-500 to-indigo-600',
    bgLight: 'bg-indigo-50',
    textLight: 'text-indigo-600',
    borderLight: 'border-indigo-100',
    icon: Rocket,
    shadowColor: 'shadow-indigo-500/20',
    accentColor: 'text-indigo-500'
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
      className={`group relative overflow-hidden rounded-2xl cursor-pointer mb-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${theme.shadowColor} shadow-lg`}
    >
      {/* Dynamic Background */}
      <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-95 group-hover:opacity-100 transition-opacity duration-300`} />
      
      {/* Abstract Patterns/Overlay */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl" />

      {/* Content Container */}
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        
        {/* Text Content */}
        <div className="flex-1 text-white z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md border border-white/20 text-white shadow-sm">
              <Icon className="w-3.5 h-3.5" /> 
              精选合集
            </span>
            <span className="text-xs font-medium text-white/80 flex items-center gap-1">
               <span className="w-1 h-1 rounded-full bg-white/60" />
               {bundle.job_ids?.length || 0} 个优质职位
            </span>
          </div>
          
          <h3 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight text-white drop-shadow-sm">
            {bundle.title}
          </h3>
          
          <p className="text-white/90 text-sm md:text-base font-medium max-w-xl leading-relaxed">
            {bundle.subtitle}
          </p>
        </div>

        {/* Call to Action Button */}
        <div className="flex-shrink-0 z-10">
            <div className="group/btn relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-lg text-indigo-600 transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-10deg]">
                <ArrowRight className={`w-5 h-5 md:w-6 md:h-6 ${theme.accentColor}`} />
                {/* Ripple Effect hint */}
                <div className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping opacity-0 group-hover:opacity-100" />
            </div>
        </div>
      </div>
    </div>
  );
}
