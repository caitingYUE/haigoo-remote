import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCard from '../components/JobCard'
import JobDetailModal from '../components/JobDetailModal'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { extractLocations, matchesLocationFilter } from '../utils/locationHelper'

import { usePageCache } from '../hooks/usePageCache'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { ALL_JOB_CATEGORIES } from '../utils/tagSystem'
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
  } = usePageCache<Job[]>('jobs-all-list', {
    fetcher: async () => {
      try {
        setLoadingStage('fetching')
        const response = await processedJobsService.getAllProcessedJobs(200)
        setLoadingStage('idle')
        console.log(`✅ 获取到 ${response.length} 个岗位（后端已翻译）`)
        return response
      } catch (error) {
        setLoadingStage('idle')
        throw error
      }
    },
    ttl: 10 * 60 * 1000,
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
      const tags = (job.skills || []).map(t => norm(t)) // job.skills is used as tags in current code? or job.tags? Reading below uses job.skills for filtering.
      // Let's verify if job.tags exists. Code uses job.skills in filter (line 219).
      // But TrustedCompaniesPage used company.tags.
      // Let's stick to job.skills for now as per existing filter logic.
      const pool = new Set([loc, ...tags])
      const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))
      const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
      const domesticHit = hit(categories.domesticKeywords)
      const overseasHit = hit(categories.overseasKeywords)
      
      // Strict Isolation Logic:
      // Domestic: Matches domestic keywords OR (Global/Remote AND NOT Overseas keywords)
      // Overseas: Matches overseas keywords OR (Global/Remote AND NOT Domestic keywords)
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
        // Extract standardized locations using the helper
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
      // 1. Try getting industry from company map
      if (j.companyId) {
        const company = companyMap[j.companyId]
        if (company) {
          // Check direct industry field
          if (company.industry) {
            ind = company.industry
          } 
          // Fallback: Check company tags for potential industry keywords
          // We check if any tag exists in our known Industry list or STANDARD_TAG_LIBRARY industry category
          else if (company.tags && company.tags.length > 0) {
             // This logic relies on us knowing what tags are "industries".
             // For now, let's just assume tags might contain industry info if we match against a list
             // But simpler: if we find a tag that matches one of the standard industries, use it.
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
    // Sort by count descending
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Top 20
      .map(e => e[0])
  }, [regionJobs])

  const filteredJobs = (regionJobs || []).filter(job => { // Filter from regionJobs instead of all jobs
    // 搜索匹配
    const matchesSearch = searchTerm === '' ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))

    // 工作类型匹配 (Multi-select OR logic)
    const matchesType = filters.type.length === 0 || filters.type.includes(job.type)

    // 岗位分类匹配 (Single select for tabs)
    const matchesCategory = filters.category === 'all' ||
      (job.category && job.category === filters.category) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(filters.category.toLowerCase())))

    // 地点匹配 (Multi-select OR logic)
    const matchesLocation = matchesLocationFilter(job.location, filters.location)

    // 行业匹配 (Multi-select OR logic)
    const companyIndustry = job.companyId ? companyMap[job.companyId]?.industry || '' : ''
    const matchesIndustry = filters.industry.length === 0 || filters.industry.includes(companyIndustry)

    // Region logic is already handled by regionJobs, so we don't need to repeat it here.
    
    return matchesSearch && matchesType && matchesCategory && matchesLocation && matchesIndustry
  }).sort((a, b) => {
    if (a.canRefer && !b.canRefer) return -1
    if (!a.canRefer && b.canRefer) return 1
    if (a.isTrusted && !b.isTrusted) return -1
    if (!a.isTrusted && b.isTrusted) return 1
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  })

  // Reset Filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({ type: [], category: 'all', location: [], industry: [] });
  }

  return (
    <div
      className="min-h-screen bg-[#F0F4F8] relative overflow-x-hidden"
      role="main"
      aria-label="职位搜索页面"
    >
      {/* 搜索和筛选栏 */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search and Filter Row */}
          <div className="flex items-center gap-4 mb-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索岗位、公司或地点..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">清除搜索</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Controls */}
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
                  className="text-sm text-gray-500 hover:text-blue-600 px-2"
                >
                  重置
                </button>
              )}
            </div>
          </div>

          {/* Category Tags */}
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: 'all' }))}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filters.category === 'all' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {topCategories.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => setFilters(prev => ({ ...prev, category: cat }))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.category === cat
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
                // Simple color cycling could be added here if desired, but uniform look is cleaner
              >
                {cat}
              </button>
            ))}
            <span className="ml-auto text-gray-500 whitespace-nowrap text-xs self-center">共 {filteredJobs.length} 个职位</span>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3182CE]" aria-hidden="true"></div>
              <p className="mt-4 text-gray-500">正在加载精彩职位...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-2xl shadow-sm">
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
            filteredJobs.map((job, index) => (
              <div key={job.id} className="h-full">
                <JobCard
                  job={job}
                  onSave={() => toggleSaveJob(job.id)}
                  isSaved={savedJobs.has(job.id)}
                  onClick={() => { setSelectedJob(job); setIsJobDetailOpen(true); setCurrentJobIndex(index) }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={isJobDetailOpen}
          onClose={() => { setIsJobDetailOpen(false); setSelectedJob(null) }}
          onSave={() => toggleSaveJob(selectedJob.id)}
          isSaved={savedJobs.has(selectedJob.id)}
          jobs={filteredJobs}
          currentJobIndex={currentJobIndex}
          onNavigateJob={(direction: 'prev' | 'next') => {
            const nextIndex = direction === 'prev' ? Math.max(0, currentJobIndex - 1) : Math.min(filteredJobs.length - 1, currentJobIndex + 1)
            setCurrentJobIndex(nextIndex)
            setSelectedJob(filteredJobs[nextIndex])
          }}
        />
      )}
    </div>
  )
}
