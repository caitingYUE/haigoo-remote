import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import JobCard from '../components/JobCard'
import { ArrowRight, CheckCircle2, Sparkles, Users, Shield, TrendingUp, Globe2, Zap } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { Job } from '../types'

export default function LandingPage() {
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ totalJobs: 0, companiesCount: 0, activeUsers: 0 })

  // Load featured domestic jobs
  useEffect(() => {
    const loadFeaturedJobs = async () => {
      try {
        setLoading(true)
        const jobs = await processedJobsService.getAllProcessedJobsFull(50, 1)

        // Filter for domestic jobs (this logic should match JobsPage filtering)
        const domesticJobs = jobs.filter(job => {
          const loc = (job.location || '').toLowerCase()
          const tags = (job.skills || []).map(t => t.toLowerCase())
          const pool = new Set([loc, ...tags])

          const domesticKeywords = ['china', '中国', 'cn', 'apac', 'asia', 'east asia', 'greater china', 'utc+8', 'gmt+8', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chongqing', 'chengdu', 'nanjing', '不限地点']
          const globalKeywords = ['anywhere', 'everywhere', 'worldwide', 'global', '不限地点']
          const overseasKeywords = ['usa', 'united states', 'us', 'uk', 'england', 'britain', 'canada', 'mexico', 'brazil', 'europe', 'eu', 'emea', 'germany', 'france', 'spain', 'italy', 'australia', 'new zealand']

          const hit = (keys: string[]) => keys.some(k => pool.has(k) || loc.includes(k))
          const globalHit = hit(globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
          const domesticHit = hit(domesticKeywords)
          const overseasHit = hit(overseasKeywords)

          return domesticHit || (globalHit && !overseasHit)
        })

        // Filter for featured jobs only
        const featuredJobs = domesticJobs.filter(job => job.isFeatured === true)

        // If no featured jobs, show recent domestic jobs as fallback
        const displayJobs = featuredJobs.length > 0 ? featuredJobs : domesticJobs

        setFeaturedJobs(displayJobs.slice(0, 16))

        // Set stats
        const uniqueCompanies = new Set(jobs.map(j => j.company).filter(Boolean))
        setStats({
          totalJobs: domesticJobs.length,
          companiesCount: uniqueCompanies.size,
          activeUsers: 1200 // Placeholder
        })
      } catch (error) {
        console.error('Failed to load featured jobs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFeaturedJobs()
  }, [])

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
  }

  return (
    <div className="landing-page-wrapper">
      {/* Enhanced Gradient Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5Q0EzQUYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4UzAgOC4wNiAwIDE4czguMDYgMTggMTggMTggMTgtOC4wNiAxOC0xOHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>
      </div>

      <div className="hero-section relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          {/* Hero Content with Animation */}
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6 animate-bounce-subtle">
              <Zap className="w-4 h-4" />
              <span>专为国内求职者打造</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                国内求职者专属的
              </span>
              <br />
              <span className="relative">
                海外远程工作库
                <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 2 100 2 150 6C200 10 250 10 298 6" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#9333EA" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              只筛选<strong className="text-blue-600">国内可申</strong>的高质量海外远程岗位 · 每日人工审核 · 支持AI智能匹配
            </p>

            {/* Social Proof Stats */}
            <div className="flex flex-wrap items-center justify-center gap-8 mb-12 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span><strong className="text-gray-900">{stats.totalJobs}+</strong> 个精选岗位</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-blue-500" />
                <span><strong className="text-gray-900">{stats.companiesCount}+</strong> 家全球企业</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                <span><strong className="text-gray-900">{stats.activeUsers}+</strong> 位求职者</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/jobs?region=domestic')}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
              >
                <span>开始找工作</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('featured-jobs')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
              >
                浏览精选岗位
              </button>
            </div>
          </div>

          {/* Enhanced Value Propositions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20">
            {[
              {
                icon: CheckCircle2,
                title: '国内可申筛选',
                desc: '精准过滤时区、地理限制，只推荐国内可申请的岗位',
                color: 'blue',
                gradient: 'from-blue-500 to-cyan-500'
              },
              {
                icon: Shield,
                title: '每日人工审核',
                desc: '不是简单爬虫，每个岗位都经过质量审核',
                color: 'purple',
                gradient: 'from-purple-500 to-pink-500'
              },
              {
                icon: Sparkles,
                title: 'AI智能匹配',
                desc: '上传简历，AI自动推荐最适合的岗位',
                color: 'green',
                gradient: 'from-green-500 to-emerald-500'
              }
            ].map((item, index) => (
              <div
                key={index}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:border-transparent transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>
                <div className={`flex items-center justify-center w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-xl mx-auto mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-3 text-lg">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Featured Jobs Section */}
          <div id="featured-jobs" className="scroll-mt-20">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                  精选岗位
                </h2>
                <p className="text-gray-600 mt-2 ml-7">为你精心挑选的优质远程机会</p>
              </div>
              <button
                onClick={() => navigate('/jobs?region=domestic')}
                className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium"
              >
                <span>查看全部 {stats.totalJobs}+ 个岗位</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
                </div>
                <p className="mt-6 text-gray-500 font-medium">正在加载精彩岗位...</p>
              </div>
            ) : featuredJobs.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg">暂无岗位数据</p>
                <p className="text-gray-400 text-sm mt-2">我们正在努力为你寻找更多优质岗位</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {featuredJobs.map((job, index) => (
                  <div
                    key={job.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <JobCard
                      job={job}
                      onSave={() => toggleSaveJob(job.id)}
                      isSaved={savedJobs.has(job.id)}
                      onClick={() => navigate(`/jobs?region=domestic`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job Alert Subscription with Enhanced Design */}
          <div className="mt-24 max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-1 shadow-2xl">
              <div className="bg-white rounded-[22px] p-8 md:p-10">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">不错过任何机会</h3>
                  <p className="text-gray-600">订阅岗位提醒，第一时间获取最新的远程工作机会</p>
                </div>
                <JobAlertSubscribe variant="card" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add custom animations */}
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
