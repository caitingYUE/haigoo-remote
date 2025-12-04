import { useState, useEffect, useMemo } from 'react'
import { Search, SortAsc, Sparkles } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { JobDetailPanel } from '../components/JobDetailPanel'
import JobFilterSidebar from '../components/JobFilterSidebar'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { extractLocations, matchesLocationFilter } from '../utils/locationHelper'

import { usePageCache } from '../hooks/usePageCache'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { JobPreferenceModal, JobPreferences } from '../components/JobPreferenceModal'

// Industry Options
// const INDUSTRY_OPTIONS = [
//   '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
//   '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
//   '硬件/物联网', '消费生活', '其他'
// ].map(v => ({ label: v, value: v }));

// Job Type Options
// const JOB_TYPE_OPTIONS = [
//   { label: '全职', value: 'full-time' },
//   { label: '兼职', value: 'part-time' },
//   { label: '合同', value: 'contract' },
//   { label: '自由职业', value: 'freelance' },
//   { label: '实习', value: 'internship' }
// ];

// Location Options
// const LOCATION_OPTIONS = [
//   { label: '远程', value: 'Remote' },
//   { label: '全球', value: 'Worldwide' }
// ];

export default function JobsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, isAuthenticated } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')

  // New Filter State Structure
  const [filters, setFilters] = useState({
    category: [] as string[],        // 岗位分类
    experienceLevel: [] as string[], // 岗位级别
    industry: [] as string[],        // 行业类型
    regionType: [] as string[],      // 区域限制: 'domestic' | 'overseas'
    sourceType: [] as string[],      // 岗位来源: 'third-party' | 'club-referral' | 'curated'
    type: [] as string[],
    location: [] as string[],
    jobType: [] as string[],
    salary: [] as string[],
    isTrusted: false,
    isNew: false
  })

  // Load user preferences
  useEffect(() => {
    loadUserPreferences()
  }, [isAuthenticated])

  const loadUserPreferences = async () => {
    if (!isAuthenticated || !token) return

    try {
      const resp = await fetch('/api/user-profile?action=get_preferences', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data.preferences) {
          setUserPreferences(data.preferences)
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    }
  }

  const saveUserPreferences = async (preferences: JobPreferences) => {
    if (!isAuthenticated || !token) {
      navigate('/login')
      return
    }

    try {
      const resp = await fetch('/api/user-profile?action=save_preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ preferences })
      })

      if (resp.ok) {
        setUserPreferences(preferences)
        showSuccess('求职期望已保存')
      } else {
        showError('保存失败，请稍后重试')
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
      showError('保存失败，请检查网络连接')
    }
  }

  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [showInlineDetail, setShowInlineDetail] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)
  const [isPreferenceModalOpen, setIsPreferenceModalOpen] = useState(false)
  const [userPreferences, setUserPreferences] = useState<JobPreferences | null>(null)

  // 加载阶段状态
  const [, setLoadingStage] = useState<'idle' | 'fetching' | 'translating'>('idle')
  const { showSuccess, showError, showWarning } = useNotificationHelpers()

  // 使用页面缓存 Hook
  const {
    data: jobs,
    loading,
    refresh,
    isFromCache
  } = usePageCache<Job[]>('jobs-all-list-full-v1', {
    fetcher: async () => {
      try {
        setLoadingStage('fetching')
        // Fetch up to 2000 jobs (20 pages * 100) to ensure we get most recent translated jobs
        const response = await processedJobsService.getAllProcessedJobsFull(100, 20)
        setLoadingStage('idle')
        console.log(`✅ 获取到 ${response.length} 个岗位（后端已翻译）`)
        return response
      } catch (error) {
        setLoadingStage('idle')
        throw error
      }
    },
    ttl: 5 * 60 * 1000,
    persist: true,
    namespace: 'jobs',
    onSuccess: (jobs) => {
      setLoadingStage('idle')
      console.log(`✅ 岗位列表加载完成，共 ${jobs.length} 个${isFromCache ? '（来自缓存）' : '（新数据）'}`)
    }
  })

  // 从URL参数中获取初始搜索词
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const search = params.get('search')
    if (search) {
      setSearchTerm(search)
    }
  }, [location.search])

  // 监听处理后岗位数据的更新事件
  useEffect(() => {
    const handleUpdated = () => {
      console.log('收到岗位数据更新事件，重新加载收藏和岗位...')
      refresh()
        ; (async () => {
          if (!token) return
          try {
            const resp = await fetch('/api/user-profile?action=favorites', { headers: { Authorization: `Bearer ${token}` } })
            if (resp.ok) {
              const data = await resp.json()
              const ids: string[] = (data?.favorites || []).map((f: any) => f.id)
              setSavedJobs(new Set(ids))
            }
          } catch { }
        })()
    }
    window.addEventListener('processed-jobs-updated', handleUpdated)
    return () => {
      window.removeEventListener('processed-jobs-updated', handleUpdated)
    }
  }, [refresh, token])

  const toggleSaveJob = async (jobId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('haigoo_auth_token') || '' : '')
    if (!isAuthenticated || !authToken) { showWarning('请先登录', '登录后可以收藏职位'); navigate('/login'); return }
    const isSaved = savedJobs.has(jobId)
    setSavedJobs(prev => { const s = new Set(prev); isSaved ? s.delete(jobId) : s.add(jobId); return s })
    try {
      const resp = await fetch(`/api/user-profile?action=${isSaved ? 'favorites_remove' : 'favorites_add'}&jobId=${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ jobId })
      })
      if (!resp.ok) throw new Error('收藏接口失败')
      const r = await fetch('/api/user-profile?action=favorites', { headers: { Authorization: `Bearer ${authToken}` } })
      if (r.ok) {
        const d = await r.json()
        const ids: string[] = (d?.favorites || []).map((f: any) => f.id)
        setSavedJobs(new Set(ids))
        showSuccess(isSaved ? '已取消收藏' : '收藏成功')
      }
    } catch (e) {
      setSavedJobs(prev => { const s = new Set(prev); isSaved ? s.add(jobId) : s.delete(jobId); return s })
      console.warn('收藏操作失败', e)
      showError('收藏失败', e instanceof Error ? e.message : '网络或服务不可用')
    }
  }

  // 初始化拉取收藏集
  useEffect(() => {
    ; (async () => {
      if (!token) return
      try {
        const resp = await fetch('/api/user-profile?action=favorites', { headers: { Authorization: `Bearer ${token}` } })
        if (resp.ok) {
          const data = await resp.json()
          const ids: string[] = (data?.favorites || []).map((f: any) => f.id)
          setSavedJobs(new Set(ids))
        }
      } catch { }
    })()
  }, [token])

  // 地址分类加载已移除 - 不再需要关键词匹配

  // 筛选逻辑
  const [companyMap, setCompanyMap] = useState<Record<string, TrustedCompany>>({})
  useEffect(() => {
    const loadCompanies = async () => {
      const ids = Array.from(new Set((jobs || []).map(j => j.companyId).filter(Boolean))) as string[]
      if (ids.length === 0) { setCompanyMap({}); return }
      const results = await Promise.all(ids.map(id => trustedCompaniesService.getCompanyById(id)))
      const map: Record<string, TrustedCompany> = {}
      ids.forEach((id, i) => { const c = results[i]; if (c) map[id] = c })
      setCompanyMap(map)
    }
    loadCompanies()
  }, [jobs])

  // Derived Data for Dynamic Filters - now using all jobs instead of regionJobs

  const locationOptions = useMemo(() => {
    const locs = new Set<string>()
    jobs?.forEach(j => {
      if (j.location) {
        const extracted = extractLocations(j.location)
        extracted.forEach(loc => locs.add(loc))
      }
    })
    return Array.from(locs).sort().map(l => ({ label: l, value: l }))
  }, [jobs])

  const industryOptions = useMemo(() => {
    const inds = new Set<string>()
    jobs?.forEach(j => {
      let ind = ''
      if (j.companyId) {
        const company = companyMap[j.companyId]
        if (company) {
          if (company.industry) {
            ind = company.industry
          }
          else if (company.tags && company.tags.length > 0) {
            const KNOWN_INDUSTRIES = [
              '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
              '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
              '硬件/物联网', '消费生活', 'SaaS', 'AI', 'Fintech', 'EdTech', 'HealthTech', 'Crypto', 'Web3', 'E-commerce'
            ]
            const found = company.tags.find(t => KNOWN_INDUSTRIES.some(k => k.toLowerCase() === t.toLowerCase()))
            if (found) ind = found
          }
        }
      }

      if (ind) inds.add(ind)
    })
    return Array.from(inds).sort().map(i => ({ label: i, value: i }))
  }, [jobs, companyMap])

  const typeOptions = useMemo(() => {
    const types = new Set<string>()
    jobs?.forEach(j => {
      if (j.type) types.add(j.type)
    })
    return Array.from(types).sort().map(t => ({ label: t, value: t }))
  }, [jobs])

  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {}
    jobs?.forEach(j => {
      if (j.category) {
        counts[j.category] = (counts[j.category] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(e => e[0])
  }, [jobs])

  const filteredJobs = useMemo(() => {
    return (jobs || []).filter(job => {
      const matchesSearch = searchTerm === '' ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.skills && job.skills.some((skill: string) => skill.toLowerCase().includes(searchTerm.toLowerCase())))

      const matchesType = filters.type.length === 0 || filters.type.includes(job.type)
      const matchesJobType = filters.jobType.length === 0 || filters.jobType.includes(job.type)

      // 岗位分类筛选
      const matchesCategory = filters.category.length === 0 ||
        (job.category && filters.category.includes(job.category))

      // 岗位级别筛选
      const matchesLevel = filters.experienceLevel.length === 0 ||
        (job.experienceLevel && filters.experienceLevel.includes(job.experienceLevel))

      const matchesLocation = matchesLocationFilter(job.location, filters.location)

      // 行业类型筛选（基于企业）
      const companyIndustry = job.companyId ? companyMap[job.companyId]?.industry || '' : ''
      const matchesIndustry = filters.industry.length === 0 || filters.industry.includes(companyIndustry)

      // 区域限制筛选
      const matchesRegion = filters.regionType.length === 0 ||
        (job.region && filters.regionType.includes(job.region))

      // 岗位来源筛选
      let matchesSource = filters.sourceType.length === 0
      if (!matchesSource && filters.sourceType.length > 0) {
        const sources: string[] = []

        // 第三方：RSS源
        if (job.sourceType === 'rss' || job.source?.toLowerCase().includes('rss')) {
          sources.push('third-party')
        }

        // 俱乐部内推：企业标记can_refer
        if (job.canRefer || (job.companyId && companyMap[job.companyId]?.canRefer)) {
          sources.push('club-referral')
        }

        // 人工精选：企业在trusted_companies表中
        if (job.isTrusted || job.sourceType === 'trusted') {
          sources.push('curated')
        }

        matchesSource = filters.sourceType.some(s => sources.includes(s))
      }

      const matchesTrusted = !filters.isTrusted || job.isTrusted

      // New Postings: posted within last 7 days
      const matchesNew = !filters.isNew || (new Date().getTime() - new Date(job.postedAt).getTime() < 7 * 24 * 60 * 60 * 1000)

      const matchesSalary = filters.salary.length === 0 || filters.salary.some(range => {
        if (!job.salary) return false
        const [minStr, maxStr] = range.split('-')
        const min = parseInt(minStr)
        const max = parseInt(maxStr)
        const jobMin = job.salary.min || 0
        const jobMax = job.salary.max || jobMin
        // Check for overlap: startA <= endB && endA >= startB
        return jobMin <= max && jobMax >= min
      })

      return matchesSearch && matchesType && matchesJobType && matchesCategory && matchesLevel && matchesLocation && matchesIndustry && matchesRegion && matchesSource && matchesTrusted && matchesNew && matchesSalary
    }).sort((a, b) => {
      if (a.canRefer && !b.canRefer) return -1
      if (!a.canRefer && b.canRefer) return 1
      if (a.isTrusted && !b.isTrusted) return -1
      if (!a.isTrusted && b.isTrusted) return 1
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    })
  }, [jobs, searchTerm, filters, companyMap])

  // Job Distribution Logic: Limit consecutive jobs from same company to max 2
  const distributedJobs = useMemo(() => {
    if (filteredJobs.length === 0) return []

    const result: Job[] = []
    const remaining: Job[] = [...filteredJobs]

    const countRecentCompanyJobs = (jobs: Job[], company: string, window: number): number => {
      const recentJobs = jobs.slice(-window)
      return recentJobs.filter(j => j.company === company).length
    }

    while (remaining.length > 0) {
      let added = false

      // Try to find a job that doesn't create 3 consecutive from same company
      for (let i = 0; i < remaining.length; i++) {
        const job = remaining[i]
        const company = job.company || 'Unknown'
        const recentCount = countRecentCompanyJobs(result, company, 2)

        if (recentCount < 2) {
          result.push(job)
          remaining.splice(i, 1)
          added = true
          break
        }
      }

      // If no job can be added without creating 3 consecutive, add the first one anyway
      if (!added && remaining.length > 0) {
        result.push(remaining.shift()!)
      }
    }

    return result
  }, [filteredJobs])

  // Deep Linking: Sync URL with selectedJob
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const jobId = params.get('jobId')

    if (jobId && distributedJobs.length > 0) {
      const job = distributedJobs.find(j => j.id === jobId)
      if (job) {
        if (selectedJob?.id !== job.id) {
          setSelectedJob(job)
          const idx = distributedJobs.findIndex(j => j.id === jobId)
          if (idx !== -1) setCurrentJobIndex(idx)

          if (window.innerWidth >= 1024) {
            setShowInlineDetail(true)
          } else {
            setIsJobDetailOpen(true)
          }
        }
      }
    } else if (!jobId) {
      // If no jobId, ensure we show list view
      setShowInlineDetail(false)
      setIsJobDetailOpen(false)
      setSelectedJob(null)
    }
  }, [distributedJobs, location.search, selectedJob])

  const handleJobSelect = (job: Job, index: number) => {
    setSelectedJob(job)
    setCurrentJobIndex(index)

    // Update URL
    const params = new URLSearchParams(location.search)
    params.set('jobId', job.id)
    navigate({ search: params.toString() }, { replace: true })

    // Determine view mode based on screen size
    if (window.innerWidth >= 1024) {
      setShowInlineDetail(true)
      setIsJobDetailOpen(false)
    } else {
      setIsJobDetailOpen(true)
    }
  }

  const handleBackToList = () => {
    setShowInlineDetail(false)
    setSelectedJob(null)
    const params = new URLSearchParams(location.search)
    params.delete('jobId')
    navigate({ search: params.toString() }, { replace: true })
  }


  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({
      category: [],
      experienceLevel: [],
      industry: [],
      regionType: [],
      sourceType: [],
      type: [],
      location: [],
      jobType: [],
      salary: [],
      isTrusted: false,
      isNew: false
    });
  }


  return (
    <div
      className="min-h-[calc(100vh-64px)] bg-slate-50"
      role="main"
      aria-label="职位搜索页面"
    >
      {/* Hero / Header Section */}
      <div className="bg-white border-b border-gray-100 py-10 px-4 sm:px-6 lg:px-8 shadow-sm relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-50 rounded-full opacity-50 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-orange-50 rounded-full opacity-50 blur-2xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-3">
            探索优质远程工作机会 (Explore Quality Remote Work)
          </h1>
          <p className="text-slate-500 text-lg max-w-3xl">
            所有职位均由海狗远程俱乐部筛选审核。(All positions are screened by Haigoo Remote Club.)
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left Sidebar: Filters */}
          <div className="w-full lg:w-72 flex-shrink-0">
            {/* Preference Settings Entry */}
            <div className="mb-6 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  岗位偏好
                </h3>
                <button
                  onClick={() => setIsPreferenceModalOpen(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {userPreferences ? '修改设置' : '添加偏好'}
                </button>
              </div>

              {userPreferences && (userPreferences.jobTypes.length > 0 || userPreferences.industries.length > 0 || userPreferences.locations.length > 0) ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      ...(userPreferences.jobTypes || []),
                      ...(userPreferences.industries || []),
                      ...(userPreferences.locations || [])
                    ].slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 truncate max-w-[120px]">
                        {tag}
                      </span>
                    ))}
                    {[
                      ...(userPreferences.jobTypes || []),
                      ...(userPreferences.industries || []),
                      ...(userPreferences.locations || [])
                    ].length > 3 && (
                        <span className="text-xs px-1.5 py-1 text-slate-400">
                          +{[
                            ...(userPreferences.jobTypes || []),
                            ...(userPreferences.industries || []),
                            ...(userPreferences.locations || [])
                          ].length - 3}
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-slate-400">
                    已根据您的偏好优化推荐排序
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    设置求职偏好，获取更精准的岗位推荐
                  </p>
                  <button
                    onClick={() => setIsPreferenceModalOpen(true)}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 transition-colors"
                  >
                    立即设置
                  </button>
                </div>
              )}
            </div>

            <JobFilterSidebar
              filters={filters}
              onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
              categoryOptions={topCategories.map(c => ({ label: c, value: c }))}
              industryOptions={industryOptions}
              jobTypeOptions={typeOptions}
              locationOptions={locationOptions}
            />
          </div>

          {/* Main Content: Search + Job List OR Job Detail */}
          <div className="flex-1">
            {showInlineDetail && selectedJob ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-[calc(100vh-180px)] overflow-hidden flex flex-col animate-in fade-in duration-300">
                <JobDetailPanel
                  job={selectedJob}
                  onSave={() => toggleSaveJob(selectedJob.id)}
                  isSaved={savedJobs.has(selectedJob.id)}
                  onApply={() => { /* apply logic if needed */ }}
                  onClose={handleBackToList}
                  showCloseButton={true}
                />
              </div>
            ) : (
              <>
                {/* Search Bar & Sort */}
                <div className="sticky top-4 z-30 mb-6">
                  <div className="flex flex-col sm:flex-row gap-4 p-2 bg-white/80 backdrop-blur-md rounded-2xl border border-white/50 shadow-lg shadow-slate-200/50">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索职位、公司、技能 (Search job, company, skills)"
                        className="w-full pl-12 pr-4 py-3.5 bg-transparent border-none focus:ring-0 text-slate-900 placeholder-slate-400 text-base font-medium"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 pr-2">
                      <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 text-sm font-bold text-slate-700 transition-all hover:border-slate-300">
                        <SortAsc className="w-4 h-4" />
                        <span>Most Recent</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Job List Grid */}
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white h-64 rounded-2xl shadow-sm border border-slate-100 p-6 animate-pulse">
                        <div className="flex gap-4 mb-6">
                          <div className="w-14 h-14 bg-slate-100 rounded-xl"></div>
                          <div className="flex-1 py-1">
                            <div className="h-5 bg-slate-100 rounded w-3/4 mb-3"></div>
                            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                          </div>
                        </div>
                        <div className="flex gap-2 mb-6">
                          <div className="w-16 h-6 bg-slate-100 rounded-full"></div>
                          <div className="w-16 h-6 bg-slate-100 rounded-full"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="h-4 bg-slate-100 rounded w-full"></div>
                          <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : distributedJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl shadow-sm border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <div className="text-slate-900 font-bold text-lg mb-2">暂无符合条件的职位</div>
                    <p className="text-slate-500 mb-8 text-center max-w-sm">
                      尝试调整筛选条件，或者使用更通用的关键词搜索
                    </p>
                    <button
                      onClick={clearAllFilters}
                      className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                      清除所有筛选
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {distributedJobs.map((job, index) => (
                      <JobCardNew
                        key={job.id}
                        job={job}
                        onClick={() => handleJobSelect(job, index)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Job Detail Modal (Desktop & Mobile) */}
      {/* Note: In the new design, we might want to use a modal for desktop too, or keep the split view? 
          The visual reference doesn't explicitly show the detail view, but usually card clicks open details.
          Let's stick to the Modal for now to keep the clean grid layout on the main page. 
      */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={isJobDetailOpen}
          onClose={() => { setIsJobDetailOpen(false); }}
          onSave={() => toggleSaveJob(selectedJob.id)}
          isSaved={savedJobs.has(selectedJob.id)}
          jobs={distributedJobs}
          currentJobIndex={currentJobIndex}
          onNavigateJob={(direction: 'prev' | 'next') => {
            const nextIndex = direction === 'prev' ? Math.max(0, currentJobIndex - 1) : Math.min(distributedJobs.length - 1, currentJobIndex + 1)
            handleJobSelect(distributedJobs[nextIndex], nextIndex)
          }}
        />
      )}

      {/* Hidden for now as we moved it to sidebar or top */}
      <JobPreferenceModal
        isOpen={isPreferenceModalOpen}
        onClose={() => setIsPreferenceModalOpen(false)}
        onSave={saveUserPreferences}
        initialPreferences={userPreferences || undefined}
        jobTypeOptions={topCategories}
        industryOptions={industryOptions.map(opt => opt.label)}
      />
    </div>
  )
}
