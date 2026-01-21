import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

import JobAlertSubscribe from '../components/JobAlertSubscribe'
import { MembershipCertificateModal } from '../components/MembershipCertificateModal'
import HomeHero from '../components/HomeHero'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { useNotificationHelpers } from '../components/NotificationSystem'
import HomeCompanyCard from '../components/HomeCompanyCard'
import NewYearBlessingSection from '../components/NewYearBlessingSection'
import { ArrowRight, TrendingUp, Building2, Zap, Users, Target, Globe, Sparkles, CheckCircle2, Crown, Download } from 'lucide-react'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

import { JobCardSkeleton } from '../components/skeletons/JobCardSkeleton'
import { CompanyCardSkeleton } from '../components/skeletons/CompanyCardSkeleton'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, token, isAuthenticated, isMember } = useAuth()
  const { showSuccess, showWarning, showError } = useNotificationHelpers()
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>(() => {
    try {
      const cached = localStorage.getItem('haigoo_home_featured_jobs')
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>(() => {
    try {
      const cached = localStorage.getItem('haigoo_home_trusted_companies')
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ totalJobs: number | null, companiesCount: number | null, dailyJobs: number | null }>({ totalJobs: null, companiesCount: null, dailyJobs: null })
  
  // Only show loading state if we don't have cached data
  const [jobsLoading, setJobsLoading] = useState(() => {
    try {
      return !localStorage.getItem('haigoo_home_featured_jobs')
    } catch { return true }
  })
  const [companiesLoading, setCompaniesLoading] = useState(() => {
    try {
      return !localStorage.getItem('haigoo_home_trusted_companies')
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
        setLoading(true)

        // 1. Fetch real stats from backend
        try {
          const statsResp = await fetch('/api/stats')
          const statsData = await statsResp.json()
          if (statsData.success && statsData.stats) {
            setStats({
              totalJobs: statsData.stats.totalJobs, // Use global total to match daily jobs
              companiesCount: statsData.stats.companiesCount,
              dailyJobs: statsData.stats.dailyJobs || 0
            })
          }
        } catch (e) {
          console.error('Failed to fetch stats:', e)
        }

        // 2. 并行发起所有数据请求，但各自独立处理结果
        // 精选岗位数据
        processedJobsService.getFeaturedHomeJobs()
          .then(featuredJobsData => {
            setFeaturedJobs(featuredJobsData)
            setJobsLoading(false)
            // Cache the result
            localStorage.setItem('haigoo_home_featured_jobs', JSON.stringify(featuredJobsData))
          })
          .catch(error => {
            console.error('Failed to load featured jobs:', error)
            setJobsLoading(false)
          })

        // 精选企业数据
        trustedCompaniesService.getFeaturedCompanies()
          .then(featuredCompaniesData => {
            setTrustedCompanies(featuredCompaniesData.companies)
            setCompanyJobStats(featuredCompaniesData.stats)
            setCompaniesLoading(false)
            // Cache the result
            localStorage.setItem('haigoo_home_trusted_companies', JSON.stringify(featuredCompaniesData.companies))
          })
          .catch(error => {
            console.error('Failed to load featured companies:', error)
            setCompaniesLoading(false)
          })

      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        // 设置整体loading为false，让页面可以开始渲染
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Premium Dark Hero Section */}
      <HomeHero stats={undefined} />

      {/* New Year Blessing Section (Hidden for now) */}
      {/* <NewYearBlessingSection /> */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  onClick={() => navigate(`/companies/${encodeURIComponent(company.name)}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Featured Jobs Section */}
        {(jobsLoading || featuredJobs.length > 0) && (
        <div id="featured-jobs" className="py-16 border-t border-slate-100">
          <div className="flex items-center justify-between mb-12">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">精选岗位</h2>
              <p className="text-slate-500">人工逐条筛选的高薪/高增长/好文化的优质远程机会</p>
            </div>
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="hidden md:flex px-6 py-2.5 bg-white text-slate-700 font-medium rounded-full border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200 items-center gap-2 group"
            >
              浏览所有岗位
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {jobsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[...Array(6)].map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {featuredJobs.map((job) => (
                <JobCardNew
                  key={job.id}
                  job={job}
                  variant="list"
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <button
              onClick={() => navigate('/jobs?region=domestic')}
              className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 inline-flex items-center gap-2 shadow-sm"
            >
              浏览所有岗位
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        )}

        {/* Brand Promise Section - "Why Haigoo?" */}
        <div className="py-24 border-t border-slate-100">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm mb-3 block">Why Choose Us</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-6">
              不仅仅是找工作，<br />
              更是开启一种全新的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">自由生活方式</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              Haigoo 严选全球远程机会，不仅注重薪资回报，更看重企业文化与 Work-Life Balance。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Globe className="w-6 h-6 text-white" />,
                title: "中国可申",
                desc: "严选全球范围内对中国人才友好的远程企业，无需出海，也可享有全球薪资。",
                color: "bg-blue-500"
              },
              {
                icon: <Target className="w-6 h-6 text-white" />,
                title: "优质文化",
                desc: "深入了解企业背景和招聘需求，选择开放有远见的企业，在远程中也能收获自我价值和成长。",
                color: "bg-indigo-500"
              },
              {
                icon: <Users className="w-6 h-6 text-white" />,
                title: "社群链接",
                desc: "加入高质量远程工作者社群，与优秀的人同行，分享经验，拓展人脉。",
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

        {/* Membership CTA Section - Premium Light Blue-Purple Card */}
        <div className="mt-12 relative rounded-[2.5rem] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden shadow-2xl shadow-indigo-900/5 border border-white/50">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 animate-pulse delay-1000"></div>

          <div className="relative z-10 px-8 py-16 md:px-20 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 border border-indigo-100 text-indigo-900/80 text-sm font-bold tracking-widest uppercase mb-8 shadow-sm backdrop-blur-md">
              <Crown className="w-4 h-4 fill-indigo-900/60" />
              Invite Only · Global Access
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-[1.1]">
              <span className="block text-slate-500 text-2xl md:text-3xl font-medium mb-3 tracking-normal">Join the Elite</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 drop-shadow-sm">
                Haigoo Member
              </span>
            </h2>

            <p className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
              解锁企业背景信息、高管内推直达通道、简历优化等专属特权，<br className="hidden md:block" />
              让你的远程求职之路更加顺畅。
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
                        您已是尊贵会员 - 去探索岗位
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
                      内测中，仅限邀请，申请加入
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

        {/* Job Alert Subscription */}
        <div className="mt-32">
          <div className="relative rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-50 overflow-hidden bg-white">
            <div className="absolute inset-0 bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/30"></div>

            <div className="relative z-10 max-w-2xl mx-auto p-12 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-6 transition-transform">
                <Zap className="w-8 h-8 text-indigo-600 fill-indigo-600" />
              </div>

              <h2 className="text-3xl font-bold mb-4 tracking-tight text-slate-900">
                不错过任何新机会
              </h2>
              <p className="text-slate-600 mb-10 text-lg leading-relaxed">
                订阅岗位提醒，第一时间获取最新的远程工作机会。<br />
                支持 <span className="font-semibold text-indigo-600">Email</span> 和 <span className="font-semibold text-indigo-600">飞书</span> 推送。
              </p>
              <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 inline-block w-full">
                <JobAlertSubscribe variant="minimal" theme="light" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
