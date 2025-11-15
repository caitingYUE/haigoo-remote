import React from 'react'

export default function BrandHero() {
  return (
    <section className="container-fluid mt-6 mb-2">
      <div className="relative mx-auto max-w-7xl h-[180px]">
        <img
          src={(import.meta as any).env?.VITE_HERO_LEFT_URL || 'https://images.unsplash.com/photo-1516397281156-ca07cf9746fc?q=80&w=1200&auto=format&fit=crop'}
          alt="remote lifestyle"
          className="absolute left-0 top-0 h-full w-[42%] object-cover rounded-3xl opacity-70 edge-fade-right blur-[0.3px]"
        />
        <img
          src={(import.meta as any).env?.VITE_HERO_RIGHT_URL || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop'}
          alt="world exploration"
          className="absolute right-0 top-0 h-full w-[42%] object-cover rounded-3xl opacity-70 edge-fade-left blur-[0.3px]"
        />
        <div className="absolute inset-0 soft-overlay rounded-3xl" />
      </div>
    </section>
  )
}