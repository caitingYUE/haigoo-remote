import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import HomeHero from '../components/HomeHero'
import HomeJobCard from '../components/HomeJobCard'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { ArrowRight, TrendingUp, Building2, Zap } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

export default function LandingPage() {
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>([])
  const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalJobs: 0, companiesCount: 0, activeUsers: 0 })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [jobs, companies] = await Promise.all([
          processedJobsService.getAllProcessedJobsFull(100, 1), // Fetch more jobs for better stats
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

        // Calculate Job Stats per Company
        const statsMap: Record<string, { total: number, categories: Record<string, number> }> = {}
        const normalize = (name: string) => name?.toLowerCase().replace(/[,.]/g, '').replace(/\s+/g, ' ').trim() || ''

        // Use all jobs for stats, not just domestic
        jobs.forEach(job => {
          if (!job.company) return
          const jobCompanyNorm = normalize(job.company)

          // Find matching trusted company
          const company = companies.find(c => {
            const cName = normalize(c.name)
            return cName === jobCompanyNorm || cName.includes(jobCompanyNorm) || jobCompanyNorm.includes(cName)
          })

          if (company) {
            if (!statsMap[company.name]) {
              statsMap[company.name] = { total: 0, categories: {} }
            }
            statsMap[company.name].total++
            const cat = job.category || '其他'
            statsMap[company.name].categories[cat] = (statsMap[company.name].categories[cat] || 0) + 1
          }
        })
        setCompanyJobStats(statsMap)

        // Filter for featured jobs
        const featured = domesticJobs.filter(job => job.isFeatured === true)
        const displayJobs = featured.length > 0 ? featured : domesticJobs
        setFeaturedJobs(displayJobs.slice(0, 12)) // Show 12 cards

        // Sort companies by total active jobs
        const sortedCompanies = [...companies].sort((a, b) => {
          const countA = statsMap[a.name]?.total || 0
          const countB = statsMap[b.name]?.total || 0
          return countB - countA
        })

        // Set trusted companies (top 9)
        setTrustedCompanies(sortedCompanies.slice(0, 9))

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
    <div className="min-h-screen bg-slate-50/50">
      {/* New Hero Section */}
      <HomeHero stats={stats} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">

        {/* Featured Jobs Section */}
        <div id="featured-jobs" className="mt-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                精选机会
              </h2>
              <p className="text-slate-500 text-base">为你精心挑选的优质远程机会</p>
            </div>
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all duration-200 text-sm font-medium shadow-sm"
            >
              <span>查看全部 {stats.totalJobs}+ 个岗位</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-100"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
            </div>
          ) : featuredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无精选岗位</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredJobs.map((job) => (
                <HomeJobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/jobs?region=domestic`)}
                />
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 inline-flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              查看更多职位
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trusted Companies Section */}
        <div className="mt-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                可信企业
              </h2>
              <p className="text-slate-500 text-base">经过验证的优质远程企业</p>
            </div>
            <button
              onClick={() => navigate('/companies')}
              className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1 transition-colors"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-100"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
            </div>
          ) : trustedCompanies.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无企业数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trustedCompanies.map((company) => (
                <HomeCompanyCard
                  key={company.id}
                  company={company}
                  jobStats={companyJobStats[company.name]}
                  onClick={() => navigate(`/company/${company.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Job Alert Subscription */}
        <div className="mt-32">
          <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-10 md:p-20 text-center overflow-hidden border border-blue-100 shadow-lg shadow-blue-50">
            {/* Subtle Background Pattern */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/60 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight text-slate-900 flex items-center justify-center gap-3">
                <Zap className="w-8 h-8 text-blue-600 fill-current" />
                不错过任何机会
              </h2>
              <p className="text-slate-600 mb-10 text-lg leading-relaxed">
                订阅岗位提醒，第一时间获取最新的远程工作机会。<br />
                支持 <span className="font-semibold text-blue-600">Email</span> 和 <span className="font-semibold text-blue-600">飞书</span> 推送，不错过每一个好机会。
              </p>
              <div className="bg-white/50 backdrop-blur-md p-2 rounded-2xl inline-block w-full max-w-md border border-white/50 shadow-sm">
                <JobAlertSubscribe variant="minimal" theme="light" />
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
