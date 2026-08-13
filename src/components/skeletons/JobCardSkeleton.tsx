import React from 'react';

export const JobCardSkeleton = () => {
  return (
    <div className="h-full animate-pulse border-b border-[#e6e1d8] bg-[#fbfaf6] p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 border border-[#d9d3c9] bg-[#edf4f8]" />
        
        <div className="flex-1 min-w-0 space-y-3">
          {/* Title and Badges */}
          <div className="space-y-2">
            <div className="h-5 w-3/4 bg-[#dfe7e8]" />
            <div className="flex gap-2">
              <div className="h-4 w-16 bg-[#edf1ee]" />
              <div className="h-4 w-20 bg-[#edf1ee]" />
            </div>
          </div>

          {/* Company Info */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-24 bg-[#e6e1d8]" />
            <div className="h-1 w-1 bg-[#c9dce8]" />
            <div className="h-3 w-32 bg-[#e6e1d8]" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="h-5 w-20 border border-[#d9d3c9] bg-[#fffdf8]" />
            <div className="h-5 w-16 border border-[#d9d3c9] bg-[#fffdf8]" />
            <div className="h-5 w-24 border border-[#d9d3c9] bg-[#fffdf8]" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#e6e1d8] pt-3">
            <div className="h-3 w-24 bg-[#e6e1d8]" />
            <div className="h-3 w-20 bg-[#d7e3df]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCardSkeleton;
