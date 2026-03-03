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
      className="group relative overflow-hidden rounded-2xl cursor-pointer mb-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        background: isMemberBundle
          ? 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)'
          : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 45%, #7c3aed 100%)',
      }}
    >
      {/* Subtle decorative orbs */}
      <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 blur-3xl"
        style={{ background: 'white', transform: 'translate(30%, -40%)' }} />
      <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-10 blur-2xl"
        style={{ background: 'white', transform: 'translate(-30%, 40%)' }} />

      {/* Content */}
      <div className="relative px-5 py-4 md:px-6 md:py-5 flex items-center justify-between gap-4">

        {/* Left: badge + text */}
        <div className="flex-1 min-w-0">
          {/* Badge row */}
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm border border-white/20">
              {isMemberBundle
                ? <><Crown className="w-3 h-3" /> 会员专属</>
                : <><Layers className="w-3 h-3" /> 精选合集</>
              }
            </span>
            <span className="text-white/70 text-xs font-medium">
              {jobCount} 个精选职位
            </span>
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/20 text-white/80">
                <Lock className="w-2.5 h-2.5" />
                需解锁
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg md:text-xl font-bold text-white leading-snug truncate">
            {bundle.title}
          </h3>

          {/* Subtitle */}
          <p className="text-white/75 text-sm mt-0.5 truncate">
            {bundle.subtitle}
          </p>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 border border-white/30 text-white backdrop-blur-sm transition-all duration-200 group-hover:bg-white/30 group-hover:scale-105">
            {isLocked
              ? <Lock className="w-4 h-4" />
              : <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
            }
          </div>
        </div>
      </div>
    </div>
  );
}
