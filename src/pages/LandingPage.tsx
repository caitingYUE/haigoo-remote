import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

import { MembershipCertificateModal } from '../components/MembershipCertificateModal'
import HomeHero from '../components/HomeHero'
import FeaturedJobsSection from '../components/FeaturedJobsSection'
import JobDetailModal from '../components/JobDetailModal'
import { useNotificationHelpers } from '../components/NotificationSystem'
import HomeCompanyCard from '../components/HomeCompanyCard'
import WeChatCommunityPanel from '../components/WeChatCommunityPanel'
import { ArrowRight, Building2, Zap, Users, Target, Globe, CheckCircle2, Crown, Download, Sparkles } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

import { CompanyCardSkeleton } from '../components/skeletons/CompanyCardSkeleton'
import { trackingService } from '../services/tracking-service'

const FEATURED_JOBS_CACHE_KEY = 'haigoo_home_featured_jobs'
const TRUSTED_COMPANIES_CACHE_KEY = 'haigoo_home_trusted_companies'
const FEATURED_JOBS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const getFreshFeaturedJobsCache = (): Job[] => {
  try {
    const cached = localStorage.getItem(FEATURED_JOBS_CACHE_KEY)
    if (!cached) return []

    const parsed = JSON.parse(cached)
    if (Array.isArray(parsed)) {
      return parsed
    }

    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : []
    const fetchedAt = Number(parsed?.fetchedAt || 0)
    if (!jobs.length || !fetchedAt) return []
    if (Date.now() - fetchedAt > FEATURED_JOBS_CACHE_TTL_MS) return []

    return jobs
  } catch {
    return []
  }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated, isMember, isTrialMember, membershipCapabilities } = useAuth()
  const { showSuccess, showWarning, showError } = useNotificationHelpers()
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  
  // Cache busting and version check
  useEffect(() => {
    const CURRENT_VERSION = '2026.04.13.01' // Increment this to force cache clear
    const lastVersion = localStorage.getItem('haigoo_version')
    
    if (lastVersion !== CURRENT_VERSION) {
      console.log('Detecting new version, clearing critical caches...')
      localStorage.removeItem(FEATURED_JOBS_CACHE_KEY)
      localStorage.removeItem(TRUSTED_COMPANIES_CACHE_KEY)
      localStorage.setItem('haigoo_version', CURRENT_VERSION)
      // Force reload if we suspect strict caching issues, but let's try just clearing data first
    }
  }, [])

  const [featuredJobs, setFeaturedJobs] = useState<Job[]>(() => {
    return getFreshFeaturedJobsCache()
  })
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>(() => {
    try {
      const cached = localStorage.getItem(TRUSTED_COMPANIES_CACHE_KEY)
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
  // const [loading, setLoading] = useState(true)
  // const [stats, setStats] = useState<{ totalJobs: number | null, companiesCount: number | null, dailyJobs: number | null }>({ totalJobs: null, companiesCount: null, dailyJobs: null })
  
  // Only show loading state if we don't have cached data
  // const [jobsLoading, setJobsLoading] = useState(() => {
  //   try {
  //     return !localStorage.getItem('haigoo_home_featured_jobs')
  //   } catch { return true }
  // })
  const [companiesLoading, setCompaniesLoading] = useState(() => {
    try {
      return !localStorage.getItem(TRUSTED_COMPANIES_CACHE_KEY)
    } catch { return true }
  })

  const toggleSaveJob = async (job: Job) => {
    if (!isAuthenticated || !token) {
      showWarning('请先登录', '登录后可以收藏职位')
      navigate('/login')
      return
    }

    const isSaved = savedJobs.has(job.id)
    // Optimistic update
    setSavedJobs(prev => {
      const next = new Set(prev)
      if (isSaved) next.delete(job.id)
      else next.add(job.id)
      return next
    })

    try {
      trackingService.track('click_save_job', {
        page_key: 'home',
        module: 'home_job_detail_modal',
        feature_key: 'favorite',
        source_key: 'landing_page',
        entity_type: 'job',
        entity_id: job.id,
        job_id: job.id,
        action: isSaved ? 'unsave' : 'save'
      })
      // If saving (adding favorite), we send the full job object to ensure persistence
      const action = isSaved ? 'favorites_remove' : 'favorites_add'
      const payload = isSaved ? { jobId: job.id } : { jobId: job.id, job }

      const resp = await fetch(`/api/user-profile?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!resp.ok) throw new Error('操作失败')

      showSuccess(isSaved ? '已取消收藏' : '收藏成功')
    } catch (error) {
      console.error('Failed to toggle save:', error)
      showError('操作失败，请重试')
      // Rollback
      setSavedJobs(prev => {
        const next = new Set(prev)
        if (isSaved) next.add(job.id)
        else next.delete(job.id)
        return next
      })
    }
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setIsDetailModalOpen(true)
  }

  const handleNavigateJob = (direction: 'prev' | 'next') => {
    if (!selectedJob) return
    const currentIndex = featuredJobs.findIndex(j => j.id === selectedJob.id)
    if (currentIndex === -1) return

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    if (nextIndex >= 0 && nextIndex < featuredJobs.length) {
      setSelectedJob(featuredJobs[nextIndex])
    }
  }

  useEffect(() => {
    if (isAuthenticated && token) {
      // Fetch application status
      fetch('/api/applications?action=my_status', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setApplicationStatus(data.status)
          }
        })
        .catch(err => console.error('Failed to fetch application status', err))

      // Fetch saved jobs
      fetch('/api/user-profile?action=favorites', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.favorites)) {
            setSavedJobs(new Set(data.favorites.map((j: any) => j.id || j.job_id)))
          }
        })
        .catch(err => console.error('Failed to fetch saved jobs', err))
    } else {
      setApplicationStatus(null)
      setSavedJobs(new Set())
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    const loadData = async () => {
      try {
        // setLoading(true)

        // 1. Fetch real stats from backend
        try {
          // const statsResp = await fetch('/api/stats')
          // const statsData = await statsResp.json()
          // if (statsData.success && statsData.stats) {
          //   setStats({
          //     totalJobs: statsData.stats.totalJobs, // Use global total to match daily jobs
          //     companiesCount: statsData.stats.companiesCount,
          //     dailyJobs: statsData.stats.dailyJobs || 0
          //   })
          // }
        } catch (e) {
          console.error('Failed to fetch stats:', e)
        }

        // 2. 并行发起所有数据请求，但各自独立处理结果
        // 精选岗位数据
        processedJobsService.getFeaturedHomeJobs()
          .then(featuredJobsData => {
            setFeaturedJobs(featuredJobsData)
            // setJobsLoading(false)
            // Cache the result
            localStorage.setItem(FEATURED_JOBS_CACHE_KEY, JSON.stringify({
              jobs: featuredJobsData,
              fetchedAt: Date.now()
            }))
          })
          .catch(error => {
            console.error('Failed to load featured jobs:', error)
            // setJobsLoading(false)
          })

        // 精选企业数据
        trustedCompaniesService.getFeaturedCompanies()
          .then(featuredCompaniesData => {
            setTrustedCompanies(featuredCompaniesData.companies)
            setCompanyJobStats(featuredCompaniesData.stats)
            setCompaniesLoading(false)
            // Cache the result
            localStorage.setItem(TRUSTED_COMPANIES_CACHE_KEY, JSON.stringify(featuredCompaniesData.companies))
          })
          .catch(error => {
            console.error('Failed to load featured companies:', error)
            setCompaniesLoading(false)
          })

      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        // 设置整体loading为false，让页面可以开始渲染
        // setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Premium Dark Hero Section */}
      <HomeHero stats={undefined} />

      {/* Featured Jobs Section */}
      <FeaturedJobsSection 
        initialJobs={featuredJobs} 
        onJobClick={handleJobClick} 
        trustedCompanies={trustedCompanies}
        companyJobStats={companyJobStats}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Featured Companies Section */}
        <div className="py-24">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                精选企业
              </h2>
              <p className="text-slate-500">尊重员工、开放多元、持续成长的远程企业</p>
            </div>
            <button
              onClick={() => navigate('/trusted-companies')}
              className="hidden md:flex px-6 py-2.5 bg-white text-slate-700 font-medium rounded-full border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200 items-center gap-2 group"
            >
              浏览所有企业
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {companiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <CompanyCardSkeleton key={i} />
              ))}
            </div>
          ) : trustedCompanies.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
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
                  onClick={() => navigate(
                    `/companies/${encodeURIComponent(company.name)}`
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Brand Promise Section */}
        <div className="py-24 border-t border-slate-100">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm mb-3 block">为什么选择 Haigoo</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-6">
              不只帮你筛出国内可申的岗位，<br />
              更帮你筛出 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">靠谱的好机会</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              我们希望你少花时间反复筛选，多把精力放在真正值得投的岗位上。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Globe className="w-6 h-6 text-white" />,
                title: "靠谱岗位",
                desc: "优先筛掉不值得花时间的岗位，帮你更快看到适合国内用户申请的远程机会。",
                color: "bg-blue-500"
              },
              {
                icon: <Target className="w-6 h-6 text-white" />,
                title: "可直连招聘方",
                desc: "我们拿到了不少岗位的直招 HR、负责人等联系方式。你可以直接沟通，也可以通过他们的领英主页进一步了解团队和岗位。",
                color: "bg-indigo-500"
              },
              {
                icon: <Zap className="w-6 h-6 text-white" />,
                title: "求职更省时间",
                desc: "用推荐、收藏、投递记录和提醒功能，把求职从信息焦虑变成具体行动。",
                color: "bg-indigo-500"
              },
              {
                icon: <Users className="w-6 h-6 text-white" />,
                title: "社群交流",
                desc: "群里会同步精选岗位、投递经验和真实反馈，帮助你少走弯路。",
                color: "bg-purple-500"
              }
            ].map((item, index) => (
              <div key={index} className="group p-8 rounded-3xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300">
                <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200/50 group-hover:scale-110 transition-transform duration-300`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Membership CTA Section */}
        <div className="mt-12 relative rounded-[2.5rem] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden shadow-2xl shadow-indigo-900/5 border border-white/50">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 animate-pulse delay-1000"></div>

          <div className="relative z-10 px-8 py-16 md:px-20 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 border border-indigo-100 text-indigo-900/80 text-sm font-bold tracking-widest uppercase mb-8 shadow-sm backdrop-blur-md">
              <Crown className="w-4 h-4 fill-indigo-900/60" />
              会员方案
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-[1.1]">
              <span className="block text-slate-500 text-2xl md:text-3xl font-medium mb-3 tracking-normal">少走弯路</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 drop-shadow-sm">
                更快拿到有效结果
              </span>
            </h2>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
              会员版可以查看更完整的岗位信息、部分岗位的直招联系方式，并使用更多求职工具和持续更新的岗位推荐。<br className="hidden md:block" />
              如需 1 对 1 指导或咨询服务，可以通过
              {' '}<a href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">小红书私信我们</a>
              {' '}或发送邮件到
              {' '}<a href="mailto:hi@haigooremote.com" className="font-medium text-indigo-600 hover:underline">hi@haigooremote.com</a>。
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {(() => {
                if (isMember) {
                  return (
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <button
                        onClick={() => navigate('/jobs')}
                        className="px-8 py-4 bg-white hover:bg-slate-50 border border-indigo-100 text-indigo-900 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                        {isTrialMember ? '体验会员已生效 - 去看岗位' : '会员已生效 - 去看岗位'}
                      </button>
                      <button
                        onClick={() => setShowCertificateModal(true)}
                        className="px-8 py-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        下载会员证书
                      </button>
                    </div>
                  )
                } else if (applicationStatus === 'pending') {
                  return (
                    <button disabled className="px-10 py-4 bg-slate-100 text-slate-400 border border-slate-200 font-bold rounded-xl cursor-not-allowed w-full sm:w-auto">
                      会员申请审核中
                    </button>
                  )
                } else {
                  return (
                    <button
                      onClick={() => navigate('/membership')}
                      className="px-10 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-xl hover:shadow-2xl shadow-indigo-500/30 hover:-translate-y-0.5 w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                      查看会员方案
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )
                }
              })()}
            </div>
          </div>
        </div>

        {/* Certificate Modal - Ensure it renders */}
        {user && (
          <MembershipCertificateModal
            isOpen={showCertificateModal}
            onClose={() => setShowCertificateModal(false)}
            user={user}
          />
        )}

        <JobDetailModal
          job={selectedJob}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onSave={selectedJob ? () => toggleSaveJob(selectedJob) : undefined}
          isSaved={selectedJob ? savedJobs.has(selectedJob.id) : false}
          jobs={featuredJobs}
          currentJobIndex={selectedJob ? featuredJobs.findIndex(j => j.id === selectedJob.id) : -1}
          onNavigateJob={handleNavigateJob}
          variant="center"
        />

        {/* WeChat Community */}
        <div className="mt-32">
          <WeChatCommunityPanel
            isMember={isMember}
            variant="embedded"
          />
        </div>
      </div>
    </div>
  )
}
