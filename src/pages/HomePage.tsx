import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Briefcase, Bookmark, AlertTriangle } from 'lucide-react'
import JobDetailModal from '../components/JobDetailModal'
import RSSStatusIndicator from '../components/RSSStatusIndicator'
import { Job } from '../types'
import { jobAggregator } from '../services/job-aggregator'
import { Job as RSSJob } from '../types/rss-types'

// 转换RSS职位为页面职位格式
const convertRSSJobToPageJob = (rssJob: RSSJob): Job => {
  // 处理薪资信息 - 从RSS数据中解析真实薪资
  let salary: { min: number; max: number; currency: string } | undefined = undefined;

  if (rssJob.salary && typeof rssJob.salary === 'string' && rssJob.salary.trim()) {
    const salaryText = rssJob.salary.trim();
    
    // 排除明显不是薪资的文本
    const excludePatterns = [
      /\$[\d,]+\s*(?:million|billion|k|thousand)\s*(?:company|business|startup|funding|investment|valuation|revenue)/i,
      /\$[\d,]+\s*(?:in|of)\s*(?:funding|investment|revenue|sales)/i,
      /\$[\d,]+\s*(?:raised|funded|invested)/i
    ];

    let isExcluded = false;
    for (const excludePattern of excludePatterns) {
      if (excludePattern.test(salaryText)) {
        isExcluded = true;
        break;
      }
    }

    if (!isExcluded) {
      // 尝试从字符串中解析薪资信息
      const salaryMatch = salaryText.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*[-–—到至]\s*(\d+(?:,\d+)*(?:\.\d+)?)/);
      if (salaryMatch) {
        const min = parseInt(salaryMatch[1].replace(/,/g, ''));
        const max = parseInt(salaryMatch[2].replace(/,/g, ''));
        // 确保薪资数字在合理范围内
        if (min >= 1000 && max >= 1000 && min > 0 && max > 0) {
          salary = {
            min,
            max,
            currency: 'USD'
          };
        }
      } else {
        // 尝试解析单个数字
        const singleMatch = salaryText.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
        if (singleMatch) {
          const amount = parseInt(singleMatch[1].replace(/,/g, ''));
          // 确保薪资数字在合理范围内，或者是时薪
          if ((amount >= 1000) || (amount >= 10 && salaryText.toLowerCase().includes('hour'))) {
            salary = {
              min: amount,
              max: amount,
              currency: 'USD'
            };
          }
        }
      }
      
      // 检测货币类型
      if (salary) {
        if (salaryText.includes('¥') || salaryText.includes('CNY') || salaryText.includes('人民币')) {
          salary.currency = 'CNY';
        } else if (salaryText.includes('$') || salaryText.includes('USD')) {
          salary.currency = 'USD';
        } else if (salaryText.includes('€') || salaryText.includes('EUR')) {
          salary.currency = 'EUR';
        }
      }
    }
  }

  // 确定工作类型
  let jobType: Job['type'] = 'full-time';
  if (rssJob.jobType) {
    switch (rssJob.jobType) {
      case 'full-time':
        jobType = 'full-time';
        break;
      case 'part-time':
        jobType = 'part-time';
        break;
      case 'contract':
        jobType = 'contract';
        break;
      case 'freelance':
        jobType = 'freelance';
        break;
      case 'internship':
        jobType = 'internship';
        break;
      default:
        jobType = rssJob.isRemote ? 'remote' : 'full-time';
    }
  } else if (rssJob.isRemote) {
    jobType = 'remote';
  }

  // 计算推荐分数 - 完全独立于薪资数据，基于其他职位属性
  let recommendationScore = 0;
  
  // 基础分数
  recommendationScore += 60;
  
  // 远程工作加分
  if (rssJob.isRemote) {
    recommendationScore += 20;
  }
  
  // 有技能标签加分
  if (rssJob.tags && rssJob.tags.length > 0) {
    recommendationScore += Math.min(rssJob.tags.length * 3, 15);
  }
  
  // 有详细描述加分
  if (rssJob.description && rssJob.description.length > 100) {
    recommendationScore += 10;
  }
  
  // 有公司信息加分
  if (rssJob.company && rssJob.company.trim()) {
    recommendationScore += 5;
  }
  
  // 添加一些随机性，让排序更自然
  recommendationScore += Math.random() * 15;

  return {
    id: rssJob.id,
    title: rssJob.title,
    company: rssJob.company || undefined,  // 不设置虚假公司名
    location: rssJob.location || 'Remote',
    type: jobType,
    salary,
    description: rssJob.description || undefined,  // 不设置虚假描述
    requirements: rssJob.requirements || [],
    responsibilities: rssJob.benefits || [],
    skills: rssJob.tags || [],
    postedAt: rssJob.publishedAt || new Date().toISOString().split('T')[0],
    expiresAt: undefined,  // 不设置虚假过期时间
    source: rssJob.source || 'RSS',
    sourceUrl: rssJob.url || '#',
    recommendationScore, // 基于真实属性计算的推荐分数
    // RSS特有字段
    experienceLevel: rssJob.experienceLevel,
    category: rssJob.category,
    isRemote: rssJob.isRemote,
    remoteLocationRestriction: rssJob.remoteLocationRestriction
  }
}

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
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  // 从URL参数获取筛选条件
  const searchParams = new URLSearchParams(location.search)
  const locationFilter = searchParams.get('location') || ''
  const typeFilter = searchParams.get('type') || ''
  const skillsFilter = searchParams.get('skills') || ''

  // 筛选职位
  const filteredJobs = useMemo(() => {
    let filtered = jobs

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

    // 按推荐分数排序并限制为6个
    return filtered
      .sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
      .slice(0, 6)
  }, [jobs, locationFilter, typeFilter, skillsFilter])

  // 获取RSS职位数据
   useEffect(() => {
     const fetchJobs = async () => {
       try {
         setLoading(true)
         setError(null)
         
         const rssJobs = jobAggregator.getJobs()
         
         if (rssJobs.length > 0) {
           const convertedJobs = rssJobs.map(convertRSSJobToPageJob)
           // 只使用RSS数据，不合并模拟数据
           setJobs(convertedJobs)
           // 设置数据更新时间
           setLastUpdateTime(new Date())
         } else {
           // 如果没有RSS数据，设置为空数组
           setJobs([])
         }
       } catch (err) {
         console.error('获取职位数据失败:', err)
         setError('获取职位数据失败')
         setJobs([])
       } finally {
         setLoading(false)
       }
     }

     fetchJobs()
   }, [])

  const openJobDetail = (job: Job) => {
    setSelectedJob(job)
    setIsJobDetailOpen(true)
  }

  const closeJobDetail = () => {
    setIsJobDetailOpen(false)
    setSelectedJob(null)
  }

  const handleApply = (jobId: string) => {
    if (selectedJob) {
      // 导航到AI优化页面，传递当前岗位信息
      navigate(`/job/${jobId}/apply`, {
        state: {
          job: selectedJob,
          returnToModal: true, // 从模态框进入，返回时需要显示模态框
          previousPath: '/', // 返回到首页
          jobDetailPageState: {
            showModal: true,
            jobId: jobId
          }
        }
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 pt-16 pb-8">
        {/* Hero Section */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Haigoo帮你获得理想的远程工作
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-4">
            专业的远程求职工具，每天为你精选一组最匹配的岗位，Go！
          </p>
          {/* 数据更新时间提示 */}
          {lastUpdateTime && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              今日推荐岗位数据已于{lastUpdateTime.getMonth() + 1}月{lastUpdateTime.getDate()}日{lastUpdateTime.getHours()}点{lastUpdateTime.getMinutes().toString().padStart(2, '0')}分更新
            </p>
          )}
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
                                {job.title}
                              </h3>
                              {job.company && (
                                <p className={`text-sm font-medium ${styles.isTop ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {job.company}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 mb-6">
                          {job.description && (
                            <p className={`text-sm line-clamp-2 leading-relaxed ${styles.isTop ? 'text-gray-700 dark:text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {job.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <p className={`text-sm truncate flex-1 mr-4 whitespace-nowrap overflow-hidden ${styles.isTop ? 'text-gray-600 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              📍 {job.location}
                            </p>
                            {job.salary && job.salary.min > 0 && (
                              <p className={`font-bold text-xl flex-shrink-0 ${styles.isTop ? `bg-gradient-to-r ${styles.accentColor} bg-clip-text text-transparent` : 'text-violet-600 dark:text-violet-400'}`}>
                                ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                          {job.skills.slice(0, 3).map((skill, skillIndex) => (
                            <span
                              key={skillIndex}
                              className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                                styles.isTop 
                                  ? 'bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 backdrop-blur-sm' 
                                  : 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                              }`}
                            >
                              {skill}
                            </span>
                          ))}
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
                                  {job.title}
                                </h3>
                                {job.company && (
                                  <p className="text-gray-600 dark:text-gray-400 font-medium truncate">
                                    {job.company}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 mb-4">
                            {job.description && (
                              <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2 leading-relaxed">
                                {job.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <p className="text-gray-600 dark:text-gray-400 text-sm">
                                📍 {job.location}
                              </p>
                              {job.salary && job.salary.min > 0 && (
                                <p className="text-violet-600 dark:text-violet-400 font-bold text-xl">
                                  ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-4">
                            {job.skills.slice(0, 3).map((skill, skillIndex) => (
                              <span
                                key={skillIndex}
                                className="px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-sm rounded-lg font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                            {job.skills.length > 3 && (
                              <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-lg">
                                +{job.skills.length - 3}
                              </span>
                            )}
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