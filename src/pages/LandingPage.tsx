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
const TRUSTED_COMPANIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const getFreshFeaturedJobsCache = (): Job[] => {
  try {
    const cached = localStorage.getItem(FEATURED_JOBS_CACHE_KEY)
    if (!cached) return []

    const parsed = JSON.parse(cached)
    if (Array.isArray(parsed)) return []

    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : []
    const fetchedAt = Number(parsed?.fetchedAt || 0)
    if (!jobs.length || !fetchedAt) return []
    if (Date.now() - fetchedAt > FEATURED_JOBS_CACHE_TTL_MS) return []

    return jobs
  } catch {
    return []
  }
}

const getFreshTrustedCompaniesCache = (): {
  companies: TrustedCompany[]
  stats: Record<string, { total: number; categories: Record<string, number> }>
} => {
  try {
    const cached = localStorage.getItem(TRUSTED_COMPANIES_CACHE_KEY)
    if (!cached) return { companies: [], stats: {} }

    const parsed = JSON.parse(cached)
    if (Array.isArray(parsed)) return { companies: [], stats: {} }

    const companies = Array.isArray(parsed?.companies) ? parsed.companies : []
    const stats = parsed?.stats && typeof parsed.stats === 'object' ? parsed.stats : {}
    const fetchedAt = Number(parsed?.fetchedAt || 0)

    if (!companies.length || !fetchedAt) return { companies: [], stats: {} }
    if (Date.now() - fetchedAt > TRUSTED_COMPANIES_CACHE_TTL_MS) return { companies: [], stats: {} }

    return { companies, stats }
  } catch {
    return { companies: [], stats: {} }
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
    const CURRENT_VERSION = '2026.04.15.02' // Increment this to force cache clear
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
  const cachedCompaniesPayload = getFreshTrustedCompaniesCache()
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>(cachedCompaniesPayload.companies)
  const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>(cachedCompaniesPayload.stats)
  // const [loading, setLoading] = useState(true)
  // const [stats, setStats] = useState<{ totalJobs: number | null, companiesCount: number | null, dailyJobs: number | null }>({ totalJobs: null, companiesCount: null, dailyJobs: null })
  
  // Only show loading state if we don't have cached data
  // const [jobsLoading, setJobsLoading] = useState(() => {
  //   try {
  //     return !localStorage.getItem('haigoo_home_featured_jobs')
  //   } catch { return true }
  // })
  const [companiesLoading, setCompaniesLoading] = useState(() => {
    return cachedCompaniesPayload.companies.length === 0
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
            localStorage.setItem(TRUSTED_COMPANIES_CACHE_KEY, JSON.stringify({
              companies: featuredCompaniesData.companies,
              stats: featuredCompaniesData.stats,
              fetchedAt: Date.now()
            }))
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
    <div className="min-h-screen bg-[#fbfaf6]">
      <HomeHero
        stats={undefined}
        featuredJobs={featuredJobs}
        trustedCompanies={trustedCompanies}
        companyJobStats={companyJobStats}
        companiesLoading={companiesLoading}
      />
    </div>
  )
}
