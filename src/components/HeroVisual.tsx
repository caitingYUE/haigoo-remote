import React from 'react'
import { Search, Rocket, Bot } from 'lucide-react'

export default function HeroVisual({ onExplore, onCopilot }: { onExplore: () => void, onCopilot?: () => void }) {
  return (
    <section className="container-fluid mt-6 mb-8">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* 左侧插画与标语占位（实际视觉由设计稿替换）*/}
        <div className="rounded-3xl bg-gradient-to-br from-orange-100 via-indigo-50 to-emerald-50 p-6 border border-slate-200">
          <div className="h-40 md:h-56 rounded-2xl bg-white/60 border border-white/80" />
          <h2 className="mt-6 text-2xl md:text-3xl font-bold text-slate-900">Work your brain, leave your body to be happy</h2>
          <p className="mt-2 text-slate-600">Open to the world · Remote jobs · Global opportunities</p>
        </div>

        {/* 右侧搜索与CTA */}
        <div className="space-y-4">
          <div className="flex w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center px-4 text-slate-500"><Search className="w-5 h-5" /></div>
            <input className="flex-1 p-4 outline-none" placeholder="Search for remote jobs..." />
            <button onClick={onExplore} className="px-6 py-3 bg-slate-900 text-white font-medium">Explore Jobs</button>
          </div>
          {onCopilot && (
            <button onClick={onCopilot} className="btn btn-secondary inline-flex items-center gap-2">
              <Bot className="w-5 h-5" /> Try AI Copilot
            </button>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-5 bg-white">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-orange-100 text-orange-600"><Rocket className="w-5 h-5" /></span>
                <div>
                  <div className="font-semibold">Global Opportunities</div>
                  <div className="text-sm text-slate-600">Find jobs across continents</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border p-5 bg-white">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600"><Bot className="w-5 h-5" /></span>
                <div>
                  <div className="font-semibold">Smart Career Path</div>
                  <div className="text-sm text-slate-600">AI-powered guidance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}