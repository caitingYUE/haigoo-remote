import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Briefcase, Bookmark, AlertTriangle, ChevronDown, Clock, MapPin, Building, RefreshCw } from 'lucide-react'
import JobDetailModal from '../components/JobDetailModal'
import RSSStatusIndicator from '../components/RSSStatusIndicator'
import JobCard from '../components/JobCard'
import RecommendationCard from '../components/RecommendationCard'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { recommendationHistoryService } from '../services/recommendation-history-service'
import { processJobDescription } from '../utils/text-formatter'
import SingleLineTags from '../components/SingleLineTags'
import { jobTranslationService } from '../services/job-translation-service'
import { usePageCache } from '../hooks/usePageCache'



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

// 获取推荐样式
const getRecommendationStyles = (score?: number, index?: number) => {
  if (!score || score < 70) {
    return {
      cardClass: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-700',
      showBadge: false,
      isTop: false,
      badge: '',
      label: '',
      accentColor: ''
    }
  }

  // TOP 1, 2, 3 样式 - 精致专业的设计
  const topStyles = [
    {
      // TOP 1 - 高端金色渐变
      cardClass: 'relative bg-gradient-to-br from-amber-50/80 via-yellow-50/60 to-orange-50/80 dark:from-amber-900/25 dark:via-yellow-900/20 dark:to-orange-900/25 rounded-2xl p-8 shadow-2xl hover:shadow-3xl border border-amber-200/40 dark:border-amber-700/40 backdrop-blur-sm ring-1 ring-amber-300/20 dark:ring-amber-600/20',
      badge: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white shadow-2xl backdrop-blur-sm ring-2 ring-white/30',
      label: 'TOP 1',
      showBadge: true,
      isTop: true,
      accentColor: 'from-amber-500 via-yellow-500 to-orange-500'
    },
    {
      // TOP 2 - 优雅蓝紫渐变
      cardClass: 'relative bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-purple-50/80 dark:from-blue-900/25 dark:via-indigo-900/20 dark:to-purple-900/25 rounded-2xl p-8 shadow-2xl hover:shadow-3xl border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-sm ring-1 ring-blue-300/20 dark:ring-blue-600/20',
      badge: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white shadow-2xl backdrop-blur-sm ring-2 ring-white/30',
      label: 'TOP 2',
      showBadge: true,
      isTop: true,
      accentColor: 'from-blue-500 via-indigo-500 to-purple-500'
    },
    {
      // TOP 3 - 清新青绿渐变
      cardClass: 'relative bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-cyan-50/80 dark:from-emerald-900/25 dark:via-teal-900/20 dark:to-cyan-900/25 rounded-2xl p-8 shadow-2xl hover:shadow-3xl border border-emerald-200/40 dark:border-emerald-700/40 backdrop-blur-sm ring-1 ring-emerald-300/20 dark:ring-emerald-600/20',
      badge: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-2xl backdrop-blur-sm ring-2 ring-white/30',
      label: 'TOP 3',
      showBadge: true,
      isTop: true,
      accentColor: 'from-emerald-500 via-teal-500 to-cyan-500'
    }
  ]

  return topStyles[index || 0] || {
    cardClass: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-700',
    showBadge: false,
    isTop: false,
    badge: '',
    label: '',
    accentColor: ''
  }
}

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // 使用页面缓存 Hook
  const {
    data: jobs,
    loading,
    error: loadError,
    refresh,
    isFromCache,
    cacheAge
  } = usePageCache<Job[]>('homepage-recommendations', {
    fetcher: async () => {
      // 性能优化：首页只加载30条用于推荐
      const response = await processedJobsService.getProcessedJobs(1, 30)
      if (response.jobs.length > 0) {
        // 翻译岗位数据为中文
        const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
        return translatedJobs
      }
      return []
    },
    ttl: 0, // 永不过期，只有手动刷新才更新
    persist: true, // 持久化到 localStorage
    namespace: 'homepage',
    onSuccess: (jobs) => {
      setLastUpdateTime(new Date())
      console.log(`✅ 首页加载了 ${jobs.length} 个岗位推荐${isFromCache ? '（来自缓存）' : '（新数据）'}`)
    }
  })
  
  // 将 error 转换为字符串格式（保持原有逻辑兼容）
  const error = loadError?.message || null
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  const [historyExpansionLevel, setHistoryExpansionLevel] = useState(0) // 0: 不显示, 1: 昨天, 2: 前2天, 3: 前3天
  const [pastRecommendations, setPastRecommendations] = useState<{[key: string]: Job[]}>({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [todayRecommendations, setTodayRecommendations] = useState<Job[]>([]) // 今天的固定推荐

  // 从URL参数获取筛选条件
  const searchParams = new URLSearchParams(location.search)
  const locationFilter = searchParams.get('location') || ''
  const typeFilter = searchParams.get('type') || ''
  const skillsFilter = searchParams.get('skills') || ''

  // 筛选职位 - 使用今天的固定推荐
  const filteredJobs = useMemo(() => {
    // 优先使用今天的固定推荐
    const jobsToFilter = todayRecommendations.length > 0 ? todayRecommendations : (jobs || [])
    
    let filtered = jobsToFilter

    if (locationFilter) {
      filtered = filtered.filter(job => 
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
      )
    }

    if (typeFilter) {
      filtered = filtered.filter(job => job.type === typeFilter)
    }

    if (skillsFilter) {
      const skills = skillsFilter.split(',').map(s => s.trim().toLowerCase())
      filtered = filtered.filter(job =>
        skills.some(skill =>
          job.skills.some(jobSkill => jobSkill.toLowerCase().includes(skill))
        )
      )
    }

    // 如果使用的是今天的推荐，保持原有顺序；如果是RSS数据，按推荐分数排序
    if (todayRecommendations.length > 0) {
      return filtered.slice(0, 6) // 今天的推荐已经是固定顺序的
    } else {
      // 按推荐分数排序并限制为6个
      return filtered
        .sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
        .slice(0, 6)
    }
  }, [todayRecommendations, jobs, locationFilter, typeFilter, skillsFilter])

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

  // 加载今天的固定推荐
  useEffect(() => {
    const loadTodayRecommendations = async () => {
      try {
        const todayRec = recommendationHistoryService.getTodayRecommendation()
        if (todayRec && todayRec.jobs) {
          // 翻译今日推荐岗位
          const translatedJobs = await jobTranslationService.translateJobs(todayRec.jobs)
          setTodayRecommendations(translatedJobs)
        }
      } catch (error) {
        console.error('加载今日推荐失败:', error)
      }
    }

    loadTodayRecommendations()
  }, [])

  // 加载历史推荐数据
   const loadHistoryRecommendations = async (level: number) => {
     if (level === 0) {
       setPastRecommendations({})
       return
     }
     
     setLoadingHistory(true)
     try {
       const history = await recommendationHistoryService.getRecommendationsForPastDays(level)
       // 转换为 {[date]: Job[]} 格式并翻译
       const historyMap: {[key: string]: Job[]} = {}
       for (const item of history) {
         const translatedJobs = await jobTranslationService.translateJobs(item.jobs)
         historyMap[item.date] = translatedJobs
       }
       setPastRecommendations(historyMap)
     } catch (error) {
       console.error('加载历史推荐失败:', error)
     } finally {
       setLoadingHistory(false)
     }
   }

  // 当展开级别改变时加载对应的历史数据
  useEffect(() => {
    loadHistoryRecommendations(historyExpansionLevel)
  }, [historyExpansionLevel])

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
      job =
        todayRecommendations.find(j => j.id === jobId) ||
        jobs.find(j => j.id === jobId) ||
        Object.values(pastRecommendations).flat().find(j => j.id === jobId) ||
        null
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 pt-16 pb-8">
        {/* Hero Section */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
              Haigoo帮你获得理想的远程工作
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-4">
            专业的远程求职工具，每天为你精选一组最匹配的岗位，Go！
          </p>
          
          {/* 数据更新时间和刷新按钮 */}
          <div className="flex items-center justify-center gap-4 mb-2">
            {lastUpdateTime && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                今日推荐岗位数据已于{lastUpdateTime.getMonth() + 1}月{lastUpdateTime.getDate()}日{lastUpdateTime.getHours()}点{lastUpdateTime.getMinutes().toString().padStart(2, '0')}分更新
              </p>
            )}
            {isFromCache && cacheAge && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                （缓存数据，{Math.floor(cacheAge / 1000 / 60)}分钟前）
              </span>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-haigoo-primary text-white rounded-lg hover:bg-haigoo-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
              aria-label="刷新推荐岗位"
              title="刷新推荐岗位"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '刷新中...' : '刷新数据'}
            </button>
          </div>
        </div>

        {/* 职位区域 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : filteredJobs.length === 0 ? (
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
            <div className="space-y-12">
              {/* Top 3 推荐岗位 */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                  {filteredJobs.slice(0, 3).map((job, index) => {
                    const isSaved = savedJobs.has(job.id)
                    const styles = getRecommendationStyles(job.recommendationScore, index)
                    
                    return (
                        <div
                          key={job.id}
                          className="relative pt-6"
                        >
                          {/* TOP标签 - 独立容器，确保完全可见 */}
                          {styles.showBadge && (
                            <div className="absolute top-0 right-4 z-30">
                              <div className={`px-4 py-2 rounded-full text-sm font-bold ${styles.badge} transform -rotate-3 hover:rotate-0 transition-all duration-300 shadow-xl border-2 border-white/20`}>
                                {styles.label}
                              </div>
                            </div>
                          )}

                          {/* 卡片主体 */}
                          <div
                            onClick={() => openJobDetail(job)}
                            className={`cursor-pointer transition-all duration-300 group transform hover:-translate-y-2 hover:scale-[1.02] ${styles.cardClass}`}
                          >
                            {/* 装饰性背景元素 - 仅对TOP卡片显示 */}
                            {styles.isTop && (
                              <>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/30 to-transparent rounded-full -translate-y-12 translate-x-12 opacity-60"></div>
                                <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-white/20 to-transparent rounded-full translate-y-10 -translate-x-10 opacity-40"></div>
                                <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-gradient-to-r from-white/10 to-transparent rounded-full -translate-x-1/2 -translate-y-1/2 opacity-30"></div>
                              </>
                            )}

                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center flex-1 min-w-0">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md ${getCompanyColor(job.company || 'Unknown')} ${styles.isTop ? 'ring-2 ring-white/60 dark:ring-gray-600/60' : ''}`}>
                              <span className="text-white font-bold text-lg">
                                {(job.company || 'U').charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-bold text-lg mb-1 truncate ${styles.isTop ? 'text-gray-800 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                                {job.translations?.title || job.title}
                              </h3>
                              {job.company && (
                                <div className={`flex items-center gap-1 text-sm min-w-0 ${styles.isTop ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                  <Building className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                  <span className="truncate" title={job.translations?.company || job.company}>{job.translations?.company || job.company}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 mb-6">
                          {(job.translations?.description || job.description) && (
                            <p className={`text-sm line-clamp-2 leading-relaxed ${styles.isTop ? 'text-gray-700 dark:text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {processJobDescription(job.translations?.description || job.description || '', { 
                                formatMarkdown: false, 
                                maxLength: 120, 
                                preserveHtml: false 
                              })}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-1 text-sm flex-1 mr-4 min-w-0 whitespace-nowrap overflow-hidden ${styles.isTop ? 'text-gray-600 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="truncate" title={job.translations?.location || job.location}>{job.translations?.location || job.location}</span>
                            </div>
                            {job.salary && job.salary.min > 0 && (
                              <p className={`font-bold text-xl flex-shrink-0 ${styles.isTop ? `bg-gradient-to-r ${styles.accentColor} bg-clip-text text-transparent` : 'text-violet-600 dark:text-violet-400'}`}>
                                ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mb-6">
                          <SingleLineTags 
                            tags={(Array.isArray((job as any).tags) && (job as any).tags.length > 0 ? (job as any).tags : (job.skills || [])) as string[]}
                            fallback="remote"
                            size="sm"
                            className=""
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openJobDetail(job);
                            }}
                            className={`flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 mr-3 ${
                              styles.isTop 
                                ? `bg-gradient-to-r ${styles.accentColor} hover:shadow-lg hover:scale-[1.02] shadow-md` 
                                : 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600'
                            }`}
                          >
                            立即申请
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavedJobs(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(job.id)) {
                                  newSet.delete(job.id);
                                } else {
                                  newSet.add(job.id);
                                }
                                return newSet;
                              });
                            }}
                            className={`p-3 rounded-xl transition-all duration-200 ${
                              isSaved
                                ? styles.isTop 
                                  ? `bg-gradient-to-r ${styles.accentColor} text-white shadow-md` 
                                  : 'bg-violet-600 text-white dark:bg-violet-500'
                                : styles.isTop
                                  ? 'bg-white/60 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-white/80 dark:hover:bg-gray-800/80 backdrop-blur-sm'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            } hover:scale-110`}
                          >
                            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                          </div>
                        </div>
                    )
                  })}
                </div>
              </div>

              {/* 更多推荐岗位 */}
              {filteredJobs.length > 3 && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredJobs.slice(3, 6).map((job) => {
                      const isSaved = savedJobs.has(job.id)
                      
                      return (
                        <div
                          key={job.id}
                          onClick={() => openJobDetail(job)}
                          className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 cursor-pointer transition-all duration-300 group shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-sm ${getCompanyColor(job.company || 'Unknown')}`}>
                                <span className="text-white font-bold text-base">
                                  {(job.company || 'U').charAt(0)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                  {job.translations?.title || job.title}
                                </h3>
                                {job.company && (
                                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm font-medium min-w-0">
                                    <Building className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    <span className="truncate" title={job.translations?.company || job.company}>{job.translations?.company || job.company}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 mb-4">
                            {(job.translations?.description || job.description) && (
                              <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2 leading-relaxed">
                                {processJobDescription((job.translations?.description || job.description) || '', { 
                                  formatMarkdown: false, 
                                  maxLength: 120, 
                                  preserveHtml: false 
                                })}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm min-w-0">
                                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="truncate" title={job.translations?.location || job.location}>{job.translations?.location || job.location}</span>
                              </div>
                              {job.salary && job.salary.min > 0 && (
                                <p className="text-violet-600 dark:text-violet-400 font-bold text-xl">
                                  ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mb-4">
                            {(() => {
                              const tags: string[] = (Array.isArray((job as any).tags) && (job as any).tags.length > 0
                                ? (job as any).tags
                                : (job.skills || [])) as string[]
                              return (
                                <SingleLineTags tags={tags} fallback="remote" size="sm" />
                              )
                            })()}
                          </div>

                          <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApply(job.id);
                              }}
                              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 text-sm"
                            >
                              立即申请
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSavedJobs(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(job.id)) {
                                    newSet.delete(job.id);
                                  } else {
                                    newSet.add(job.id);
                                  }
                                  return newSet;
                                });
                              }}
                              className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-violet-400 dark:hover:border-violet-500 text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                            >
                              <Bookmark className={`w-5 h-5 ${isSaved ? 'text-violet-600 dark:text-violet-400 fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 过往推荐内联展示 */}
          {(filteredJobs.length > 0 || historyExpansionLevel > 0) && (
            <div className="mt-12">
              {/* 昨天推荐 - 默认显示 */}
              {historyExpansionLevel >= 1 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-violet-600 dark:text-violet-400" />
                    昨天推荐
                  </h3>
                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {Object.entries(pastRecommendations)
                         .filter(([date]) => {
                           const yesterday = new Date()
                           yesterday.setDate(yesterday.getDate() - 1)
                           return date === yesterday.toISOString().split('T')[0]
                         })
                         .flatMap(([date, jobs]) => 
                           jobs.slice(0, 6).map((job) => (
                             <RecommendationCard
                               key={job.id}
                               job={job}
                               onClick={() => openJobDetail(job)}
                               onApply={(id) => handleApply(id)}
                               onToggleSave={(id) => {
                                 setSavedJobs(prev => {
                                   const newSet = new Set(prev)
                                   if (newSet.has(id)) newSet.delete(id)
                                   else newSet.add(id)
                                   return newSet
                                 })
                               }}
                               isSaved={savedJobs.has(job.id)}
                               showSourceLink={false}
                               showMeta={false}
                               showLocation={true}
                             />
                           ))
                         )}
                     </div>
                  )}
                </div>
              )}

              {/* 前天推荐 - 展开级别2时显示 */}
              {historyExpansionLevel >= 2 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-violet-600 dark:text-violet-400" />
                    前天推荐
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {Object.entries(pastRecommendations)
                       .filter(([date]) => {
                         const dayBeforeYesterday = new Date()
                         dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
                         return date === dayBeforeYesterday.toISOString().split('T')[0]
                       })
                       .flatMap(([date, jobs]) => 
                         jobs.slice(0, 6).map((job) => (
                           <RecommendationCard
                             key={job.id}
                             job={job}
                             onClick={() => openJobDetail(job)}
                             onApply={(id) => handleApply(id)}
                             onToggleSave={(id) => {
                               setSavedJobs(prev => {
                                 const newSet = new Set(prev)
                                 if (newSet.has(id)) newSet.delete(id)
                                 else newSet.add(id)
                                 return newSet
                               })
                             }}
                             isSaved={savedJobs.has(job.id)}
                             showSourceLink={false}
                             showMeta={false}
                             showLocation={true}
                           />
                         ))
                       )}
                   </div>
                </div>
              )}

              {/* 大前天推荐 - 展开级别3时显示 */}
              {historyExpansionLevel >= 3 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-violet-600 dark:text-violet-400" />
                    大前天推荐
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {Object.entries(pastRecommendations)
                       .filter(([date]) => {
                         const threeDaysAgo = new Date()
                         threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
                         return date === threeDaysAgo.toISOString().split('T')[0]
                       })
                       .flatMap(([date, jobs]) => 
                         jobs.slice(0, 6).map((job) => (
                           <RecommendationCard
                             key={job.id}
                             job={job}
                             onClick={() => openJobDetail(job)}
                             onApply={(id) => handleApply(id)}
                             onToggleSave={(id) => {
                               setSavedJobs(prev => {
                                 const newSet = new Set(prev)
                                 if (newSet.has(id)) newSet.delete(id)
                                 else newSet.add(id)
                                 return newSet
                               })
                             }}
                             isSaved={savedJobs.has(job.id)}
                             showSourceLink={false}
                             showMeta={false}
                             showLocation={true}
                           />
                         ))
                       )}
                   </div>
                </div>
              )}

              {/* 展开/收起按钮 */}
              <div className="flex justify-center mt-8">
                {historyExpansionLevel === 0 && (
                  <button
                    onClick={() => setHistoryExpansionLevel(1)}
                    className="flex items-center px-6 py-3 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg transition-colors duration-200 group"
                  >
                    <Clock className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                    <span className="font-medium">查看昨天推荐</span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                )}
                
                {historyExpansionLevel === 1 && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => setHistoryExpansionLevel(2)}
                      className="flex items-center px-6 py-3 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg transition-colors duration-200"
                    >
                      <span className="font-medium">查看更多历史</span>
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </button>
                    <button
                      onClick={() => setHistoryExpansionLevel(0)}
                      className="flex items-center px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
                    >
                      <span className="font-medium">收起</span>
                    </button>
                  </div>
                )}
                
                {historyExpansionLevel === 2 && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => setHistoryExpansionLevel(3)}
                      className="flex items-center px-6 py-3 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg transition-colors duration-200"
                    >
                      <span className="font-medium">查看全部历史</span>
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </button>
                    <button
                      onClick={() => setHistoryExpansionLevel(0)}
                      className="flex items-center px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
                    >
                      <span className="font-medium">收起</span>
                    </button>
                  </div>
                )}
                
                {historyExpansionLevel === 3 && (
                  <button
                    onClick={() => setHistoryExpansionLevel(0)}
                    className="flex items-center px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200"
                  >
                    <span className="font-medium">收起历史推荐</span>
                  </button>
                )}
              </div>
            </div>
          )}
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
          isSaved={savedJobs.has(selectedJob.id)}
          onSave={(jobId: string) => {
            setSavedJobs(prev => {
              const newSet = new Set(prev)
              if (newSet.has(jobId)) {
                newSet.delete(jobId)
              } else {
                newSet.add(jobId)
              }
              return newSet
            })
          }}
        />
      )}
    </div>
  )
}