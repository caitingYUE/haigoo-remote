import React from 'react'

export default function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Skeleton */}
      <div className="relative min-h-[400px] md:min-h-[600px] flex items-center justify-center bg-slate-50 overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl animate-pulse">
            <div className="h-8 bg-slate-200 rounded-full w-48 mb-6"></div>
            <div className="h-12 md:h-16 bg-slate-200 rounded-lg w-3/4 mb-4"></div>
            <div className="h-12 md:h-16 bg-slate-200 rounded-lg w-1/2 mb-8"></div>
            <div className="h-6 bg-slate-200 rounded w-full max-w-xl mb-10"></div>
            <div className="h-14 bg-slate-200 rounded-2xl w-full max-w-lg"></div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-48"></div>
          <div className="h-8 bg-slate-100 rounded w-32"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-6 h-64 animate-pulse">
              <div className="flex gap-4 mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-5 bg-slate-100 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-4 bg-slate-100 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
