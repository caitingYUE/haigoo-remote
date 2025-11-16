import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Rocket, Bot } from 'lucide-react'
import AbstractTechBackground from '../components/AbstractTechBackground'
import HeroIllustration from '../components/HeroIllustration'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative">
      <AbstractTechBackground />
      <section className="container-fluid section-padding relative z-10">
        <div className="mx-auto max-w-7xl rounded-3xl p-8 bg-white/70 backdrop-blur-md border border-white/60 shadow-primary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* 左侧：品牌插画占位与主标语 */}
            <div>
              <div className="h-64 md:h-80 rounded-2xl border overflow-hidden bg-white/70">
                { (import.meta as any).env?.VITE_LANDING_HERO_IMAGE_URL
                  ? <div style={{backgroundImage:`url(${(import.meta as any).env?.VITE_LANDING_HERO_IMAGE_URL})`,backgroundSize:'cover',backgroundPosition:'center'}} className="w-full h-full" />
                  : <HeroIllustration />
                }
              </div>
              <h1 className="mt-6 text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                WORK YOUR BRAIN,
                <br /> LEAVE YOUR BODY TO BE HAPPY
              </h1>
              <p className="mt-2 text-gray-600">Open to the world · Remote jobs · Global opportunities</p>
            </div>

            {/* 右侧：搜索与功能入口 */}
            <div className="space-y-6">
              <div className="flex w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center px-4 text-gray-500"><Search className="w-5 h-5" /></div>
                <input className="flex-1 p-4 outline-none" placeholder="Search for remote jobs..." />
                <button onClick={() => navigate('/jobs')} className="px-6 py-3 bg-gray-900 text-white font-medium">Explore Jobs</button>
              </div>
              <div>
                <button onClick={() => navigate('/copilot')} className="btn btn-secondary inline-flex items-center gap-2">
                  <Bot className="w-5 h-5" /> Try AI Copilot
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-2xl border p-6 bg-white">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-orange-100 text-orange-600"><Rocket className="w-5 h-5" /></span>
                    <div>
                      <div className="font-semibold">Global Opportunities</div>
                      <div className="text-sm text-gray-600">Find jobs across continents</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border p-6 bg-white">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600"><Bot className="w-5 h-5" /></span>
                    <div>
                      <div className="font-semibold">Smart Career Path</div>
                      <div className="text-sm text-gray-600">AI-powered guidance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚由全局 Footer 统一渲染，这里不重复 */}
    </div>
  )
}