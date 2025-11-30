import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import JobCard from '../components/JobCard'
import homeBgSvg from '../assets/home_bg.svg'
import { ArrowRight, CheckCircle2, Sparkles, Users, Shield } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { Job } from '../types'

export default function LandingPage() {
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())

  // Load featured domestic jobs
  useEffect(() => {
    const loadFeaturedJobs = async () => {
      try {
        setLoading(true)
        const jobs = await processedJobsService.getAllProcessedJobsFull(12, 1)
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

        setFeaturedJobs(domesticJobs.slice(0, 12))
      } catch (error) {
        console.error('Failed to load featured jobs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFeaturedJobs()
  }, [])

  const toggleSaveJob = (jobId: string) => {
    // Placeholder - actual implementation would require auth
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
      {/* CSS-based Mesh Gradient Background */}
      <div className="mesh-background"></div>

      <div className="hero-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Content */}
          <div className="text-center mb-12">
            <h1 className="hero-title mb-6">
              🌏 国内求职者专属的<br />
              海外远程工作库
            </h1>
            <p className="hero-subtitle mb-8">
              只筛选<strong>国内可申</strong>的高质量海外远程岗位 · 每日人工审核 · 支持AI智能匹配
            </p>

            {/* Value Propositions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-blue-100">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">国内可申筛选</h3>
                <p className="text-sm text-gray-600">精准过滤时区、地理限制，只推荐国内可申请的岗位</p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-purple-100">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mx-auto mb-4">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">每日人工审核</h3>
                <p className="text-sm text-gray-600">不是简单爬虫，每个岗位都经过质量审核</p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-green-100">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI智能匹配</h3>
                <p className="text-sm text-gray-600">上传简历，AI自动推荐最适合的岗位</p>
              </div>
            </div>
          </div>

          {/* Featured Jobs Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                <Users className="inline-block w-6 h-6 mr-2 text-blue-600" />
                精选岗位
              </h2>
              <button
                onClick={() => navigate('/jobs?region=domestic')}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                查看全部岗位
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {featuredJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onSave={() => toggleSaveJob(job.id)}
                    isSaved={savedJobs.has(job.id)}
                    onClick={() => navigate(`/jobs?region=domestic`)}
                  />
                ))}
              </div>
            )}

            {!loading && featuredJobs.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl">
                <p className="text-gray-500">暂无岗位数据，请稍后再试</p>
              </div>
            )}
          </div>

          {/* Job Alert Subscription */}
          <div className="mt-16 max-w-2xl mx-auto">
            <JobAlertSubscribe variant="card" />
          </div>
        </div>
      </div>
    </div>
  )
}
