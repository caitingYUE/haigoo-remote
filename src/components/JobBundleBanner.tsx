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
      className="group relative overflow-hidden rounded-xl cursor-pointer mb-4 border transition-all duration-200 hover:shadow-md hover:border-blue-200"
      style={{
        background: isMemberBundle
          ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
          : 'linear-gradient(135deg, #EAF3FF 0%, #f5f8ff 60%, #ffffff 100%)',
        borderColor: isMemberBundle ? '#fde68a' : '#dbeafe',
      }}
    >
      {/* Subtle top-right glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{
          background: isMemberBundle ? '#fbbf24' : '#3182CE',
          transform: 'translate(40%, -40%)',
        }}
      />

      <div className="relative px-5 py-4 flex items-center justify-between gap-4">
        {/* Left: badge + text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: isMemberBundle ? '#fef3c7' : '#EAF3FF',
                color: isMemberBundle ? '#92400e' : '#1A365D',
                border: `1px solid ${isMemberBundle ? '#fde68a' : '#bfdbfe'}`,
              }}
            >
              {isMemberBundle
                ? <><Crown className="w-3 h-3" />会员专属</>
                : <><Layers className="w-3 h-3" />精选合集</>
              }
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {jobCount} 个职位
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 truncate leading-snug">
            {bundle.title}
          </h3>
          <p className="text-sm text-slate-500 truncate mt-0.5">
            {bundle.subtitle}
          </p>
        </div>

        {/* Right: CTA icon */}
        <div className="flex-shrink-0">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 group-hover:scale-105"
            style={{
              backgroundColor: isMemberBundle ? '#fef3c7' : '#EAF3FF',
              borderColor: isMemberBundle ? '#fde68a' : '#bfdbfe',
              color: isMemberBundle ? '#b45309' : '#3182CE',
            }}
          >
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
