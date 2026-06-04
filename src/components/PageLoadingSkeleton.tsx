import React from 'react'

export default function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#fbfaf6]">
      <div className="h-[72px] border-b border-[#e1e9f1] bg-[#fffdf8]/92" />
      <div className="relative flex min-h-[520px] items-center overflow-hidden bg-[#fbfaf6]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(189,220,242,0.32),transparent_32%),linear-gradient(90deg,rgba(255,253,249,0.94)_0%,rgba(255,253,249,0.7)_45%,rgba(255,253,249,0.36)_100%)]" />
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
          <div className="max-w-3xl animate-pulse">
            <div className="mb-7 h-10 w-full max-w-[520px] rounded-full border border-[#eadfc8] bg-white/80"></div>
            <div className="mb-4 h-12 w-[86%] rounded-2xl bg-[#edf1f4] sm:h-16"></div>
            <div className="mb-8 h-12 w-[64%] rounded-2xl bg-[#edf1f4] sm:h-16"></div>
            <div className="mb-8 h-5 w-full max-w-xl rounded-full bg-[#e7edf3]"></div>
            <div className="h-14 w-full max-w-lg rounded-full border border-[#dce8f1] bg-white/84"></div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between animate-pulse">
          <div className="h-8 w-48 rounded-full bg-[#edf1f4]"></div>
          <div className="hidden h-8 w-32 rounded-full bg-[#edf1f4] sm:block"></div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-[22px] border border-[#e3edf4] bg-white/86 p-5 sm:h-44">
              <div className="mb-6 flex gap-4">
                <div className="hidden h-12 w-12 rounded-2xl bg-[#edf1f4] sm:block"></div>
                <div className="flex-1">
                  <div className="mb-2 h-5 w-3/4 rounded-full bg-[#edf1f4]"></div>
                  <div className="h-4 w-1/2 rounded-full bg-[#edf1f4]"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 w-full rounded-full bg-[#edf1f4]"></div>
                <div className="h-4 w-5/6 rounded-full bg-[#edf1f4]"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
