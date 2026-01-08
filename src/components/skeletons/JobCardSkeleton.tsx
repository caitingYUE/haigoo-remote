import React from 'react';

export const JobCardSkeleton = () => {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm animate-pulse h-full">
      <div className="flex items-start gap-4">
        {/* Logo Skeleton */}
        <div className="w-12 h-12 rounded-lg bg-slate-200 shrink-0" />
        
        <div className="flex-1 min-w-0 space-y-3">
          {/* Title and Badges */}
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-5 bg-slate-200 rounded w-16" />
              <div className="h-5 bg-slate-200 rounded w-20" />
            </div>
          </div>

          {/* Company Info */}
          <div className="flex items-center gap-2">
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="w-1 h-1 rounded-full bg-slate-300" />
            <div className="h-4 bg-slate-200 rounded w-32" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="h-6 bg-slate-200 rounded-full w-20" />
            <div className="h-6 bg-slate-200 rounded-full w-16" />
            <div className="h-6 bg-slate-200 rounded-full w-24" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-50">
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-4 bg-slate-200 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCardSkeleton;
