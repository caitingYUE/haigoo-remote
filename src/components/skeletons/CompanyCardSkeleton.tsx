import React from 'react';

export const CompanyCardSkeleton = () => {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm animate-pulse h-full flex flex-col items-center text-center">
      {/* Logo */}
      <div className="w-16 h-16 rounded-xl bg-slate-200 mb-4" />
      
      {/* Name */}
      <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
      
      {/* Description */}
      <div className="h-4 bg-slate-200 rounded w-full mb-4" />
      
      {/* Stats */}
      <div className="flex gap-4 w-full justify-center mt-auto pt-4 border-t border-slate-50">
        <div className="h-4 bg-slate-200 rounded w-12" />
        <div className="h-4 bg-slate-200 rounded w-12" />
      </div>
    </div>
  );
};

export default CompanyCardSkeleton;
