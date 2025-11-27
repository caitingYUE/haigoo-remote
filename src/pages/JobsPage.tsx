import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Building, DollarSign, Bookmark, Calendar, Briefcase, RefreshCw, Filter, ChevronDown, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCard from '../components/JobCard'
import JobDetailModal from '../components/JobDetailModal'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import BrandHero from '../components/BrandHero'
import HeroVisual from '../components/HeroVisual'
import HeroIllustration from '../components/HeroIllustration'
import SearchBar from '../components/SearchBar'
import homeBgSvg from '../assets/home_bg.svg'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { DateFormatter } from '../utils/date-formatter'
import { processJobDescription } from '../utils/text-formatter'
import { usePageCache } from '../hooks/usePageCache'
import { useNotificationHelpers } from '../components/NotificationSystem'

const jobTypes = [
  { value: 'all', label: '全部类型' },
  { value: 'full-time', label: '全职' },
  { value: 'part-time', label: '兼职' },
  { value: 'contract', label: '合同工' },
  { value: 'freelance', label: '自由职业' },
  { value: 'internship', label: '实习' }
]

const jobCategories = [
  { value: 'all', label: '全部岗位' },
  { value: '软件开发', label: '软件开发' },
  { value: '前端开发', label: '前端开发' },
  { value: '后端开发', label: '后端开发' },
  { value: '全栈开发', label: '全栈开发' },
  { value: 'DevOps', label: 'DevOps' },
  { value: '数据科学', label: '数据科学' },
  { value: '数据分析', label: '数据分析' },
  { value: '产品管理', label: '产品管理' },
  { value: '项目管理', label: '项目管理' },
  { value: 'UI/UX设计', label: 'UI/UX设计' },
  { value: '平面设计', label: '平面设计' },
  { value: '市场营销', label: '市场营销' },
  { value: '数字营销', label: '数字营销' },
  { value: '销售', label: '销售' },
  { value: '客户服务', label: '客户服务' },
  { value: '客户支持', label: '客户支持' },
  { value: '人力资源', label: '人力资源' },
  { value: '财务', label: '财务' },
  { value: '法律', label: '法律' },
  { value: '写作', label: '写作' },
  { value: '内容创作', label: '内容创作' },
  { value: '质量保证', label: '质量保证' },
  { value: '测试', label: '测试' },
  { value: '运营', label: '运营' },
  { value: '商务拓展', label: '商务拓展' },
  { value: '咨询', label: '咨询' },
  { value: '教育培训', label: '教育培训' },
  { value: '其他', label: '其他' }
]

const experienceLevels = [
  { value: 'all', label: '全部经验' },
  { value: 'Entry', label: '入门级' },
  { value: 'Mid', label: '中级' },
  { value: 'Senior', label: '高级' },
  { value: 'Lead', label: '技术负责人' },
  { value: 'Executive', label: '管理层' }
]

const locations = [
  { value: 'all', label: '全部地点' },
  { value: '北京', label: '北京' },
  { value: '上海', label: '上海' },
  { value: '深圳', label: '深圳' },
  { value: '杭州', label: '杭州' },
  { value: '广州', label: '广州' },
  { value: '成都', label: '成都' },
  { value: '西安', label: '西安' },
  { value: '南京', label: '南京' },
  { value: '武汉', label: '武汉' },
  { value: '苏州', label: '苏州' },
  { value: 'Remote', label: '远程工作' },
  { value: 'Worldwide', label: '全球远程' }
]

const remoteOptions = [
  { value: 'all', label: '全部' },
  { value: 'yes', label: '仅远程' },
  { value: 'no', label: '非远程' }
]

export default function JobsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, isAuthenticated } = useAuth()

  // Refs for focus management
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterSectionRef = useRef<HTMLDivElement>(null)
  const jobListRef = useRef<HTMLDivElement>(null)

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
    experience: 'all',
    remote: 'all'
  })
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)

  // 加载阶段状态
  const [loadingStage, setLoadingStage] = useState<'idle' | 'fetching' | 'translating'>('idle')
  const { showSuccess, showError, showWarning } = useNotificationHelpers()

  // 使用页面缓存 Hook
  const {
    data: jobs,
    loading,
    error: loadError,
    refresh,
    isFromCache,
    cacheAge
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

  // Filter keyboard navigation
  const handleFilterKeyDown = (event: React.KeyboardEvent, filterType: string, value: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setFilters(prev => ({ ...prev, [filterType]: value }))
    }
  }

  // Clear filters keyboard handler
  const handleClearFiltersKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setFilters({
        type: 'all',
        category: 'all',
        location: 'all',
        experience: 'all',
        remote: 'all'
      })
    }
  }

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

  const handleApply = (jobId: string) => {
    const job = (jobs || []).find(j => j.id === jobId)
    if (job && job.sourceUrl) {
      window.open(job.sourceUrl, '_blank', 'noopener,noreferrer')
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

    // 经验等级匹配 - 支持处理后数据的experienceLevel字段
    const matchesExperience = filters.experience === 'all' ||
      (job.experienceLevel && job.experienceLevel === filters.experience)

    // 远程工作匹配 - 支持处理后数据的isRemote字段
    const matchesRemote = filters.remote === 'all' ||
      (filters.remote === 'yes' && (job.type === 'remote' || job.location.includes('远程') || job.isRemote)) ||
      (filters.remote === 'no' && !(job.type === 'remote' || job.location.includes('远程') || job.isRemote))

    const norm = (v: string) => (v || '').toLowerCase()
    const loc = norm(job.location)
    const skills = (job.skills || []).map((t: string) => norm(t))
    const pool = new Set([loc, ...skills])
    const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))
    const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
    const domesticHit = hit(categories.domesticKeywords)
    const overseasHit = hit(categories.overseasKeywords)
    const matchesRegion = activeRegion === 'domestic' ? (globalHit || domesticHit) : (globalHit || overseasHit)

    return matchesSearch && matchesType && matchesCategory && matchesLocation && matchesExperience && matchesRemote && matchesRegion
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

    const matchesExperience = filters.experience === 'all' ||
      (job.experienceLevel && job.experienceLevel === filters.experience)

    const matchesRemote = filters.remote === 'all' ||
      (filters.remote === 'yes' && (job.type === 'remote' || job.location.includes('远程') || job.isRemote)) ||
      (filters.remote === 'no' && !(job.type === 'remote' || job.location.includes('远程') || job.isRemote))

    const norm = (v: string) => (v || '').toLowerCase()
    const loc = norm(job.location)
    const skills = (job.skills || []).map((t: string) => norm(t))
    const pool = new Set([loc, ...skills])
    const hit = (keys: string[]) => (keys || []).some(k => pool.has(norm(k)) || loc.includes(norm(k)))
    const globalHit = hit(categories.globalKeywords) || /anywhere|everywhere|worldwide|不限地点/.test(loc)
    const domesticHit = hit(categories.domesticKeywords)
    const overseasHit = hit(categories.overseasKeywords)
    const matchesRegion = activeRegion === 'domestic' ? (globalHit || domesticHit) : (globalHit || overseasHit)

    return matchesSearch && matchesType && matchesLocation && matchesExperience && matchesRemote && matchesRegion
  })

  const activeFiltersCount = Object.values(filters).filter(value => value !== 'all').length

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

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button className="flex items-center gap-1 text-gray-700 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <span>所有地点</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="relative group">
                <button className="flex items-center gap-1 text-gray-700 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <span>全部类型</span>
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
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: '市场营销' }))}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === '市场营销' ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              市场营销
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: '销售' }))}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === '销售' ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              销售
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: '软件开发' }))}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === '软件开发' ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              软件开发
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: '客户支持' }))}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === '客户支持' ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              客户支持
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, category: '产品管理' }))}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${filters.category === '产品管理' ? 'bg-blue-500 text-white font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              产品管理
            </button>
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
                onClick={() => { setSearchTerm(''); setFilters({ type: 'all', category: 'all', location: 'all', experience: 'all', remote: 'all' }); }}
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
