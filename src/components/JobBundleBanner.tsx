import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, Lock, Layers } from 'lucide-react';
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

// Default full-width banner (kept for compatibility)
export default function JobBundleBanner({ bundle }: JobBundleBannerProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isMember } = useAuth();

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;
  const jobCount = bundle.job_ids?.length || 0;

  const handleClick = () => {
    if (isLocked) {
      navigate(!isAuthenticated ? `/login?redirect=/job-bundles/${bundle.id}` : '/membership');
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
      className="group relative overflow-hidden rounded-2xl cursor-pointer mb-0 border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(243,244,255,1),rgba(239,246,255,1))]"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
      <div className="relative pl-4 pr-8 py-4 flex items-center gap-4 min-h-[104px]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 backdrop-blur-md border border-slate-200 text-xs font-bold text-slate-800 shadow-sm">
              {isMemberBundle
                ? <><Crown className="w-3 h-3 fill-indigo-900/60" />会员专属</>
                : <><Layers className="w-3 h-3" />精选合集</>
              }
            </span>
            <span className="text-xs text-slate-600 font-medium">{jobCount} 个职位</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 truncate">{bundle.title}</h3>
          <p className="text-sm text-slate-500 truncate mt-0.5">{bundle.subtitle}</p>
        </div>
        <div className="flex-shrink-0">
          {isLocked ? (
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/60 border border-indigo-100 text-indigo-400 backdrop-blur-md">
              <Lock className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-md shadow-indigo-200/50 transition-transform duration-200 group-hover:scale-105 bg-indigo-600">
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Light-colour themes — soft pastel look matching the overall indigo/slate design system
const CARD_THEMES = [
  {
    bg: 'bg-[linear-gradient(135deg,rgba(219,252,244,0.98),rgba(229,247,255,0.96),rgba(255,255,255,0.98))]',
    border: 'border-emerald-200/90 hover:border-emerald-300',
    badge: 'bg-white/80 text-slate-700 border-slate-200',
    title: 'text-slate-900',
    sub: 'text-slate-600',
    count: 'bg-white/80 text-slate-700 border border-slate-200',
    arrow: 'bg-indigo-600 text-white shadow-sm',
    orb1: 'bg-emerald-200/58',
    orb2: 'bg-sky-200/46',
  },
  {
    bg: 'bg-[linear-gradient(135deg,rgba(238,236,255,0.98),rgba(236,247,255,0.95),rgba(255,255,255,0.98))]',
    border: 'border-indigo-200/90 hover:border-indigo-300',
    badge: 'bg-white/80 text-slate-700 border-slate-200',
    title: 'text-slate-900',
    sub: 'text-slate-600',
    count: 'bg-white/80 text-slate-700 border border-slate-200',
    arrow: 'bg-indigo-600 text-white shadow-sm',
    orb1: 'bg-violet-200/48',
    orb2: 'bg-sky-200/42',
  },
  {
    bg: 'bg-[linear-gradient(135deg,rgba(255,239,221,0.98),rgba(255,247,227,0.95),rgba(255,255,255,0.98))]',
    border: 'border-amber-200/90 hover:border-amber-300',
    badge: 'bg-white/80 text-slate-700 border-slate-200',
    title: 'text-slate-900',
    sub: 'text-slate-600',
    count: 'bg-white/80 text-slate-700 border border-slate-200',
    arrow: 'bg-indigo-600 text-white shadow-sm',
    orb1: 'bg-amber-200/54',
    orb2: 'bg-orange-200/40',
  }
];

/**
 * Adaptive-width card for the bundle carousel.
 *
 * Layout rules (controlled by the parent carousel container in JobsPage):
 *   1 bundle  → card fills full width (flex-1)
 *   2 bundles → each card is ~50% width
 *   3+ bundles → fixed width so they peek to indicate scrollability
 *
 * The parent passes `totalCount` and `index` so this card can style itself.
 */
interface JobBundleCardProps extends JobBundleBannerProps {
  totalCount: number;
}

export function JobBundleCard({ bundle, totalCount }: JobBundleCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isMember } = useAuth();

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;
  const jobCount = bundle.job_ids?.length || 0;
  const theme = CARD_THEMES[bundle.id % CARD_THEMES.length];

  const handleClick = () => {
    if (isLocked) {
      navigate(!isAuthenticated ? `/login?redirect=/job-bundles/${bundle.id}` : '/membership');
      return;
    }
    navigate(`/job-bundles/${bundle.id}`);
  };

  // width strategy:
  // ≤3 bundles → flex-1 (fill the row equally like the job cards)
  // ≥4 → fixed 220px so card 3.5 peeks out on the right
  const widthClass = totalCount <= 3 ? 'flex-1' : 'flex-shrink-0 w-[236px]';

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={`group relative ${widthClass} rounded-[26px] overflow-hidden cursor-pointer border shadow-[0_20px_44px_-34px_rgba(15,23,42,0.22)]
        transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_54px_-34px_rgba(15,23,42,0.24)] select-none
        ${theme.bg} ${theme.border}`}
      style={{ minHeight: '126px' }}
    >
      {/* Decorative orbs */}
      <div className={`absolute -top-6 -right-5 h-24 w-24 ${theme.orb1} rounded-full blur-2xl pointer-events-none`} />
      <div className={`absolute -bottom-5 left-10 h-16 w-24 ${theme.orb2} rounded-full blur-2xl pointer-events-none`} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.22),transparent_38%,rgba(255,255,255,0.15)_68%,transparent)] opacity-80" />

      <div className="relative flex h-full flex-col justify-between p-4" style={{ minHeight: '126px' }}>
        {/* Badge row */}
        <div className="mb-3 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold backdrop-blur-sm ${theme.badge}`}>
            {isMemberBundle
              ? <><Crown className="w-2.5 h-2.5" />会员专属</>
              : <><Layers className="w-2.5 h-2.5" />精选合集</>
            }
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${theme.count}`}>
            {jobCount}个
          </span>
        </div>

        {/* Title */}
        <div className="flex-1 flex items-center">
          <h3 className={`text-[15px] font-black leading-snug line-clamp-2 tracking-tight ${theme.title}`}>
            {bundle.title}
          </h3>
        </div>

        {/* Bottom: subtitle + arrow */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <span className={`line-clamp-2 flex-1 text-[11px] leading-5 ${theme.sub}`}>
            {bundle.subtitle}
          </span>
          <div className={`flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0
            transition-all duration-200 group-hover:scale-110 shadow-sm ${
              isLocked ? 'bg-white/60 border border-current/20 opacity-60' : `${theme.arrow}`
            }`}
          >
            {isLocked
              ? <Lock className="w-3.5 h-3.5" />
              : <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
            }
          </div>
        </div>
      </div>
    </div>
  );
}
