import React from 'react'

export default function BrandHero() {
  return (
    <section className="relative overflow-hidden py-10">
      <div className="absolute inset-0 pointer-events-none">
        {/* 渐变海洋背景 */}
        <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-haigoo-primary/15 via-haigoo-secondary/10 to-haigoo-accent/10 blur-3xl animate-float" />
        <div className="absolute -bottom-28 -right-28 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-haigoo-accent/15 via-haigoo-primary/10 to-haigoo-secondary/10 blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />
        {/* 世界线稿网格 */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <linearGradient id="gridLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8B5CF6" stopOpacity="0.4" />
              <stop offset="1" stopColor="#06B6D4" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {Array.from({ length: 16 }).map((_, i) => (
            <path key={i} d={`M 0 ${i * 25} Q 400 ${200 + (i%2===0?20:-20)} 800 ${i * 25}`} stroke="url(#gridLine)" strokeWidth="0.8" fill="none" />
          ))}
        </svg>
      </div>
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold text-gradient">open to the world</h2>
        <p className="mt-2 text-gray-600">Where remote work meets endless possibilities</p>
      </div>
    </section>
  )
}