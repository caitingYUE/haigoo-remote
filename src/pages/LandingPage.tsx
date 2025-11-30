import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import '../styles/landing-upgrade.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import HomeHero from '../components/HomeHero'
import HomeJobCard from '../components/HomeJobCard'
import HomeCompanyCard from '../components/HomeCompanyCard'
import { ArrowRight, TrendingUp, Building2 } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

export default function LandingPage() {
  const navigate = useNavigate()
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([])
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [stats, setStats] = useState({ totalJobs: 0, companiesCount: 0, activeUsers: 0 })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // 并行获取：精选职位、热门企业、常规职位（用于统计和分类）
        const [featuredResp, companies, jobs] = await Promise.all([
          processedJobsService.getProcessedJobs(1, 12, { isFeatured: true }),
          trustedCompaniesService.getAllCompanies(),
          processedJobsService.getAllProcessedJobsFull(50, 1)
        ])

        // 设置精选职位（如果有，否则回退到常规职位）
        if (featuredResp.jobs.length > 0) {
          setFeaturedJobs(featuredResp.jobs)
        } else {
          // 回退逻辑：使用常规职位中的国内职位
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
        }

        // 设置热门企业 (top 9)
        setTrustedCompanies(companies.slice(0, 9))

        // 提取热门分类 (基于 job.category)
        const categoryCounts = new Map<string, number>()
        jobs.forEach(job => {
          if (job.category) {
            categoryCounts.set(job.category, (categoryCounts.get(job.category) || 0) + 1)
          }
        })
        const topCategories = Array.from(categoryCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([cat]) => cat)
        setCategories(topCategories)

        // 设置统计数据
        const uniqueCompanies = new Set(jobs.map(j => j.company).filter(Boolean))
        setStats({
          totalJobs: jobs.length, // 简化统计，使用获取到的数量
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
    <div className="min-h-screen bg-[#F6F8FA]">
      {/* New Hero Section */}
      <HomeHero />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

        {/* Featured Jobs Section */}
        <div id="featured-jobs" className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">精选岗位</h2>
            <div className="flex gap-4 text-sm font-medium text-gray-500">
              {categories.length > 0 ? categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => navigate(`/jobs?category=${encodeURIComponent(cat)}`)}
                  className="hidden lg:block cursor-pointer hover:text-blue-600 transition-colors"
                >
                  {cat}
                </button>
              )) : (
                // Fallback categories if no data
                ['销售', '技术', '运营', '设计', '市场', '产品'].map(cat => (
                  <button 
                    key={cat}
                    onClick={() => navigate(`/jobs?category=${encodeURIComponent(cat)}`)}
                    className="hidden lg:block cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {cat}
                  </button>
                ))
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
            </div>
          ) : featuredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无精选岗位</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredJobs.map((job) => (
                <HomeJobCard
                  key={job.id}
                  job={job}
                  onClick={() => navigate(`/jobs?region=domestic`)}
                />
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="px-8 py-3 bg-white text-blue-600 font-medium rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-2"
            >
              查看更多职位
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Trusted Companies Section */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">热门企业</h2>
            <button
              onClick={() => navigate('/companies')}
              className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
            </div>
          ) : trustedCompanies.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无企业数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="mt-20">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">不错过任何机会</h2>
              <p className="text-blue-100 mb-8 text-lg">订阅岗位提醒，第一时间获取最新的远程工作机会</p>
              <div className="bg-white/10 backdrop-blur-sm p-2 rounded-xl inline-block w-full max-w-md">
                <JobAlertSubscribe variant="minimal" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
