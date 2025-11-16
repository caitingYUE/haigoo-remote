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
          <div className="grid grid-cols-1 gap-8">
            <h1 className="landing-title">
              WORK YOUR BRAIN,
              <br /> LEAVE YOUR BODY TO BE HAPPY
            </h1>
            <p className="landing-subtitle">Open to the world · Remote jobs · Global opportunities</p>

            {/* 搜索与功能入口 */}
            <div className="space-y-4">
              <div className="landing-search">
                <div className="landing-search-bar">
                  <Search className="w-5 h-5 text-gray-500" />
                  <input className="landing-search-input" placeholder="Search for remote jobs..." />
                  <button onClick={() => navigate('/jobs')} className="landing-explore">
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
                <div className="landing-card">
                  <div className="flex items-center gap-3">
                    <span className="landing-icon orange"><Rocket className="w-5 h-5" /></span>
                    <div>
                      <div className="title">GLOBAL OPPORTUNITIES</div>
                      <div className="desc">Find jobs across continents</div>
                    </div>
                  </div>
                </div>
                <div className="landing-card">
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