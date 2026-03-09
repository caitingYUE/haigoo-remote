import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, Sparkles, Briefcase, Zap } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCardNew from '../components/JobCardNew'
import JobBundleBanner from '../components/JobBundleBanner'
import JobDetailModal from '../components/JobDetailModal'
import { JobDetailPanel } from '../components/JobDetailPanel'
import JobFilterBar from '../components/JobFilterBar'
import { Job } from '../types'

import { useNotificationHelpers } from '../components/NotificationSystem'
import { trustedCompaniesService } from '../services/trusted-companies-service'
import { trackingService } from '../services/tracking-service'
import { useDebounce } from '../hooks/useDebounce'

// Industry Options (Based on classification-service.js)
const INDUSTRY_OPTIONS = [
  '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
  '电子商务', 'Web3/区块链', '游戏/娱乐', '企业服务/SaaS',
  '硬件/物联网', '其他'
].map(v => ({ label: v, value: v }));

// Job Type Options - Standardized
const JOB_TYPE_OPTIONS = [
  { label: '全职', value: 'full-time' },
  { label: '兼职', value: 'part-time' },
  { label: '合同', value: 'contract' },
  { label: '自由职业', value: 'freelance' },
  { label: '实习', value: 'internship' }
];

// Top Categories (Based on classification-service.js JOB_KEYWORDS)
const CATEGORY_OPTIONS = [
  // 开发
  '后端开发', '前端开发', '全栈开发', '移动开发', '数据开发', '服务器开发',
  '算法工程师', '测试/QA', '运维/SRE', '网络安全', '操作系统/内核',
  '技术支持', '硬件开发', '架构师', 'CTO/技术管理',

  // 产品 & 设计
  '产品经理', '产品设计', 'UI/UX设计', '视觉设计', '平面设计', '用户研究',

  // 业务 & 运营
  '市场营销', '销售', '客户经理', '客户服务', '运营', '增长黑客', '内容创作',

  // 职能
  '人力资源', '招聘', '财务', '法务', '行政', '管理',

  // 数据
  '数据分析', '商业分析', '数据科学',

  // 其他
  '教育培训', '咨询', '投资', '其他'
].map(v => ({ label: v, value: v }));

// Location Options
// const LOCATION_OPTIONS = [
//   { label: '远程', value: 'Remote' },
//   { label: '全球', value: 'Worldwide' }
// ];

import { MobileRestricted } from '../components/MobileRestricted'

import { JobCardSkeleton } from '../components/skeletons/JobCardSkeleton'

export default function JobsPage() {
  console.log('[JobsPage] Version: Preview Fix Applied 2026-02-21 v3 - Layout & Auth Fixes');
  const navigate = useNavigate()
  const location = useLocation()
  const { token, isAuthenticated } = useAuth()

  const [searchTerm, setSearchTerm] = useState(() => {
    // Optimization: Initialize from URL to avoid double-fetch and flash of wrong content
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('search') || params.get('searchQuery') || ''
    }
    return ''
  })
  const searchTermRef = useRef(searchTerm)
  // P0 Fix: Debounce search term to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  // P0 Fix: AbortController ref for canceling pending requests
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])


  // New Filter State Structure
  const [filters, setFilters] = useState(() => {
    const defaultFilters = {
      category: [] as string[],
      experienceLevel: [] as string[],
      industry: [] as string[],
      regionType: [] as string[],
      sourceType: [] as string[],
      location: [] as string[],
      timezone: [] as string[],
      jobType: [] as string[],
      salary: [] as string[],
      isTrusted: false,
      isNew: false
    }

    try {
      const saved = localStorage.getItem('haigoo_job_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with defaults to ensure all fields exist (especially new ones like timezone)
        return { ...defaultFilters, ...parsed }
      }
    } catch (e) {
      console.error('Failed to load filters', e)
    }
    return defaultFilters
  })

  // Dynamic Filter Options State
  const [categoryOptions, setCategoryOptions] = useState<{ label: string, value: string, count?: number }[]>(CATEGORY_OPTIONS);
  const [industryOptions, setIndustryOptions] = useState<{ label: string, value: string, count?: number }[]>(INDUSTRY_OPTIONS);
  const [jobTypeOptions, setJobTypeOptions] = useState<{ label: string, value: string, count?: number }[]>(JOB_TYPE_OPTIONS);
  const [locationOptions, setLocationOptions] = useState<{ label: string, value: string, count?: number }[]>([]);
  const [timezoneOptions, setTimezoneOptions] = useState<{ label: string, value: string, count?: number }[]>([]);

  // P0 Fix: Reset options when search term changes or filters are cleared (to avoid getting stuck with empty options)
  useEffect(() => {
    if (!searchTerm && !filters.category.length && !filters.industry.length && !filters.location.length) {
      // Reset to full list if no filters active
      setCategoryOptions(CATEGORY_OPTIONS);
      setIndustryOptions(INDUSTRY_OPTIONS);
      setJobTypeOptions(JOB_TYPE_OPTIONS);
      // Location remains dynamic
    }
  }, [searchTerm, filters]);

  useEffect(() => {
    localStorage.setItem('haigoo_job_filters', JSON.stringify(filters))
  }, [filters])

  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [showInlineDetail, setShowInlineDetail] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)

  // 岗位数据状态（替代页面缓存）
  const [jobs, setJobs] = useState<Job[]>([])
  // P0 Fix: Initialize loading to true to prevent "No jobs found" flash
  const [jobsLoading, setJobsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalJobs, setTotalJobs] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<'relevance' | 'recent'>('relevance')
  const [activeBundle, setActiveBundle] = useState<any>(null);

  useEffect(() => {
    // Fetch active bundle
    const fetchActiveBundle = async () => {
      try {
        const res = await fetch('/api/data/job-bundles?is_active=true');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          // Time filtering is now handled by the backend API.
          // Only filter by visibility based on current user state.
          const validBundles = data.data.filter((b: any) => {
            const vis = b.visibility || (b.is_public !== false ? 'public' : 'admin');
            if (vis === 'admin') return false; // Admin hidden on C-side
            // members-only bundles are deliberately kept here to serve as marketing hooks for unauthorized users
            return true;
          });

          if (validBundles.length > 0) {
            // Sort by priority (asc) and pick first
            validBundles.sort((a: any, b: any) => (a.priority || 10) - (b.priority || 10));
            setActiveBundle(validBundles[0]);
          } else {
            setActiveBundle(null);
          }
        } else {
          setActiveBundle(null);
        }
      } catch (e) {
        console.error('Failed to fetch active bundle', e);
        setActiveBundle(null);
      }
    };
    fetchActiveBundle();
  }, [isAuthenticated]);

  // 匹配分数缓存（不再需要单独管理，因为后端已经返回匹配分数）
  const [matchScores, setMatchScores] = useState<Record<string, number>>({})
  const [matchScoresLoading, setMatchScoresLoading] = useState(false)
  // Track if initial match scores have been loaded
  const [initialMatchScoresLoaded, setInitialMatchScoresLoaded] = useState(false)

  const openCommunityPage = useCallback(() => {
    navigate('/community')
  }, [navigate])

  // 加载阶段状态
  const [, setLoadingStage] = useState<'idle' | 'fetching' | 'translating'>('idle')
  const { showSuccess, showError, showWarning } = useNotificationHelpers()

  // 加载岗位数据（使用新的后端API，支持筛选和分页）
  const loadJobsWithFilters = useCallback(async (page = 1, loadMore = false) => {
    // P0 Fix: Cancel any pending request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      if (loadMore) {
        setLoadingMore(true)
      } else {
        setJobsLoading(true)
        setLoadingStage('fetching')
      }

      // 构建查询参数
      const queryParams = new URLSearchParams()

      // 智能判断：如果已登录且有Token，尝试获取带匹配分数的列表；否则获取普通列表
      // 如果后端返回 401 (Token失效)，会自动降级为普通列表
      const shouldUseMatchScore = isAuthenticated && token;
      if (shouldUseMatchScore) {
        queryParams.append('action', 'jobs_with_match_score')
      }

      queryParams.append('page', page.toString())
      queryParams.append('pageSize', pageSize.toString())

      // Explicitly handle sortBy
      if (sortBy === 'recent') {
        queryParams.append('sortBy', 'recent')
      } else {
        // Explicitly send relevance to ensure backend knows the intent
        queryParams.append('sortBy', 'relevance')
      }

      // Debug Log
      console.log('[loadJobsWithFilters] Current filters state:', filters);

      if (searchTerm) queryParams.append('search', searchTerm)
      if (filters.category?.length > 0) queryParams.append('category', filters.category.join(','))
      if (filters.experienceLevel?.length > 0) queryParams.append('experienceLevel', filters.experienceLevel.join(','))
      if (filters.location?.length > 0) queryParams.append('location', filters.location.join(','))
      if (filters.industry?.length > 0) queryParams.append('industry', filters.industry.join(','))
      if (filters.regionType?.length > 0) queryParams.append('regionType', filters.regionType.join(','))
      if (filters.sourceType?.length > 0) queryParams.append('sourceType', filters.sourceType.join(','))
      if (filters.type?.length > 0) queryParams.append('type', filters.type.join(','))
      if (filters.jobType?.length > 0) queryParams.append('jobType', filters.jobType.join(','))
      if (filters.salary?.length > 0) queryParams.append('salary', filters.salary.join(','))
      if (filters.isTrusted) queryParams.append('isTrusted', 'true')
      if (filters.isNew) queryParams.append('isNew', 'true')
      // ⚠️ P0 Fix: Always enforce approval check for C-side job list
      queryParams.append('isApproved', 'true')

      // Debug Log
      console.log('[loadJobsWithFilters] Request params:', queryParams.toString());

      // P0 Fix: Add timestamp to prevent caching of old API response structure
      const requestUrl = `/api/data/processed-jobs?${queryParams.toString()}&_t=${Date.now()}`;
      console.log('[loadJobsWithFilters] Fetching:', requestUrl);

      let response = await fetch(requestUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal // P0 Fix: Pass abort signal
      })

      // 自动降级处理：如果带分数的接口返回 401 (Unauthorized) 或 500 (Server Error)，尝试降级为普通接口
      if (!response.ok && shouldUseMatchScore) {
        console.warn(`[JobsPage] Failed to fetch matched jobs (status ${response.status}), falling back to standard list`)
        queryParams.delete('action') // 移除 action 参数，回退到默认列表
        response = await fetch(`/api/data/processed-jobs?${queryParams.toString()}`, { signal })
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Debug Aggregations
      console.log('[loadJobsWithFilters] Response Data:', {
        total: data.total,
        jobsCount: data.jobs?.length,
        hasAggregations: !!data.aggregations,
        aggregations: data.aggregations
      });

      // 设置岗位数据和分页信息
      if (loadMore) {
        // 加载更多时，追加数据
        setJobs(prevJobs => [...prevJobs, ...(data.jobs || [])])
      } else {
        // 首次加载或筛选条件变化时，替换数据
        const newJobs = data.jobs || []
        setJobs(newJobs)

        // 优化交互：仅在没有选中岗位或选中岗位不在列表中时，自动选中第一个
        // 重要修复：不再每次加载都覆盖用户的选择，防止无限刷新循环
        if (newJobs.length > 0 && window.innerWidth >= 1024) {
          setSelectedJob((prev: Job | null) => {
            // 如果没有选中岗位，选中第一个
            if (prev === null) {
              setCurrentJobIndex(0)
              setShowInlineDetail(true)
              return newJobs[0]
            }
            // 如果已有选中岗位，检查是否仍在新列表中
            const stillExists = newJobs.find((j: Job) => j.id === prev.id)
            if (stillExists) {
              // 更新索引以防列表顺序变化
              const newIndex = newJobs.findIndex((j: Job) => j.id === prev.id)
              setCurrentJobIndex(newIndex >= 0 ? newIndex : 0)
              return prev // 保持现有选中
            }
            // 选中的岗位不在新列表中，选中第一个
            setCurrentJobIndex(0)
            setShowInlineDetail(true)
            return newJobs[0]
          })
        } else {
          // 移动端或无数据时，清除选中状态
          setSelectedJob(null)
        }
      }
      setTotalJobs(data.total || 0)
      setCurrentPage(page)
      setLoadingStage('idle')

      // Update Dynamic Filter Options from Aggregations
      if (!loadMore && data.aggregations) {
        const { category, industry, jobType, location, timezone } = data.aggregations;

        // Helper to merge with static options
        const mergeOptions = (staticOpts: any[], dynamicOpts: any[], selectedValues: string[] = []) => {
          // 修正：如果 dynamicOpts 存在但为空数组（表示当前条件下无数据），则应返回空，而不是回退到静态全量
          // 但为了防止筛选死锁（选中了某个值但不在列表中导致无法取消），我们需要保留已选中的值
          if (!dynamicOpts) return staticOpts;

          const combined = [...dynamicOpts];

          // Ensure selected values are present (so they can be unchecked)
          selectedValues.forEach(val => {
            if (!combined.find(c => c.value === val)) {
              combined.push({ value: val, count: 0 });
            }
          });

          return combined.map((d: any) => {
            const staticMatch = staticOpts.find(s => s.value === d.value);
            return {
              label: staticMatch ? staticMatch.label : d.value,
              value: d.value,
              count: d.count
            };
          });
        };

        setCategoryOptions(mergeOptions(CATEGORY_OPTIONS, category, filters.category));
        setIndustryOptions(mergeOptions(INDUSTRY_OPTIONS, industry, filters.industry));
        setJobTypeOptions(mergeOptions(JOB_TYPE_OPTIONS, jobType, filters.jobType));

        if (location) {
          setLocationOptions(location.map((l: any) => ({ label: l.value, value: l.value, count: l.count })));
        }

        if (timezone) {
          setTimezoneOptions(timezone.map((t: any) => ({ label: t.value, value: t.value, count: t.count })));
        }
      }

      console.log(`✅ 获取到 ${data.jobs?.length || 0} 个岗位（第${page}页，后端筛选和排序）`)
    } catch (error) {
      // P0 Fix: Ignore AbortError (request was intentionally canceled)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[JobsPage] 请求已取消，开始新的搜索')
        return
      }
      setLoadingStage('idle')
      console.error('❌ 加载岗位数据失败:', error)
      showError('加载岗位数据失败，请稍后重试')
    } finally {
      // P0 Fix: Only update loading state if request wasn't aborted (prevent race condition with new requests)
      if (!signal.aborted) {
        if (loadMore) {
          setLoadingMore(false)
        } else {
          setJobsLoading(false)
        }
      }
    }
  }, [token, isAuthenticated, showError, pageSize, filters, searchTerm, sortBy, location.search])

  // 加载更多数据
  const loadMoreJobs = async () => {
    if (loadingMore || jobsLoading) return

    const nextPage = currentPage + 1
    const hasMore = jobs.length < totalJobs

    if (hasMore) {
      await loadJobsWithFilters(nextPage, true)
    }
  }

  // P0 Fix: Use debouncedSearchTerm instead of searchTerm to reduce API calls
  useEffect(() => {
    loadJobsWithFilters(1, false)

    // Track search or filter change
    if (debouncedSearchTerm) {
      trackingService.track('search_job', { keyword: debouncedSearchTerm })
    }

    // Track filter usage (if any filter is active)
    const activeFilters = Object.entries(filters).filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'boolean') return value
      return false
    })

    if (activeFilters.length > 0) {
      trackingService.track('filter_job', {
        filters: activeFilters.map(f => f[0]),
        filter_count: activeFilters.length
      })
    }
    // 注意: loadJobsWithFilters 故意不包含在依赖中，因为其内部使用的值已在依赖数组中
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, filters, isAuthenticated, token, sortBy])

  // 滚动监听 - 自动加载更多
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || jobsLoading) return

      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      // 当滚动到页面底部100px以内时触发加载更多
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        const hasMore = jobs.length < totalJobs
        if (hasMore) {
          loadMoreJobs()
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore, jobsLoading, jobs.length, totalJobs])

  // 后端API已经处理了去重和区域合并，直接使用返回的数据
  const canonicalJobs = useMemo(() => {
    return jobs
  }, [jobs])

  // 从URL参数中获取初始搜索词
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const search = params.get('search')
    if (search) {
      setSearchTerm(search)
    }
  }, [location.search])

  const toggleSaveJob = async (jobId: string, job?: Job) => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('haigoo_auth_token') || '' : '')
    if (!isAuthenticated || !authToken) { showWarning('请先登录', '登录后可以收藏职位'); navigate('/login'); return }
    const isSaved = savedJobs.has(jobId)
    setSavedJobs(prev => { const s = new Set(prev); isSaved ? s.delete(jobId) : s.add(jobId); return s })
    try {
      const resp = await fetch(`/api/user-profile?action=${isSaved ? 'favorites_remove' : 'favorites_add'}&jobId=${encodeURIComponent(jobId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ jobId, job })
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        if (resp.status === 403 && data.upgradeRequired) {
          if (window.confirm('普通用户最多收藏5个职位，升级会员解锁无限收藏。\n\n是否前往升级？')) {
            navigate('/membership')
          }
          throw new Error('Upgrade required') // Throw to trigger rollback
        }
        throw new Error('收藏接口失败')
      }

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
  useEffect(() => {
    const loadCompanies = async () => {
      const ids = Array.from(new Set(canonicalJobs.map(j => j.companyId).filter(Boolean))) as string[]
      if (ids.length === 0) { return }
      await Promise.all(ids.map(id => trustedCompaniesService.getCompanyById(id)))
      // const map: Record<string, TrustedCompany> = {}
      // ids.forEach((id, i) => { const c = results[i]; if (c) map[id] = c })
      // setCompanyMap(map)
    }
    loadCompanies()
  }, [canonicalJobs])

  // Combined loading state logic
  const showLoading = jobsLoading

  // Derived Data for Dynamic Filters - now using backend aggregations
  // Frontend calculations removed to support global facets

  // 筛选逻辑已经移到后端，直接使用后端返回的排序结果
  const filteredJobs = useMemo(() => {
    return jobs
  }, [jobs])

  // P1 Fix: Remove duplicate frontend scattering - backend already handles this via scatterJobs()
  // Simply alias filteredJobs as distributedJobs for backward compatibility
  const distributedJobs = filteredJobs

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
      // If no jobId, handle default selection logic
      if (distributedJobs.length > 0 && window.innerWidth >= 1024) {
        // In desktop split view, always show the first job if none is selected
        // This avoids the empty state as requested
        if (!selectedJob) {
          const firstJob = distributedJobs[0]
          setSelectedJob(firstJob)
          setCurrentJobIndex(0)
          setShowInlineDetail(true)
          // Optionally update URL to reflect this default selection?
          // For now, keep URL clean until user interaction
        }
      } else {
        // Mobile or empty list - show list view
        setShowInlineDetail(false)
        setIsJobDetailOpen(false)
        setSelectedJob(null)
      }
    }
  }, [distributedJobs, location.search, selectedJob])

  const handleJobSelect = (job: Job, index: number) => {
    setSelectedJob(job)
    setCurrentJobIndex(index)

    // Update URL
    const params = new URLSearchParams(location.search)
    params.set('jobId', job.id)
    // Fix: Ensure search term is synced
    if (searchTermRef.current) {
      params.set('search', searchTermRef.current)
    } else {
      params.delete('search')
    }
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
  // Suppress unused variable warning for now as it might be used in mobile view later
  void handleBackToList;


  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({
      category: [],
      experienceLevel: [],
      industry: [],
      regionType: [], // Default to all regions
      sourceType: [],
      type: [],
      location: [],
      jobType: [],
      salary: [],
      timezone: [],
      isTrusted: false,
      isNew: false
    });
  }

  return (
    <MobileRestricted allowContinue={true}>
      <div
        className="h-full bg-slate-50 flex flex-col"
        role="main"
        aria-label="职位搜索页面"
      >
        {/* Hero / Header Section - Compact Version for Split View */}
        {/* Only show on mobile or if needed. For split view, maybe we don't need a huge hero? 
          User said "visual aesthetic harmony". I'll keep a smaller header or just the layout.
          Actually, let's keep the hero but maybe make it less intrusive or part of the page flow.
          For a "JobRight" app-like feel, the hero is usually gone or very small.
          I will keep it but maybe outside the flex container so it scrolls away? 
          No, if I want independent scrolling for list/detail, the main container must be fixed height.
          So the Hero should probably be removed or placed in the list column?
          I'll place a small header in the list column or just remove the big hero to maximize space.
          Let's keep a minimal header.
      */}

        <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 gap-6 h-full pt-0 mt-0">

          {/* Top Section: Search & Filters */}
          <div className="flex-shrink-0 z-50 relative pt-1">
            <JobFilterBar
              filters={filters}
              onFilterChange={(newFilters: any) => {
                console.log('[JobsPage] onFilterChange triggered:', newFilters);
                setFilters((prev: any) => {
                  const updated = { ...prev, ...newFilters };
                  console.log('[JobsPage] New filters state:', updated);
                  return updated;
                });
              }}
              categoryOptions={categoryOptions}
              industryOptions={industryOptions}
              jobTypeOptions={jobTypeOptions}
              locationOptions={locationOptions}
              timezoneOptions={timezoneOptions}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortBy={sortBy}
              onSortChange={() => setSortBy(prev => prev === 'recent' ? 'relevance' : 'recent')}
              onOpenTracking={openCommunityPage}
            />
          </div>

          {/* Main Content Area: Split View */}
          <div className="flex-1 flex overflow-hidden gap-6 min-h-0 mt-0">
            {/* Middle Column: Job List */}
            <div className={`flex flex-col w-full ${selectedJob ? 'lg:w-[55%] xl:w-[55%]' : 'lg:w-[800px] mx-auto'} bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden flex-shrink-0`}>
              {/* List Header Info */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500 font-medium">
                <span>共找到 {totalJobs || distributedJobs.length} 个相关职位</span>
                {filters.isTrusted && (
                  <span className="flex items-center gap-1 text-indigo-600">
                    <Zap className="w-3 h-3 fill-indigo-600" />
                    已过滤精选企业
                  </span>
                )}
              </div>

              {/* List Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white overscroll-y-contain">
                {showLoading ? (
                  <div className="p-0">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="border-b border-slate-50 last:border-0">
                        {/* Wrapper to match JobCardNew list variant spacing if needed, 
                             JobCardSkeleton has its own border/padding. 
                             JobCardNew usually has border-b in list view or similar.
                             Let's just render the skeleton. 
                         */}
                        <div className="p-4">
                          <JobCardSkeleton />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : distributedJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    {filters.aiRecommended ? (
                      <>
                        <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
                          <Sparkles className="w-6 h-6 text-indigo-400" />
                        </div>
                        <p className="text-slate-900 font-medium mb-1">当前条件下暂未发现 AI 强推荐的职位</p>
                        <p className="text-slate-500 text-xs mb-4 max-w-[240px]">为了保证内推质量，AI 只会推荐与你高度匹配的优质机会。建议稍微放宽筛选条件，或稍后再来。</p>
                        <button onClick={() => setFilters((prev: any) => ({ ...prev, aiRecommended: false }))} className="text-indigo-600 text-sm font-medium hover:underline mb-8 bg-indigo-50 px-4 py-2 rounded-lg">返回普通列表</button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-slate-900 font-medium mb-1">未找到相关职位</p>
                        <button onClick={clearAllFilters} className="text-indigo-600 text-sm hover:underline mb-8">清除筛选</button>
                      </>
                    )}

                    {/* Community Promo for Empty State */}
                    <div className="w-full max-w-sm bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100 flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-slate-900 text-sm">去群里看每日精选岗位</span>
                      </div>
                      <p className="text-xs text-slate-500 text-center">企业微信群会集中同步精选岗位，也方便和其他求职者交流投递与面试经验。</p>
                      <button
                        onClick={openCommunityPage}
                        className="px-6 py-2 bg-white text-indigo-600 text-xs font-bold rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-colors w-full tracking-wide"
                      >
                        立即加入微信群
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {activeBundle && !loadingMore && currentPage === 1 && (
                      <div className="mb-4">
                        <JobBundleBanner bundle={activeBundle} />
                      </div>
                    )}

                    {distributedJobs.map((job, index) => (
                      <JobCardNew
                        key={job.id}
                        job={job}
                        variant="list"
                        isActive={selectedJob?.id === job.id}
                        onClick={() => handleJobSelect(job, index)}
                        matchScore={job.matchScore}
                      />
                    ))}

                    {/* Low Result Count Promo */}
                    {distributedJobs.length < 5 && (
                      <div className="mx-4 my-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-600 flex-shrink-0">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="text-center sm:text-left">
                            <h3 className="font-bold text-slate-900 text-sm">没找到心仪的职位？</h3>
                            <p className="text-xs text-slate-500 mt-0.5">去企业微信群看每日精选岗位，也可以和大家交流最新远程机会</p>
                          </div>
                        </div>
                        <button
                          onClick={openCommunityPage}
                          className="px-4 py-2 bg-white text-indigo-600 text-xs font-bold rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap"
                        >
                          加入微信群
                        </button>
                      </div>
                    )}

                    {/* Load More Trigger */}
                    <div className="p-4 text-center border-t border-slate-50">
                      {loadingMore ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          加载中...
                        </div>
                      ) : jobs.length < totalJobs ? (
                        <button onClick={loadMoreJobs} className="text-xs text-indigo-600 hover:underline font-medium">
                          加载更多
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">已加载全部</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Detail Panel (Desktop Only) */}
            <div className="hidden lg:flex flex-1 bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden h-full flex-col relative">
              {selectedJob ? (
                <div className="h-full overflow-y-auto custom-scrollbar overscroll-y-contain">
                  <JobDetailPanel
                    job={selectedJob}
                    onSave={(id) => selectedJob && toggleSaveJob(id, selectedJob)}
                    isSaved={savedJobs.has(selectedJob.id)}
                    onApply={() => { /* apply logic */ }}
                    showCloseButton={false}
                    onNavigateJob={(direction) => {
                      const nextIndex = direction === 'prev' ? Math.max(0, currentJobIndex - 1) : Math.min(distributedJobs.length - 1, currentJobIndex + 1)
                      handleJobSelect(distributedJobs[nextIndex], nextIndex)
                    }}
                    canNavigatePrev={currentJobIndex > 0}
                    canNavigateNext={currentJobIndex < distributedJobs.length - 1}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/30">
                  <div className="w-20 h-20 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                    <Briefcase className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-medium text-slate-500">选择一个职位查看详情</p>
                  <p className="text-sm text-slate-400 mt-2">点击左侧列表中的职位卡片</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Job Detail Modal (Mobile Only) */}
        {isJobDetailOpen && selectedJob && (
          <JobDetailModal
            job={selectedJob}
            isOpen={isJobDetailOpen}
            onClose={() => { setIsJobDetailOpen(false); }}
            onSave={() => selectedJob && toggleSaveJob(selectedJob.id, selectedJob)}
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
    </MobileRestricted>
  )
}
