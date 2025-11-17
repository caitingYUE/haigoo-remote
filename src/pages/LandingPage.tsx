import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Rocket, Bot } from 'lucide-react'
import AbstractTechBackground from '../components/AbstractTechBackground'
import HeroIllustration from '../components/HeroIllustration'
import '../styles/landing.css'
import BackgroundImageLayer from '../components/BackgroundImageLayer'
import homeBg from '../assets/home_bg.png'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative">
      <BackgroundImageLayer imageUrl={homeBg} />
      <section className="container-fluid section-padding relative z-10">
        <div className="landing-hero">
          <div className="landing-shield" />
          <div className="grid grid-cols-1 gap-8">
            <h1 className="landing-title">
              WORK YOUR BRAIN,
              <br /> LEAVE YOUR BODY TO BE HAPPY
            </h1>
            <p className="landing-subtitle">Open to the world · Remote jobs · Global opportunities</p>

            {/* 搜索与功能入口 */}
            <div className="space-y-4">
              <div className="landing-search" role="search">
                <label className="sr-only" htmlFor="landing-search-input">Search for remote jobs</label>
                <div className="landing-search-bar" aria-label="Search for remote jobs">
                  <Search className="w-5 h-5 text-gray-500" aria-hidden />
                  <input id="landing-search-input" className="landing-search-input" placeholder="Search for remote jobs..." />
                  <button onClick={() => navigate('/jobs')} className="landing-explore" aria-label="Explore jobs">
                    <span>Explore Jobs</span>
                  </button>
                </div>
              </div>
              <div className="landing-pills">
                <button onClick={() => navigate('/copilot')} className="landing-pill">
                  <Bot className="w-5 h-5" /> Try AI Copilot
                </button>
              </div>
              <div className="landing-features">
                <div className="landing-card" role="link" tabIndex={0} onClick={() => navigate('/jobs')} onKeyDown={(e)=>{ if(e.key==='Enter') navigate('/jobs') }} aria-label="Global opportunities">
                  <div className="flex items-center gap-3">
                    <span className="landing-icon orange"><Rocket className="w-5 h-5" /></span>
                    <div>
                      <div className="title">GLOBAL OPPORTUNITIES</div>
                      <div className="desc">Find jobs across continents</div>
                    </div>
                  </div>
                </div>
                <div className="landing-card" role="link" tabIndex={0} onClick={() => navigate('/copilot')} onKeyDown={(e)=>{ if(e.key==='Enter') navigate('/copilot') }} aria-label="Smart career path">
                  <div className="flex items-center gap-3">
                    <span className="landing-icon teal"><Bot className="w-5 h-5" /></span>
                    <div>
                      <div className="title">SMART CAREER PATH</div>
                      <div className="desc">AI-powered guidance</div>
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