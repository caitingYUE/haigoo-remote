import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCard from '../components/JobCard'
import JobDetailModal from '../components/JobDetailModal'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
 
import { usePageCache } from '../hooks/usePageCache'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { STANDARD_TAG_LIBRARY } from '../utils/tagSystem'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

 

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
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    location: 'all',
    industry: 'all'
  })
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)
  const jobTypeTags = useMemo(() => Object.values(STANDARD_TAG_LIBRARY).filter(t => t.category === 'job_type'), [])

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
        // 获取数据（后端已翻译）
        setLoadingStage('fetching')
        const response = await processedJobsService.getAllProcessedJobs(200)
        setLoadingStage('idle')

        // 🎉 后端已处理翻译，前端直接使用
        console.log(`✅ 获取到 ${response.length} 个岗位（后端已翻译）`)
        return response
      } catch (error) {
        setLoadingStage('idle')
        throw error
      }
    },
    ttl: 10 * 60 * 1000, // 10分钟缓存
    persist: true, // 持久化到 localStorage
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

  // 监听处理后岗位数据的更新事件（从后台管理触发）
  useEffect(() => {
    const handleUpdated = () => {
      console.log('收到岗位数据更新事件，重新加载收藏、岗位及地址分类...')
      refresh()

        // 重新加载地址分类
        ; (async () => {
          try {
            const r = await fetch('/api/user-profile?action=location_categories_get')
            if (r.ok) {
              const j = await r.json()
              setCategories(j.categories || { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] })
            }
          } catch { }
        })()

        // 重新加载收藏
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

  const filteredJobs = (jobs || []).filter(job => {
    // 搜索匹配
    const matchesSearch = searchTerm === '' ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))

    // 工作类型匹配
    const matchesType = filters.type === 'all' || job.type === filters.type

    // 岗位分类匹配 - 支持处理后数据的category字段和技能标签匹配
    const matchesCategory = filters.category === 'all' ||
      (job.category && job.category === filters.category) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(filters.category.toLowerCase())))

    // 地点匹配 - 支持远程工作判断和处理后数据的isRemote字段
    const matchesLocation = filters.location === 'all' ||
      job.location.includes(filters.location) ||
      (filters.location === 'Remote' && (job.type === 'remote' || job.location.includes('远程') || job.isRemote)) ||
      (filters.location === 'Worldwide' && (job.location.includes('全球') || job.location.includes('远程') || job.isRemote))

    const companyIndustry = job.companyId ? companyMap[job.companyId]?.industry || '' : ''
    const matchesIndustry = filters.industry === 'all' || (companyIndustry && companyIndustry === filters.industry)

    const norm = (v: string) => (v || '').toLowerCase()
    const loc = norm(job.location)
    const skills = (job.skills || []).map((t: string) => norm(t))
    const pool = new Set([loc, ...skills])
    const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))
    const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
    const domesticHit = hit(categories.domesticKeywords)
    const overseasHit = hit(categories.overseasKeywords)
    const matchesRegion = activeRegion === 'domestic' ? (globalHit || domesticHit) : (globalHit || overseasHit)

    return matchesSearch && matchesType && matchesCategory && matchesLocation && matchesIndustry && matchesRegion
  }).sort((a, b) => {
    if (a.canRefer && !b.canRefer) return -1
    if (!a.canRefer && b.canRefer) return 1
    if (a.isTrusted && !b.isTrusted) return -1
    if (!a.isTrusted && b.isTrusted) return 1
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  })


  // 计算当前地区与其它筛选（不含分类）的基础集合，用于“全部 (数量)”显示
  const baseFilteredJobs = (jobs || []).filter(job => {
    const matchesSearch = searchTerm === '' ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))

    const matchesType = filters.type === 'all' || job.type === filters.type
    const matchesLocation = filters.location === 'all' ||
      job.location.includes(filters.location) ||
      (filters.location === 'Remote' && (job.type === 'remote' || job.location.includes('远程') || job.isRemote)) ||
      (filters.location === 'Worldwide' && (job.location.includes('全球') || job.location.includes('远程') || job.isRemote))
    const companyIndustry = job.companyId ? companyMap[job.companyId]?.industry || '' : ''
    const matchesIndustry = filters.industry === 'all' || (companyIndustry && companyIndustry === filters.industry)

    const norm = (v: string) => (v || '').toLowerCase()
    const loc = norm(job.location)
    const skills = (job.skills || []).map((t: string) => norm(t))
    const pool = new Set([loc, ...skills])
    const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))
    const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
    const domesticHit = hit(categories.domesticKeywords)
    const overseasHit = hit(categories.overseasKeywords)
    const matchesRegion = activeRegion === 'domestic' ? (globalHit || domesticHit) : (globalHit || overseasHit)

    return matchesSearch && matchesType && matchesLocation && matchesIndustry && matchesRegion
  })

  

  // 初始化加载已收藏的岗位，用于高亮 Bookmark 状态
  useEffect(() => {
    if (!token) return
      ; (async () => {
        try {
          const resp = await fetch('/api/user-profile', { headers: { Authorization: `Bearer ${token}` } })
          if (resp.ok) {
            const data = await resp.json()
            const ids: string[] = (data?.profile?.savedJobs || []).map((s: any) => s.jobId)
            setSavedJobs(new Set(ids))
          }
        } catch { }
      })()
  }, [token])

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
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, location: prev.location === 'all' ? 'Remote' : prev.location === 'Remote' ? 'Worldwide' : 'all' }))}
                  className="flex items-center gap-1 text-gray-700 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <span>{filters.location === 'all' ? '所有地点' : filters.location === 'Remote' ? '远程' : '全球'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="relative group">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, industry: prev.industry === 'all' ? '互联网/软件' : prev.industry === '互联网/软件' ? '人工智能' : prev.industry === '人工智能' ? '金融/Fintech' : prev.industry === '金融/Fintech' ? '企业服务/SaaS' : 'all' }))}
                  className="flex items-center gap-1 text-gray-700 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <span>{filters.industry === 'all' ? '全部行业' : filters.industry}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="relative group">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, type: prev.type === 'all' ? 'full-time' : prev.type === 'full-time' ? 'part-time' : prev.type === 'part-time' ? 'contract' : prev.type === 'contract' ? 'freelance' : prev.type === 'freelance' ? 'internship' : 'all' }))}
                  className="flex items-center gap-1 text-gray-700 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <span>{filters.type === 'all' ? '岗位类型' : filters.type === 'full-time' ? '全职' : filters.type === 'part-time' ? '兼职' : filters.type === 'contract' ? '合同' : filters.type === 'freelance' ? '自由职业' : '实习'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-4 text-sm overflow-x-auto pb-2 scrollbar-hide bg-slate-50 rounded-lg px-3 py-2">
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: 'all' }))}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === 'all' ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              全部 ({baseFilteredJobs.length})
            </button>
            {jobTypeTags.map(t => (
              <button
                key={t.id}
                onClick={() => setFilters(prev => ({ ...prev, category: t.label }))}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === t.label ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {t.label}
              </button>
            ))}
            <span className="ml-auto text-gray-500 whitespace-nowrap text-xs">共 {filteredJobs.length} 个职位</span>
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
                onClick={() => { setSearchTerm(''); setFilters({ type: 'all', category: 'all', location: 'all', industry: 'all' }); }}
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
