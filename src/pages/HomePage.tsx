import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Briefcase, AlertTriangle, RefreshCw } from 'lucide-react'
import JobDetailModal from '../components/JobDetailModal'
import BrandHero from '../components/BrandHero'
import RSSStatusIndicator from '../components/RSSStatusIndicator'
import JobCard from '../components/JobCard'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
// ❌ 不再前端实时翻译，数据从后端API获取已翻译
// import { jobTranslationService } from '../services/job-translation-service'



// 获取公司颜色
const getCompanyColor = (companyName: string) => {
  const colors = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500'
  ]
  
  const index = companyName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}

// 推荐样式已移除：页面改为统一的画廊卡片样式

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // 加载阶段状态
  const [loadingStage, setLoadingStage] = useState<'idle' | 'fetching' | 'translating'>('idle')
  
  // 使用页面缓存 Hook
  const {
    data: jobs,
    loading,
    error: loadError,
    refresh,
    isFromCache,
    cacheAge
  } = usePageCache<Job[]>('homepage-all-jobs', {
    fetcher: async () => {
      try {
        // 新首页使用后台数据库“全部数据”：聚合所有分页；本地失败时自动回退到预发
        setLoadingStage('fetching')
        const allJobs = await processedJobsService.getAllProcessedJobsFull(100)
        setLoadingStage('idle')

        console.log(`✅ 已聚合全部岗位，共 ${allJobs.length} 条（后端已翻译）`)
        return allJobs
      } catch (error) {
        setLoadingStage('idle')
        throw error
      }
    },
    ttl: 0, // 永不过期，只有手动刷新才更新
    persist: true, // 持久化到 localStorage
    namespace: 'homepage',
    onSuccess: (jobs) => {
      setLastUpdateTime(new Date())
      setLoadingStage('idle')
      console.log(`✅ 首页加载了 ${jobs.length} 个岗位（${isFromCache ? '来自缓存' : '新数据'}）`)
    }
  })
  
  // 将 error 转换为字符串格式（保持原有逻辑兼容）
  const error = loadError?.message || null
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<string>('全部')
  const [displayLimit, setDisplayLimit] = useState<number>(24)

  // 从URL参数获取筛选条件
  const searchParams = new URLSearchParams(location.search)
  const locationFilter = searchParams.get('location') || ''
  const typeFilter = searchParams.get('type') || ''
  const skillsFilter = searchParams.get('skills') || ''

  // 归一化筛选：使用RSS处理后的岗位作为基础，支持URL参数与Tab过滤
  const categories = useMemo(() => {
    const set = new Set<string>()
    ;(jobs || []).forEach(j => { if (j.category) set.add(j.category) })
    return Array.from(set).sort()
  }, [jobs])

  // 动态生成Tabs：全部、最新、各岗位类别
  const dynamicTabs = useMemo(() => {
    // 采用无边框文本Tab：仅使用后台岗位类别 + “全部”
    return ['全部', ...categories]
  }, [categories])

  const filteredAllJobs = useMemo(() => {
    let filtered = (jobs || [])

    if (locationFilter) {
      filtered = filtered.filter(job => 
        (job.translations?.location || job.location || '').toLowerCase().includes(locationFilter.toLowerCase())
      )
    }

    if (typeFilter) {
      filtered = filtered.filter(job => job.type === typeFilter)
    }

    if (skillsFilter) {
      const skills = skillsFilter.split(',').map(s => s.trim().toLowerCase())
      filtered = filtered.filter(job =>
        skills.some(skill =>
          (job.skills || []).some(jobSkill => jobSkill.toLowerCase().includes(skill))
        )
      )
    }

    return filtered
  }, [jobs, locationFilter, typeFilter, skillsFilter])

  const latestJobs = useMemo(() => {
    return [...filteredAllJobs].sort((a, b) => {
      const ta = new Date(a.postedAt || 0).getTime()
      const tb = new Date(b.postedAt || 0).getTime()
      return tb - ta
    })
  }, [filteredAllJobs])

  const categoryJobs = useMemo(() => {
    if (!activeTab || activeTab === '全部') return filteredAllJobs
    return filteredAllJobs.filter(j => j.category === activeTab)
  }, [filteredAllJobs, activeTab])

  const displayedJobs = useMemo(() => {
    const base = activeTab === '全部' ? latestJobs : categoryJobs
    return base.slice(0, displayLimit)
  }, [activeTab, latestJobs, categoryJobs, displayLimit])

  // 从URL参数读取tab，驱动初始Tab状态
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && dynamicTabs.includes(tab)) {
      setActiveTab(tab)
    }
  }, [location.search, dynamicTabs])

  // 监听后台刷新事件，自动更新首页推荐数据
  useEffect(() => {
    const handleUpdated = () => {
      refresh() // 使用缓存的 refresh 方法
    }
    window.addEventListener('processed-jobs-updated', handleUpdated)
    return () => {
      window.removeEventListener('processed-jobs-updated', handleUpdated)
    }
  }, [refresh])

  // 推荐相关的useEffect与历史数据逻辑已移除

  const openJobDetail = (job: Job) => {
    setSelectedJob(job)
    setIsJobDetailOpen(true)
  }

  const closeJobDetail = () => {
    setIsJobDetailOpen(false)
    setSelectedJob(null)
  }

  const handleApply = (jobId: string) => {
    // 优先使用当前已选岗位
    let job = selectedJob

    // 如果没有打开详情，则在当前数据源中查找该岗位
    if (!job) {
      job = jobs?.find(j => j.id === jobId) || null
    }

    // 成功定位岗位则带状态跳转到申请页；否则兜底直接跳转
    navigate(`/job/${jobId}/apply`, {
      state: job
        ? {
            job,
            returnToModal: false,
            previousPath: '/',
            jobDetailPageState: { showModal: true, jobId }
          }
        : {
            returnToModal: false,
            previousPath: '/'
          }
    })
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 pt-16 pb-8">
        {/* Hero Section */}
        <BrandHero />
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
              发现海内外优质远程岗位
            </h1>
          </div>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-4">
            每日更新数千个远程岗位
          </p>
          
          {/* 数据更新时间 */}
          {lastUpdateTime && !loading && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              数据更新时间：{lastUpdateTime.getMonth() + 1}月{lastUpdateTime.getDate()}日 {lastUpdateTime.getHours()}:{lastUpdateTime.getMinutes().toString().padStart(2, '0')}
            </p>
          )}
        </div>

        {/* 职位区域 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400">正在加载岗位数据...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : displayedJobs.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                暂无匹配的职位
              </h3>
              <p className="text-gray-500 dark:text-gray-500">
                请尝试调整筛选条件或稍后再试
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* 职位Tabs：无边框文本样式，采用岗位类别 */}
              <div className="flex items-center justify-between">
                <div className="flex gap-6 overflow-x-auto whitespace-nowrap py-1" role="tablist" aria-label="岗位分类切换">
                  {dynamicTabs.map(tab => {
                    const isActive = activeTab === tab
                    const count = tab === '全部'
                      ? filteredAllJobs.length
                      : filteredAllJobs.filter(j => j.category === tab).length
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-sm md:text-base font-medium transition-colors duration-200 ${isActive ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'} pb-1`}
                        role="tab"
                        aria-selected={isActive}
                      >
                        {tab}{count ? `（${count}）` : ''}
                      </button>
                    )
                  })}
                </div>
                <div className="text-sm text-gray-500">
                  共 {filteredAllJobs.length} 个职位
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
                {displayedJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => openJobDetail(job)}
                  />
                ))}
              </div>
              {/* 加载更多（保持性能与信息密度） */}
              {displayedJobs.length < (activeTab === '全部' ? latestJobs.length : categoryJobs.length) && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setDisplayLimit(dl => dl + 24)}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                  >
                    加载更多
                  </button>
                </div>
              )}
              
            </div>
          )}

          
          {/* 历史推荐模块已移除，统一采用极简文本Tab + JobCard 画廊 */}
        </div>
      </main>

      {/* RSS状态指示器 */}
      <RSSStatusIndicator />

      {/* 职位详情模态框 */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={isJobDetailOpen}
          onClose={closeJobDetail}
          onApply={handleApply}
        />
      )}
    </div>
  )
}