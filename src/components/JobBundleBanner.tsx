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
      className="group relative overflow-hidden rounded-2xl cursor-pointer mb-0 border border-indigo-100 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
    >
      {/* Subtle animated orbs — matches homepage membership card */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      <div className="relative px-6 py-5 flex items-center gap-4 min-h-[104px]">

        {/* Left: badge + text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Frosted glass badge — same style as homepage crown badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/60 backdrop-blur-md border border-indigo-100 text-xs font-bold text-indigo-900/80 shadow-sm">
              {isMemberBundle
                ? <><Crown className="w-3 h-3 fill-indigo-900/60" />会员专属</>
                : <><Layers className="w-3 h-3" />精选合集</>
              }
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {jobCount} 个职位
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 truncate">
            {bundle.title}
          </h3>
          <p className="text-sm text-slate-500 truncate mt-0.5">
            {bundle.subtitle}
          </p>
        </div>

        {/* Right: CTA */}
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
