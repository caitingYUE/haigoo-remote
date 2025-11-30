import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import HomeHero from '../components/HomeHero'
import HomeJobCard from '../components/HomeJobCard'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { ArrowRight, TrendingUp, Building2, Sparkles, Star } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

export default function LandingPage() {
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalJobs: 0, companiesCount: 0, activeUsers: 0 })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [jobs, companies] = await Promise.all([
          processedJobsService.getAllProcessedJobsFull(50, 1),
          trustedCompaniesService.getAllCompanies()
        ])

        // Filter for domestic jobs (reuse logic)
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

        // Filter for featured jobs
        const featured = domesticJobs.filter(job => job.isFeatured === true)
        const displayJobs = featured.length > 0 ? featured : domesticJobs
        setFeaturedJobs(displayJobs.slice(0, 12)) // Show 12 cards

        // Set trusted companies (top 9)
        setTrustedCompanies(companies.slice(0, 9))

        // Set stats
        const uniqueCompanies = new Set(jobs.map(j => j.company).filter(Boolean))
        setStats({
          totalJobs: domesticJobs.length,
          companiesCount: uniqueCompanies.size,
          activeUsers: 1200
        })
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* New Hero Section */}
      <HomeHero stats={stats} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

        {/* Featured Jobs Section */}
        <div id="featured-jobs" className="mt-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-7 h-7 text-yellow-500" />
                  精选岗位
                </h2>
              </div>
              <p className="text-gray-600 ml-7">为你精心挑选的优质远程机会</p>
            </div>
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-medium hover:-translate-y-0.5"
            >
              <span>查看全部 {stats.totalJobs}+ 个岗位</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
            </div>
          ) : featuredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无精选岗位</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredJobs.map((job) => (
                <HomeJobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/jobs?region=domestic`)}
                />
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="px-10 py-4 bg-white text-blue-600 font-semibold rounded-xl border-2 border-blue-600 hover:bg-blue-50 transition-all duration-200 inline-flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              查看更多职位
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trusted Companies Section */}
        <div className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-8 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Star className="w-7 h-7 text-purple-600" />
                  可信企业
                </h2>
              </div>
              <p className="text-gray-600 ml-7">经过验证的优质远程企业</p>
            </div>
            <button
              onClick={() => navigate('/companies')}
              className="text-gray-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1 transition-colors"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
            </div>
          ) : trustedCompanies.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无企业数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {trustedCompanies.map((company) => (
                <HomeCompanyCard
                  key={company.id}
                  company={company}
                  onClick={() => navigate(`/company/${company.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Job Alert Subscription */}
        <div className="mt-24">
          <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl p-10 md:p-16 text-center text-white overflow-hidden shadow-2xl">
            {/* Animated Background */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-blob"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-2000"></div>
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Sparkles className="w-8 h-8" />
                不错过任何机会
              </h2>
              <p className="text-blue-100 mb-10 text-lg">订阅岗位提醒，第一时间获取最新的远程工作机会</p>
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl inline-block w-full max-w-md border border-white/20">
                <JobAlertSubscribe variant="minimal" />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Global Animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}
