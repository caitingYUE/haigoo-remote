import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCard from '../components/JobCard'
import JobDetailModal from '../components/JobDetailModal'
import { JobDetailPanel } from '../components/JobDetailPanel'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { extractLocations, matchesLocationFilter } from '../utils/locationHelper'

import { usePageCache } from '../hooks/usePageCache'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

// Industry Options
const INDUSTRY_OPTIONS = [
  '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
  '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
  '硬件/物联网', '消费生活', '其他'
].map(v => ({ label: v, value: v }));

// Job Type Options
const JOB_TYPE_OPTIONS = [
  { label: '全职', value: 'full-time' },
  { label: '兼职', value: 'part-time' },
  { label: '合同', value: 'contract' },
  { label: '自由职业', value: 'freelance' },
  { label: '实习', value: 'internship' }
];

// Location Options
const LOCATION_OPTIONS = [
  { label: '远程', value: 'Remote' },
  { label: '全球', value: 'Worldwide' }
];

export default function JobsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, isAuthenticated } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [activeRegion, setActiveRegion] = useState<'domestic' | 'overseas'>(() => {
    const p = new URLSearchParams(location.search)
    const r = (p.get('region') || '').toLowerCase()
    return r === 'overseas' ? 'overseas' : 'domestic'
  })
  const [categories, setCategories] = useState<{ domesticKeywords: string[]; overseasKeywords: string[]; globalKeywords: string[] }>({
    domesticKeywords: ['china', '中国', 'cn', 'apac', 'asia', 'east asia', 'greater china', 'utc+8', 'gmt+8', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chongqing', 'chengdu', 'nanjing', '不限地点'],
    overseasKeywords: ['usa', 'united states', 'us', 'uk', 'england', 'britain', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru', 'colombia', 'latam', 'europe', 'eu', 'emea', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'sweden', 'norway', 'denmark', 'finland', 'poland', 'czech', 'ireland', 'switzerland', 'australia', 'new zealand', 'oceania', 'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'japan', 'korea', 'south korea', 'singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines', 'uae', 'saudi', 'turkey', 'russia', 'israel', 'africa'],
    globalKeywords: ['anywhere', 'everywhere', 'worldwide', 'global', '不限地点']
  })

  // New Filter State Structure
  const [filters, setFilters] = useState({
    type: [] as string[],
    category: 'all', // Keep category as single select for tabs
    location: [] as string[],
    industry: [] as string[]
  })

  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)

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
    const r = params.get('region')
    if (r) {
      setActiveRegion(r === 'overseas' ? 'overseas' : 'domestic')
    }
  }, [location.search])

  // 监听处理后岗位数据的更新事件
  useEffect(() => {
    const handleUpdated = () => {
      console.log('收到岗位数据更新事件，重新加载收藏、岗位及地址分类...')
      refresh()
        ; (async () => {
          try {
            const r = await fetch('/api/user-profile?action=location_categories_get')
            if (r.ok) {
              const j = await r.json()
              setCategories(j.categories || { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] })
            }
          } catch { }
        })()
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

  // 地址分类加载
  useEffect(() => {
    ; (async () => {
      try {
        const r = await fetch('/api/user-profile?action=location_categories_get')
        if (r.ok) {
          const j = await r.json()
          setCategories(j.categories || { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] })
        }
      } catch { }
    })()
  }, [])

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

  // Derived Data for Dynamic Filters
  const regionJobs = useMemo(() => {
    if (!jobs) return [];
    const norm = (v: string) => (v || '').toLowerCase()

    return jobs.filter(job => {
      const loc = norm(job.location)
      const tags = (job.skills || []).map(t => norm(t))
      const pool = new Set([loc, ...tags])
      const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))
      const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
      const domesticHit = hit(categories.domesticKeywords)
      const overseasHit = hit(categories.overseasKeywords)

      if (activeRegion === 'domestic') {
        return domesticHit || (globalHit && !overseasHit)
      } else {
        return overseasHit || (globalHit && !domesticHit)
      }
    })
  }, [jobs, activeRegion, categories])

  const locationOptions = useMemo(() => {
    const locs = new Set<string>()
    regionJobs.forEach(j => {
      if (j.location) {
        const extracted = extractLocations(j.location)
        extracted.forEach(loc => locs.add(loc))
      }
    })
    return Array.from(locs).sort().map(l => ({ label: l, value: l }))
  }, [regionJobs])

  const industryOptions = useMemo(() => {
    const inds = new Set<string>()
    regionJobs.forEach(j => {
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
  }, [regionJobs, companyMap])

  const typeOptions = useMemo(() => {
    const types = new Set<string>()
    regionJobs.forEach(j => {
      if (j.type) types.add(j.type)
    })
    return Array.from(types).sort().map(t => ({ label: t, value: t }))
  }, [regionJobs])

  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {}
    regionJobs.forEach(j => {
      if (j.category) {
        counts[j.category] = (counts[j.category] || 0) + 1
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(e => e[0])
  }, [regionJobs])

  const filteredJobs = useMemo(() => {
    return (regionJobs || []).filter(job => {
      const matchesSearch = searchTerm === '' ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.skills && job.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))

      const matchesType = filters.type.length === 0 || filters.type.includes(job.type)

      const matchesCategory = filters.category === 'all' ||
        (job.category && job.category === filters.category) ||
        (job.skills && job.skills.some(skill => skill.toLowerCase().includes(filters.category.toLowerCase())))

      const matchesLocation = matchesLocationFilter(job.location, filters.location)

      const companyIndustry = job.companyId ? companyMap[job.companyId]?.industry || '' : ''
      const matchesIndustry = filters.industry.length === 0 || filters.industry.includes(companyIndustry)

      return matchesSearch && matchesType && matchesCategory && matchesLocation && matchesIndustry
    }).sort((a, b) => {
      if (a.canRefer && !b.canRefer) return -1
      if (!a.canRefer && b.canRefer) return 1
      if (a.isTrusted && !b.isTrusted) return -1
      if (!a.isTrusted && b.isTrusted) return 1
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    })
  }, [regionJobs, searchTerm, filters, companyMap])

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
        }
      }
    } else if (!jobId && distributedJobs.length > 0 && !selectedJob && window.innerWidth >= 1024) {
      // Auto-select first job on desktop if no jobId in URL
      setSelectedJob(distributedJobs[0])
      setCurrentJobIndex(0)
    }
  }, [distributedJobs, location.search, selectedJob])

  const handleJobSelect = (job: Job, index: number) => {
    setSelectedJob(job)
    setCurrentJobIndex(index)

    // Update URL
    const params = new URLSearchParams(location.search)
    params.set('jobId', job.id)
    navigate({ search: params.toString() }, { replace: true })

    // Mobile behavior
    if (window.innerWidth < 1024) {
      setIsJobDetailOpen(true)
    }
  }

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({ type: [], category: 'all', location: [], industry: [] });
  }


  return (
    <div
      className="h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-blue-50/30 to-orange-50/20 flex flex-col"
      role="main"
      aria-label="职位搜索页面"
    >
      {/* 搜索和筛选栏 - Sticky Header */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm py-2.5 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="max-w-xl flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索岗位、公司或地点..."
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">清除搜索</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <MultiSelectDropdown
                label="地点"
                options={locationOptions}
                selected={filters.location}
                onChange={(val) => setFilters(prev => ({ ...prev, location: val }))}
              />
              <MultiSelectDropdown
                label="行业"
                options={industryOptions}
                selected={filters.industry}
                onChange={(val) => setFilters(prev => ({ ...prev, industry: val }))}
              />
              <MultiSelectDropdown
                label="岗位类型"
                options={typeOptions}
                selected={filters.type}
                onChange={(val) => setFilters(prev => ({ ...prev, type: val }))}
              />

              {(filters.location.length > 0 || filters.industry.length > 0 || filters.type.length > 0 || filters.category !== 'all' || searchTerm) && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-gray-500 hover:text-blue-600 px-2 transition-colors"
                >
                  重置
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: 'all' }))}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${filters.category === 'all'
                ? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50'
                }`}
            >
              全部
            </button>
            {topCategories.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => setFilters(prev => ({ ...prev, category: cat }))}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${filters.category === cat
                  ? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50'
                  }`}
              >
                {cat}
              </button>
            ))}
            <span className="ml-auto text-gray-500 whitespace-nowrap text-xs self-center">共 {distributedJobs.length} 个职位</span>
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3182CE]" aria-hidden="true"></div>
            <p className="mt-4 text-gray-500">正在加载精彩职位...</p>
          </div>
        ) : distributedJobs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <div className="text-gray-400 text-lg mb-2">暂无符合条件的职位</div>
            <p className="text-gray-500">尝试调整筛选条件或搜索关键词</p>
            <button
              onClick={clearAllFilters}
              className="mt-4 px-6 py-2 bg-[#3182CE] text-white rounded-full hover:bg-[#2b6cb0] transition-colors"
            >
              清除所有筛选
            </button>
          </div>
        ) : (
          <div className="flex h-full gap-6">
            {/* Left Column: Job List */}
            <div className="w-full lg:w-[400px] xl:w-[450px] flex-shrink-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              <div className="space-y-3">
                {distributedJobs.map((job, index) => (
                  <div key={job.id} onClick={() => handleJobSelect(job, index)}>
                    <JobCard
                      job={job}
                      onSave={() => toggleSaveJob(job.id)}
                      isSaved={savedJobs.has(job.id)}
                      isActive={selectedJob?.id === job.id}
                      variant={window.innerWidth >= 1024 ? 'compact' : 'default'}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Job Detail Panel (Desktop Only) */}
            <div className="hidden lg:flex flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {selectedJob ? (
                <JobDetailPanel
                  job={selectedJob}
                  onSave={() => toggleSaveJob(selectedJob.id)}
                  isSaved={savedJobs.has(selectedJob.id)}
                  onApply={() => { /* Handle apply logic if needed, usually just opens URL */ }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  选择一个职位查看详情
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Detail Modal */}
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
    </div>
  )
}
