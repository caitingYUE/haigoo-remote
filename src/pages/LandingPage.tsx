import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import HomeHero from '../components/HomeHero'
import JobCardNew from '../components/JobCardNew'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { ArrowRight, TrendingUp, Building2, Zap, Users, Target, Award, Briefcase } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

export default function LandingPage() {
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>([])
  const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalJobs: 0, companiesCount: 0, dailyJobs: 0 })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // 1. Fetch real stats from backend
        try {
            const statsResp = await fetch('/api/admin-ops?action=stats')
            const statsData = await statsResp.json()
            if (statsData.success && statsData.stats) {
                setStats({
                    totalJobs: statsData.stats.domesticJobs || statsData.stats.totalJobs,
                    companiesCount: statsData.stats.companiesCount,
                    dailyJobs: statsData.stats.dailyJobs || 0
                })
            }
        } catch (e) {
            console.error('Failed to fetch stats:', e)
        }

        const [jobs, companies, featuredResp] = await Promise.all([
          processedJobsService.getAllProcessedJobs(1000), // Fetch more jobs (up to 1000) for better company stats sorting
          trustedCompaniesService.getAllCompanies(),
          processedJobsService.getProcessedJobs(1, 6, { isFeatured: true })
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
        if (featuredResp && featuredResp.jobs && featuredResp.jobs.length > 0) {
            setFeaturedJobs(featuredResp.jobs)
        } else {
            const featured = domesticJobs.filter(job => job.isFeatured === true)
            setFeaturedJobs(featured.slice(0, 6))
        }

        // Sort companies by total active jobs (using database count)
        const sortedCompanies = [...companies].sort((a, b) => {
          return (b.jobCount || 0) - (a.jobCount || 0)
        })

        // Set trusted companies (top 6)
        setTrustedCompanies(sortedCompanies.slice(0, 6))

        // Set stats (Use backend stats if available, otherwise fallback)
        // const uniqueCompanies = new Set(jobs.map(j => j.company).filter(Boolean))
        // Stats are now fetched from /api/stats at the beginning
        
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
        <div id="featured-jobs" className="mt-12">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">精选机会</h2>
             </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-100"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
            </div>
          ) : featuredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无精选岗位</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredJobs.map((job) => (
                <JobCardNew
                  key={job.id}
                  job={job}
                  variant="list" // Use list variant for feed style
                  onClick={() => navigate(`/jobs?region=domestic`)}
                />
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 inline-flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              查看更多机会
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trusted Companies Section */}
        <div className="mt-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                精选企业
              </h2>
              <p className="text-slate-500 text-base">经过验证的优质远程企业</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-100"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent absolute top-0 left-0"></div>
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

          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/trusted-companies')}
              className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 inline-flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              查看更多企业
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Core Highlights - Migrated from AboutPage */}
        <div className="mt-24">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">俱乐部的核心亮点</h2>
                <p className="mt-4 text-lg text-slate-500">我们不仅仅是一个招聘平台，更是一个基于共同价值观的专业社群。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition-shadow shadow-sm">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">先交朋友，后合作</h3>
                    <p className="text-slate-600 leading-relaxed">我们创造一个业余轻松的交流环境，让合作在相互了解和信任的基础上自然发生。</p>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition-shadow shadow-sm">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                        <Target className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">价值观与能力双重匹配</h3>
                    <p className="text-slate-600 leading-relaxed">我们深入了解企业文化和CEO价值观，确保为你推荐的不仅仅是工作机会，更是事业归属。</p>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition-shadow shadow-sm">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                        <Award className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">深度连结，共同成长</h3>
                    <p className="text-slate-600 leading-relaxed">通过专属社群和活动，与行业精英、企业创始人直接对话，拓展你的人脉与视野。</p>
                </div>
            </div>
        </div>

        {/* Club Benefits - Migrated from AboutPage */}
        <div id="club-benefits" className="mt-24">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">加入俱乐部，您将获得</h2>
                <p className="mt-4 text-lg text-slate-500">我们为您提供超越求职的价值，助力你的职业成长。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                 <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-100 transition-colors">
                    <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                        <Target className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">价值匹配</h3>
                    <p className="text-sm text-slate-500">深入企业文化，为您匹配价值观契合的团队。</p>
                </div>
                <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-100 transition-colors">
                    <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                        <Zap className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">直连CEO</h3>
                    <p className="text-sm text-slate-500">优秀会员有机会参与企业创始人深度交流。</p>
                </div>
                <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-100 transition-colors">
                    <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                        <Users className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">合作交流</h3>
                    <p className="text-sm text-slate-500">保持行业敏感，在互动社群中分享洞见，共同成长。</p>
                </div>
                 <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-100 transition-colors">
                    <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                        <Briefcase className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">岗位内推</h3>
                    <p className="text-sm text-slate-500">优先获得未公开的高质量远程岗位内推机会。</p>
                </div>
            </div>

            {/* Call to Action */}
            <div className="mt-16 bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xl shadow-indigo-100/50">
                <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">准备好开启新的职业篇章了吗？</h2>
                <p className="text-lg text-slate-600 mb-8">加入远程俱乐部，与宽阔的世界伙伴一起，探索远程工作的无限可能。</p>
                <button 
                    onClick={() => navigate('/register')}
                    className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:shadow-2xl hover:-translate-y-1"
                >
                    加入我们，获得无限可能
                </button>
            </div>
        </div>

        {/* Job Alert Subscription */}
        <div className="mt-32">
          <div className="relative bg-gradient-to-br from-indigo-50 to-indigo-50 rounded-3xl p-10 md:p-20 text-center overflow-hidden border border-indigo-100 shadow-lg shadow-indigo-50">
            {/* Subtle Background Pattern */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/60 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight text-slate-900 flex items-center justify-center gap-3">
                <Zap className="w-8 h-8 text-indigo-600 fill-current" />
                不错过任何机会
              </h2>
              <p className="text-slate-600 mb-10 text-lg leading-relaxed">
                订阅岗位提醒，第一时间获取最新的远程工作机会。<br />
                支持 <span className="font-semibold text-indigo-600">Email</span> 和 <span className="font-semibold text-indigo-600">飞书</span> 推送，不错过每一个好机会。
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
