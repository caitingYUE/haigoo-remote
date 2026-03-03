import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, Lock, Sparkles, Megaphone, Code2, Palette, Briefcase, Rocket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  job_ids: string[];
  visibility?: string;
}

interface JobBundleBannerProps {
  bundle: JobBundle;
}

type ThemeKey = 'marketing' | 'dev' | 'design' | 'product' | 'general';

const getThemeKey = (title: string): ThemeKey => {
  const t = title.toLowerCase();
  if (t.includes('marketing') || t.includes('sales') || t.includes('运营') || t.includes('市场') || t.includes('销售')) return 'marketing';
  if (t.includes('dev') || t.includes('engineer') || t.includes('tech') || t.includes('开发') || t.includes('技术')) return 'dev';
  if (t.includes('design') || t.includes('ui') || t.includes('ux') || t.includes('设计') || t.includes('创意')) return 'design';
  if (t.includes('product') || t.includes('manager') || t.includes('产品') || t.includes('管理')) return 'product';
  return 'general';
};

const THEMES = {
  marketing: { accent: '#ea580c', lightBg: '#fff7ed', icon: Megaphone, label: '运营合集' },
  dev: { accent: '#2563eb', lightBg: '#eff6ff', icon: Code2, label: '技术合集' },
  design: { accent: '#7c3aed', lightBg: '#f5f3ff', icon: Palette, label: '设计合集' },
  product: { accent: '#059669', lightBg: '#ecfdf5', icon: Briefcase, label: '产品合集' },
  general: { accent: '#4f46e5', lightBg: '#eef2ff', icon: Rocket, label: '精选合集' },
};

// Special VIP/member theme
const MEMBER_THEME = {
  accent: '#b45309',
  lightBg: '#fffbeb',
  icon: Crown,
  label: '会员专属',
};

export default function JobBundleBanner({ bundle }: JobBundleBannerProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isMember } = useAuth();

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;

  const themeKey = getThemeKey(bundle.title);
  const theme = isMemberBundle ? MEMBER_THEME : THEMES[themeKey];
  const Icon = theme.icon;
  const jobCount = bundle.job_ids?.length || 0;

  const handleClick = () => {
    if (isLocked) {
      if (!isAuthenticated) {
        navigate(`/login?redirect=/job-bundles/${bundle.id}`);
      } else {
        navigate('/membership');
      }
      return;
    }
    navigate(`/job-bundles/${bundle.id}`);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="group relative flex items-stretch w-full rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer overflow-hidden mb-4"
    >
      {/* Left color accent strip */}
      <div
        className="w-1 flex-shrink-0 rounded-l-2xl transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: theme.accent }}
      />

      {/* Main content */}
      <div className="flex flex-1 items-center justify-between px-4 py-3.5 gap-4">

        {/* Left: badge + text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
              style={{ backgroundColor: theme.lightBg, color: theme.accent }}
            >
              <Icon className="w-3 h-3" />
              {theme.label}
            </span>
            <span className="text-xs text-slate-400">
              · {jobCount} 个职位
            </span>
            {isMemberBundle && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                <Crown className="w-2.5 h-2.5" />
                会员
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-slate-900 truncate leading-snug">
            {bundle.title}
          </h3>
          <p className="text-xs text-slate-500 truncate mt-0.5 leading-relaxed">
            {bundle.subtitle}
          </p>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          {isLocked ? (
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 border border-amber-200 text-amber-500">
              <Lock className="w-4 h-4" />
            </div>
          ) : (
            <div
              className="flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 bg-white transition-all duration-200 group-hover:scale-105 group-hover:border-slate-300"
              style={{ color: theme.accent }}
            >
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
