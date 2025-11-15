import React from 'react'

export default function BrandHero() {
  return (
    <section className="container-fluid mt-6 mb-4">
      <div className="relative mx-auto max-w-4xl">
        {/* 轻盈的品牌横幅 */}
        <div className="relative rounded-3xl p-8 text-center bg-gradient-to-r from-haigoo-primary/10 via-haigoo-primary/6 to-haigoo-accent/10 border border-white/60 shadow-primary">
          {/* 极淡世界线稿 */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.05]" viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            {Array.from({ length: 12 }).map((_, i) => (
              <path key={i} d={`M 0 ${i * 25} Q 400 ${150 + (i%2===0?14:-14)} 800 ${i * 25}`} stroke="#8B5CF6" strokeWidth="0.8" fill="none" />
            ))}
          </svg>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-semibold haigoo-gradient-text">open to the world</h2>
            <p className="mt-2 text-gray-600">Where remote work meets endless possibilities</p>
          </div>
        </div>
      </div>
    </section>
  )
}
