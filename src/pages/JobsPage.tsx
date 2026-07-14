import { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Sparkles, Briefcase, Zap, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import JobCardNew from '../components/JobCardNew'
import { JobBundleCard } from '../components/JobBundleBanner'
import JobFilterBar from '../components/JobFilterBar'
import { Job } from '../types'

import { useNotificationHelpers } from '../components/NotificationSystem'
import { trackingService } from '../services/tracking-service'
import { useDebounce } from '../hooks/useDebounce'
import { readMatchScoreRefreshMarker } from '../utils/match-score-refresh'
import { rememberLatestJobSearch } from '../utils/member-recommendations'
import { buildSearchTermTrackingProperties } from '../utils/search-term-insights'
import { JOB_CATEGORY_OPTIONS } from '../../lib/shared/job-categories.js'

const JobDetailModal = lazy(() => import('../components/JobDetailModal'))
const JobDetailPanel = lazy(() => import('../components/JobDetailPanel').then((module) => ({ default: module.JobDetailPanel })))

// Job Type Options - Standardized
const JOB_TYPE_OPTIONS = [
  { label: '全职', value: 'full-time' },
  { label: '兼职', value: 'part-time' },
  { label: '合同', value: 'contract' },
  { label: '自由职业', value: 'freelance' },
  { label: '实习', value: 'internship' }
];

const EXPERIENCE_OPTIONS = [
  { label: '初级', value: 'Entry' },
  { label: '中级', value: 'Mid' },
  { label: '高级', value: 'Senior' },
  { label: '专家/负责人', value: 'Lead' },
  { label: '管理层', value: 'Executive' }
];

// Top Categories (Based on classification-service.js JOB_KEYWORDS)
const CATEGORY_OPTIONS = JOB_CATEGORY_OPTIONS.map((v: string) => ({ label: v, value: v }));
const CATEGORY_LABELS = new Map(CATEGORY_OPTIONS.map(option => [option.value, option.label]));
const JOB_TYPE_LABELS = new Map(JOB_TYPE_OPTIONS.map(option => [option.value, option.label]));
const EXPERIENCE_LABELS = new Map(EXPERIENCE_OPTIONS.map(option => [option.value, option.label]));

// Location Options
// const LOCATION_OPTIONS = [
//   { label: '远程', value: 'Remote' },
//   { label: '全球', value: 'Worldwide' }
// ];

import { MobileRestricted } from '../components/MobileRestricted'

import { JobCardSkeleton } from '../components/skeletons/JobCardSkeleton'

const JOBS_PAGE_DECOR = {
  sun: '/pic_lists/Jobs_pics/sun-transparent.webp',
  grass: '/pic_lists/Home_pics/grass_icon-transparent.webp',
  grass2: '/pic_lists/Home_pics/grass_icon2-transparent.webp',
  love: '/pic_lists/Home_pics/love-transparent.webp',
  tips: '/pic_lists/Home_pics/tips-transparent.webp',
  beach: '/pic_lists/Jobs_pics/background01.webp'
}

const JOBS_REQUEST_CACHE_TTL_MS = 10 * 1000
const GUEST_JOB_PREVIEW_LIMIT = 20
const GUEST_MORE_PROMPT_COOLDOWN_MS = 3000
const jobsRequestCache = new Map<string, { expiresAt: number; promise: Promise<any> }>()

function fetchJobsJsonWithDedupe(url: string, init?: RequestInit, trackingContext?: Record<string, unknown>) {
  const now = Date.now()
  const headers = new Headers(init?.headers || {})
  const { signal: _signal, ...safeInit } = init || {}
  const request = () => trackingContext
    ? trackingService.trackedFetch(url, safeInit, trackingContext)
    : fetch(url, safeInit)
  if (headers.get('Authorization')) {
    return request().then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
  }

  const cacheKey = `${init?.method || 'GET'}:public:${url}`
  const cached = jobsRequestCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  const promise = request().then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }).catch((error) => {
    const latest = jobsRequestCache.get(cacheKey)
    if (latest?.promise === promise) {
      jobsRequestCache.delete(cacheKey)
    }
    throw error
  }).finally(() => {
    window.setTimeout(() => {
      const latest = jobsRequestCache.get(cacheKey)
      if (latest?.promise === promise && latest.expiresAt <= Date.now()) {
        jobsRequestCache.delete(cacheKey)
      }
    }, JOBS_REQUEST_CACHE_TTL_MS)
  })

  jobsRequestCache.set(cacheKey, {
    expiresAt: now + JOBS_REQUEST_CACHE_TTL_MS,
    promise
  })

  return promise
}

interface JobBundle {
  id: number
  title: string
  subtitle: string
  job_ids: string[]
  visibility?: string
  priority?: number
  is_public?: boolean
}

const DEFAULT_JOB_FILTERS = {
  category: [] as string[],
  experienceLevel: [] as string[],
  industry: [] as string[],
  regionType: [] as string[],
  sourceType: [] as string[],
  location: [] as string[],
  timezone: [] as string[],
  type: [] as string[],
  jobType: [] as string[],
  salary: [] as string[],
  isTrusted: false,
  isNew: false,
  memberOnly: false,
  aiRecommended: false
}

type JobFiltersState = typeof DEFAULT_JOB_FILTERS

const JOB_FILTER_URL_KEYS = [
  'search',
  'searchQuery',
  'category',
  'experienceLevel',
  'industry',
  'regionType',
  'region',
  'sourceType',
  'location',
  'type',
  'jobType',
  'salary',
  'memberOnly',
  'isTrusted',
  'isNew',
  'source',
  'jobId'
]

const FILTER_ARRAY_URL_KEYS: Array<keyof Pick<JobFiltersState, 'category' | 'experienceLevel' | 'industry' | 'regionType' | 'sourceType' | 'location' | 'type' | 'jobType' | 'salary'>> = [
  'category',
  'experienceLevel',
  'industry',
  'regionType',
  'sourceType',
  'location',
  'type',
  'jobType',
  'salary'
]

function normalizeJobFilters(value: unknown): JobFiltersState {
  if (!value || typeof value !== 'object') return DEFAULT_JOB_FILTERS
  const raw = value as Record<string, unknown>
  const next = { ...DEFAULT_JOB_FILTERS } as Record<string, unknown>

  const arrayKeys = [
    'category',
    'experienceLevel',
    'industry',
    'regionType',
    'sourceType',
    'location',
    'timezone',
    'type',
    'jobType',
    'salary'
  ]
  arrayKeys.forEach((key) => {
    const current = raw[key]
    next[key] = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  })

  next.isTrusted = raw.isTrusted === true
  next.isNew = raw.isNew === true
  next.memberOnly = raw.memberOnly === true
  // Deprecated personalized recommendation filter must not survive refresh.
  next.aiRecommended = false

  return next as JobFiltersState
}

function readCsvParam(params: URLSearchParams, key: string) {
  const value = params.get(key)
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function buildJobsSearchParams(currentSearch: string, filters: JobFiltersState, searchTerm: string) {
  const params = new URLSearchParams(currentSearch)
  JOB_FILTER_URL_KEYS.forEach(key => params.delete(key))

  const trimmedSearch = searchTerm.trim()
  if (trimmedSearch) params.set('search', trimmedSearch)

  if (trimmedSearch) return params

  appendJobFilterParams(params, filters, true)

  return params
}

function appendJobFilterParams(
  params: URLSearchParams,
  filters: JobFiltersState,
  isAuthenticated: boolean,
  includeFilters = true
) {
  if (!includeFilters) return

  if (isAuthenticated && filters.category?.length > 0) params.append('category', filters.category.join(','))
  if (filters.experienceLevel?.length > 0) params.append('experienceLevel', filters.experienceLevel.join(','))
  if (filters.location?.length > 0) params.append('location', filters.location.join(','))
  if (filters.industry?.length > 0) params.append('industry', filters.industry.join(','))
  if (filters.regionType?.length > 0) params.append('regionType', filters.regionType.join(','))
  if (filters.sourceType?.length > 0) params.append('sourceType', filters.sourceType.join(','))
  if (filters.type?.length > 0) params.append('type', filters.type.join(','))
  if (filters.jobType?.length > 0) params.append('jobType', filters.jobType.join(','))
  if (filters.salary?.length > 0) params.append('salary', filters.salary.join(','))
  if (filters.isTrusted) params.append('isTrusted', 'true')
  if (filters.isNew) params.append('isNew', 'true')
  if (filters.memberOnly) params.append('memberOnly', 'true')
}

function normalizeFacetKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function buildFacetOptions(dynamicOpts?: any[], labelMap?: Map<string, string>) {
  if (!Array.isArray(dynamicOpts)) return []

  const result = new Map<string, { label: string; value: string; count?: number }>()
  dynamicOpts.forEach((item: any) => {
    const value = String(item?.value || '').trim()
    if (!value || value === 'Unspecified') return

    const count = Number(item?.count || 0)
    if (!Number.isFinite(count) || count <= 0) return

    const key = normalizeFacetKey(value)
    const label = labelMap?.get(value) || String(item?.label || value).trim() || value
    const existing = result.get(key)
    if (existing) {
      existing.count = (existing.count || 0) + count
      return
    }

    result.set(key, { label, value, count })
  })

  return Array.from(result.values())
}

function hasUsableAggregations(aggregations: any) {
  if (!aggregations || typeof aggregations !== 'object') return false
  return ['category', 'industry', 'jobType', 'experienceLevel', 'location', 'timezone'].some((key) => Array.isArray(aggregations[key]))
}

function getMeaningfulMatchScore(job: Job) {
  return Number(job.trueMatchScore ?? job.displayMatchScore ?? job.matchScore ?? 0) || 0
}

function hasActiveJobIntent(searchTerm: string, filters: JobFiltersState) {
  if (searchTerm.trim()) return true
  return Object.entries(filters).some(([, value]) => {
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'boolean') return value
    return false
  })
}

function readJobHabitBoostParams() {
  if (typeof window === 'undefined') return null

  try {
    const savedFilters = JSON.parse(window.localStorage.getItem('haigoo_last_job_filter_context') || '{}') as Partial<JobFiltersState>
    const heroCache = JSON.parse(window.localStorage.getItem('copilot_guest_cache') || '{}') as { jobDirection?: string; positionType?: string }
    const lastSearch = String(
      window.localStorage.getItem('haigoo_last_non_empty_job_search') ||
      window.localStorage.getItem('haigoo_last_job_search') ||
      ''
    ).trim()
    const heroJobDirection = String(heroCache.jobDirection || '').trim()
    const heroPositionType = String(heroCache.positionType || '').trim()
    const boostParams: Record<string, string> = {}

    if (lastSearch || heroJobDirection) boostParams.boostSearch = lastSearch || heroJobDirection
    if (heroPositionType) boostParams.copilotGoal = heroPositionType
    if (Array.isArray(savedFilters.category) && savedFilters.category.length > 0) boostParams.boostCategory = savedFilters.category.join(',')
    if (Array.isArray(savedFilters.industry) && savedFilters.industry.length > 0) boostParams.boostIndustry = savedFilters.industry.join(',')
    if (Array.isArray(savedFilters.jobType) && savedFilters.jobType.length > 0) boostParams.boostJobType = savedFilters.jobType.join(',')
    if (Array.isArray(savedFilters.location) && savedFilters.location.length > 0) boostParams.boostLocation = savedFilters.location.join(',')

    return Object.keys(boostParams).length > 0 ? boostParams : null
  } catch {
    return null
  }
}

export default function JobsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user, isAuthenticated, isMember } = useAuth()
  const isEmailVerificationRequired = Boolean(isAuthenticated && user && !user.emailVerified)
  const hasVerifiedJobAccess = Boolean(isAuthenticated && user?.emailVerified)

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
  const metadataAbortControllerRef = useRef<AbortController | null>(null)
  const lastJobsLoadedAtRef = useRef(0)
  const hasRenderedJobsRef = useRef(false)
  const jobsRequestSeqRef = useRef(0)
  const hasManualJobSelectionRef = useRef(false)
  const guestMorePromptedAtRef = useRef(0)

  useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])


  // New Filter State Structure
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('haigoo_job_filters')
      if (saved) {
        const parsed = JSON.parse(saved)
        return normalizeJobFilters(parsed)
      }
    } catch (e) {
      console.error('Failed to load filters', e)
    }
    return DEFAULT_JOB_FILTERS
  })

  // Dynamic Filter Options State
  const [categoryOptions, setCategoryOptions] = useState<{ label: string, value: string, count?: number }[]>([]);
  const [industryOptions, setIndustryOptions] = useState<{ label: string, value: string, count?: number }[]>([]);
  const [jobTypeOptions, setJobTypeOptions] = useState<{ label: string, value: string, count?: number }[]>([]);
  const [experienceLevelOptions, setExperienceLevelOptions] = useState<{ label: string, value: string, count?: number }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string, value: string, count?: number }[]>([]);
  const [timezoneOptions, setTimezoneOptions] = useState<{ label: string, value: string, count?: number }[]>([]);

  useEffect(() => {
    localStorage.setItem('haigoo_job_filters', JSON.stringify(filters))
    if (hasActiveJobIntent('', filters)) {
      localStorage.setItem('haigoo_last_job_filter_context', JSON.stringify(filters))
    }
  }, [filters])

  useEffect(() => {
    if (!isAuthenticated && filters.memberOnly) {
      setFilters(prev => normalizeJobFilters({ ...prev, memberOnly: false }))
    }
  }, [filters.memberOnly, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated && filters.category.length > 0) {
      setFilters(prev => normalizeJobFilters({ ...prev, category: [] }))
    }
  }, [filters.category.length, isAuthenticated])

  useEffect(() => {
    if (industryOptions.length === 0 || filters.industry.length === 0) return

    const validIndustries = new Set(industryOptions.map(option => option.value))
    const nextIndustryFilters = filters.industry.filter(value => validIndustries.has(value))
    if (nextIndustryFilters.length !== filters.industry.length) {
      setFilters(prev => normalizeJobFilters({ ...prev, industry: nextIndustryFilters }))
    }
  }, [filters.industry, industryOptions])

  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [showInlineDetail, setShowInlineDetail] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)

  // 岗位数据状态（替代页面缓存）
  const [jobs, setJobs] = useState<Job[]>([])
  // P0 Fix: Initialize loading to true to prevent "No jobs found" flash
  const [jobsLoading, setJobsLoading] = useState(true)
  const [initialJobsSettled, setInitialJobsSettled] = useState(false)
  const [jobsLoadError, setJobsLoadError] = useState<string | null>(null)
  const [jobsRefreshing, setJobsRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalJobs, setTotalJobs] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const effectivePageSize = hasVerifiedJobAccess ? pageSize : GUEST_JOB_PREVIEW_LIMIT
  const [sortBy, setSortBy] = useState<'relevance' | 'recent'>('relevance')
  const [listMode, setListMode] = useState<'jobs' | 'favorites' | 'applications'>('jobs')
  const [favoriteJobs, setFavoriteJobs] = useState<Job[]>([])
  const [applicationJobs, setApplicationJobs] = useState<Job[]>([])
  const [applicationCount, setApplicationCount] = useState(0)
  const [personalListLoading, setPersonalListLoading] = useState(false)
  const [activeBundles, setActiveBundles] = useState<JobBundle[]>([]);

  useEffect(() => {
    // Fetch active bundles
    const fetchActiveBundles = async () => {
      try {
        const data = await fetchJobsJsonWithDedupe('/api/data/job-bundles?is_active=true');
        if (data.success && data.data && data.data.length > 0) {
          // Time filtering is now handled by the backend API.
          // Only filter by visibility based on current user state.
          const validBundles = data.data.filter((b: JobBundle) => {
            const vis = b.visibility || (b.is_public !== false ? 'public' : 'admin');
            if (vis === 'admin') return false; // Admin hidden on C-side
            // members-only bundles are deliberately kept here to serve as marketing hooks for unauthorized users
            return true;
          });

          if (validBundles.length > 0) {
            // Sort by priority (asc) and render all active bundles
            const nextBundles = [...validBundles]
            nextBundles.sort((a: JobBundle, b: JobBundle) => {
              const priorityDiff = (a.priority || 10) - (b.priority || 10)
              if (priorityDiff !== 0) return priorityDiff
              return a.id - b.id
            });
            setActiveBundles(nextBundles);
          } else {
            setActiveBundles([]);
          }
        } else {
          setActiveBundles([]);
        }
      } catch (e) {
        console.error('Failed to fetch active bundles', e);
        setActiveBundles([]);
      }
    };
    fetchActiveBundles();
  }, [isAuthenticated]);

  const [showWechatModal, setShowWechatModal] = useState(false)

  const openCommunityPage = useCallback(() => {
    setShowWechatModal(true)
  }, [])

  // 加载阶段状态
  const [, setLoadingStage] = useState<'idle' | 'fetching' | 'translating'>('idle')
  const { showSuccess, showError, showWarning } = useNotificationHelpers()

  const showPreviewLimitPrompt = useCallback(() => {
    const now = Date.now()
    if (now - guestMorePromptedAtRef.current < GUEST_MORE_PROMPT_COOLDOWN_MS) return
    guestMorePromptedAtRef.current = now
    if (isEmailVerificationRequired) {
      showWarning('验证邮箱后可查看更多', '完成邮箱验证后即可继续加载更多远程岗位。')
      return
    }
    showWarning('完整列表登录后可见', '登录后可以继续加载更多远程岗位。')
  }, [isEmailVerificationRequired, showWarning])

  const syncJobListUrl = useCallback((nextFilters: JobFiltersState, nextSearchTerm: string) => {
    const params = buildJobsSearchParams(location.search, nextFilters, nextSearchTerm)
    const nextSearch = params.toString()
    const normalizedCurrent = location.search.startsWith('?') ? location.search.slice(1) : location.search
    if (nextSearch !== normalizedCurrent) {
      navigate({ search: nextSearch }, { replace: true })
    }
  }, [location.search, navigate])

  // 加载岗位数据（使用新的后端API，支持筛选和分页）
  const loadJobsWithFilters = useCallback(async (page = 1, loadMore = false) => {
    if ((!isAuthenticated || isEmailVerificationRequired) && loadMore) {
      showPreviewLimitPrompt()
      return
    }

    const requestSeq = ++jobsRequestSeqRef.current
    // P0 Fix: Cancel any pending request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    const isLatestRequest = () => requestSeq === jobsRequestSeqRef.current && !signal.aborted

    try {
      if (loadMore) {
        setLoadingMore(true)
      } else {
        const canKeepCurrentList = hasRenderedJobsRef.current
        setJobsLoading(!canKeepCurrentList)
        setJobsRefreshing(canKeepCurrentList)
        setInitialJobsSettled(false)
        setJobsLoadError(null)
        setLoadingStage('fetching')
      }

      // 构建查询参数
      const queryParams = new URLSearchParams()

      const requestSearchTerm = searchTerm
      const requestFilters = filters
      const hasCurrentJobIntent = hasActiveJobIntent(requestSearchTerm, requestFilters)
      const habitBoost = sortBy === 'relevance' ? readJobHabitBoostParams() : null
      const hasResumeRefreshIntent = Boolean(readMatchScoreRefreshMarker())
      const shouldUseMatchScore = Boolean(hasVerifiedJobAccess && token && (hasCurrentJobIntent || habitBoost || hasResumeRefreshIntent));
      if (shouldUseMatchScore) {
        queryParams.append('action', 'jobs_with_match_score')
      }

      queryParams.append('page', page.toString())
      queryParams.append('pageSize', effectivePageSize.toString())
      queryParams.append('limit', effectivePageSize.toString())
      queryParams.append('skipAggregations', 'true')
      queryParams.append('listMode', 'compact')

      // Explicitly handle sortBy
      if (sortBy === 'recent') {
        queryParams.append('sortBy', 'recent')
      } else {
        // Explicitly send relevance to ensure backend knows the intent
        queryParams.append('sortBy', 'relevance')
      }

      if (import.meta.env.DEV) {
        console.debug('[loadJobsWithFilters] Current filters state:', filters)
      }

      const hasKeywordSearch = Boolean(requestSearchTerm.trim())
      if (hasKeywordSearch) queryParams.append('search', requestSearchTerm.trim())
      appendJobFilterParams(queryParams, requestFilters, hasVerifiedJobAccess, !hasKeywordSearch)
      if (sortBy === 'relevance' && !hasCurrentJobIntent) {
        if (habitBoost) {
          Object.entries(habitBoost).forEach(([key, value]) => queryParams.append(key, value))
        }
      }
      // ⚠️ P0 Fix: Always enforce approval check for C-side job list
      queryParams.append('isApproved', 'true')

      if (import.meta.env.DEV) {
        console.debug('[loadJobsWithFilters] Request params:', queryParams.toString())
      }

      const requestUrl = `/api/data/processed-jobs?${queryParams.toString()}`
      if (import.meta.env.DEV) {
        console.debug('[loadJobsWithFilters] Fetching:', requestUrl)
      }

      const data = await fetchJobsJsonWithDedupe(requestUrl, {
        headers: token && hasVerifiedJobAccess ? { Authorization: `Bearer ${token}` } : {},
        signal
      }, {
        feature_key: 'job_search',
        source_key: 'jobs_list',
        event_context: loadMore ? 'load_more' : 'search_results',
      })

      if (!isLatestRequest()) return

      if (import.meta.env.DEV) {
        console.debug('[loadJobsWithFilters] Response Data:', {
          total: data.total,
          jobsCount: data.jobs?.length,
          hasAggregations: !!data.aggregations,
          aggregations: data.aggregations
        })
      }

      // 设置岗位数据和分页信息
      if (loadMore) {
        // 加载更多时，追加数据
        setJobs(prevJobs => [...prevJobs, ...(data.jobs || [])])
      } else {
        // 首次加载或筛选条件变化时，替换数据
        const newJobs = data.jobs || []
        const searchTermProperties = buildSearchTermTrackingProperties(requestSearchTerm, 'jobs_page')
        setJobs(newJobs)
        trackingService.track(newJobs.length > 0 ? 'search_result_rendered' : 'search_empty', {
          event_family: 'search',
          outcome: 'succeeded',
          feature_key: 'job_search',
          source_key: 'jobs_list',
          ...searchTermProperties,
          result_count: Number(data.total ?? newJobs.length ?? 0),
          is_empty_result: newJobs.length === 0,
        })
        hasRenderedJobsRef.current = newJobs.length > 0
        setInitialJobsSettled(true)

        if (hasVerifiedJobAccess && token && newJobs.length > 0) {
          const matchParams = new URLSearchParams(queryParams)
          matchParams.set('action', 'jobs_with_match_score')
          matchParams.set('deferMatchRecompute', 'true')
          matchParams.set('skipAggregations', 'true')
          const matchRequestSeq = requestSeq
          void fetchJobsJsonWithDedupe(`/api/data/processed-jobs?${matchParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then((matchData) => {
            if (matchRequestSeq !== jobsRequestSeqRef.current) return
            const matchedJobs = Array.isArray(matchData?.jobs) ? matchData.jobs : []
            const meaningfulScoreCount = matchedJobs.filter((job: Job) => getMeaningfulMatchScore(job) > 0).length
            if (meaningfulScoreCount === 0) return

            setJobs((currentJobs) => {
              if (matchRequestSeq !== jobsRequestSeqRef.current || currentJobs.length === 0) return currentJobs
              if (hasManualJobSelectionRef.current) return currentJobs
              return matchedJobs.length > 0 ? matchedJobs : currentJobs
            })
          }).catch((matchError) => {
            if (import.meta.env.DEV) {
              console.debug('[JobsPage] Cached match score hydration skipped:', matchError)
            }
          })
        }

        if (newJobs.length > 0 && window.innerWidth >= 1024) {
          setSelectedJob((prev: Job | null) => {
            if (prev === null) {
              hasManualJobSelectionRef.current = false
              setCurrentJobIndex(0)
              setShowInlineDetail(true)
              return newJobs[0]
            }
            const stillExists = newJobs.find((j: Job) => j.id === prev.id)
            if (stillExists) {
              const newIndex = newJobs.findIndex((j: Job) => j.id === prev.id)
              setCurrentJobIndex(newIndex >= 0 ? newIndex : 0)
              setShowInlineDetail(true)
              return stillExists
            }
            setCurrentJobIndex(0)
            setShowInlineDetail(true)
            hasManualJobSelectionRef.current = false
            return newJobs[0]
          })
        } else {
          setSelectedJob(null)
        }
      }
      if (!loadMore && typeof data.total === 'number') {
        setTotalJobs(data.total)
      }
      setCurrentPage(page)
      setLoadingStage('idle')
      lastJobsLoadedAtRef.current = Date.now()

      // Update Dynamic Filter Options from Aggregations
      if (!loadMore && hasUsableAggregations(data.aggregations)) {
        const { category, industry, jobType, experienceLevel, location, timezone } = data.aggregations;

        if (filters.category.length === 0) {
          setCategoryOptions(buildFacetOptions(category, CATEGORY_LABELS));
        }
        setIndustryOptions(buildFacetOptions(industry));
        setJobTypeOptions(buildFacetOptions(jobType, JOB_TYPE_LABELS));
        setExperienceLevelOptions(buildFacetOptions(experienceLevel, EXPERIENCE_LABELS));

        if (location) {
          setLocationOptions(location.map((l: any) => ({ label: l.value, value: l.value, count: l.count })));
        }

        if (timezone) {
          setTimezoneOptions(timezone.map((t: any) => ({ label: t.value, value: t.value, count: t.count })));
        }
      }

      if (import.meta.env.DEV) {
        console.debug(`获取到 ${data.jobs?.length || 0} 个岗位（第${page}页，后端筛选和排序）`)
      }
    } catch (error) {
      if (!isLatestRequest()) return
      // P0 Fix: Ignore AbortError (request was intentionally canceled)
      if (error instanceof Error && error.name === 'AbortError') {
        if (import.meta.env.DEV) {
          console.debug('[JobsPage] 请求已取消，开始新的搜索')
        }
        return
      }
      setLoadingStage('idle')
      if (!loadMore) {
        setInitialJobsSettled(true)
        setJobsLoadError(error instanceof Error ? error.message : '职位列表接口异常')
      }
      console.error('❌ 加载岗位数据失败:', error)
      showError('加载岗位数据失败，请稍后重试')
    } finally {
      // P0 Fix: Only update loading state if request wasn't aborted (prevent race condition with new requests)
      if (isLatestRequest()) {
        if (loadMore) {
          setLoadingMore(false)
        } else {
          setJobsLoading(false)
          setJobsRefreshing(false)
        }
      }
    }
  }, [token, isAuthenticated, isEmailVerificationRequired, hasVerifiedJobAccess, showError, effectivePageSize, filters, searchTerm, sortBy, location.search, showPreviewLimitPrompt])

  const loadJobsMetadata = useCallback(async () => {
    if (metadataAbortControllerRef.current) {
      metadataAbortControllerRef.current.abort()
    }
    metadataAbortControllerRef.current = new AbortController()
    const signal = metadataAbortControllerRef.current.signal

    try {
      const queryParams = new URLSearchParams()
      const requestSearchTerm = searchTerm
      const requestFilters = filters
      queryParams.append('metadataOnly', 'true')
      queryParams.append('page', '1')
      queryParams.append('pageSize', effectivePageSize.toString())
      queryParams.append('limit', effectivePageSize.toString())
      queryParams.append('sortBy', sortBy === 'recent' ? 'recent' : 'relevance')
      queryParams.append('isApproved', 'true')

      const hasKeywordSearch = Boolean(requestSearchTerm.trim())
      if (hasKeywordSearch) queryParams.append('search', requestSearchTerm.trim())
      appendJobFilterParams(queryParams, requestFilters, hasVerifiedJobAccess, !hasKeywordSearch)

      const data = await fetchJobsJsonWithDedupe(`/api/data/processed-jobs?${queryParams.toString()}`, { signal })
      if (signal.aborted) return

      if (typeof data.total === 'number') {
        setTotalJobs(data.total)
      }

      if (hasUsableAggregations(data.aggregations)) {
        let { category, industry, jobType, experienceLevel, location, timezone } = data.aggregations;

        if (hasVerifiedJobAccess && requestFilters.category.length > 0) {
          const categoryFacetParams = new URLSearchParams(queryParams)
          categoryFacetParams.delete('category')
          try {
            const categoryFacetData = await fetchJobsJsonWithDedupe(`/api/data/processed-jobs?${categoryFacetParams.toString()}`, { signal })
            if (!signal.aborted && Array.isArray(categoryFacetData?.aggregations?.category)) {
              category = categoryFacetData.aggregations.category
            }
          } catch (categoryFacetError) {
            if (!(categoryFacetError instanceof Error && categoryFacetError.name === 'AbortError')) {
              console.warn('[JobsPage] Failed to load category facet counts:', categoryFacetError)
            }
          }
        }

        const loadFacetWithout = async (paramName: string, aggregationKey: string) => {
          const facetParams = new URLSearchParams(queryParams)
          facetParams.delete(paramName)
          if (paramName === 'jobType') facetParams.delete('type')
          const facetData = await fetchJobsJsonWithDedupe(`/api/data/processed-jobs?${facetParams.toString()}`, { signal })
          return !signal.aborted && Array.isArray(facetData?.aggregations?.[aggregationKey])
            ? facetData.aggregations[aggregationKey]
            : undefined
        }

        if (requestFilters.industry.length > 0) {
          try {
            industry = await loadFacetWithout('industry', 'industry') || industry
          } catch (industryFacetError) {
            if (!(industryFacetError instanceof Error && industryFacetError.name === 'AbortError')) {
              console.warn('[JobsPage] Failed to load industry facet counts:', industryFacetError)
            }
          }
        }

        if (requestFilters.jobType.length > 0) {
          try {
            jobType = await loadFacetWithout('jobType', 'jobType') || jobType
          } catch (jobTypeFacetError) {
            if (!(jobTypeFacetError instanceof Error && jobTypeFacetError.name === 'AbortError')) {
              console.warn('[JobsPage] Failed to load job type facet counts:', jobTypeFacetError)
            }
          }
        }

        if (requestFilters.experienceLevel.length > 0) {
          try {
            experienceLevel = await loadFacetWithout('experienceLevel', 'experienceLevel') || experienceLevel
          } catch (experienceFacetError) {
            if (!(experienceFacetError instanceof Error && experienceFacetError.name === 'AbortError')) {
              console.warn('[JobsPage] Failed to load experience facet counts:', experienceFacetError)
            }
          }
        }

        setCategoryOptions(buildFacetOptions(category, CATEGORY_LABELS));
        setIndustryOptions(buildFacetOptions(industry));
        setJobTypeOptions(buildFacetOptions(jobType, JOB_TYPE_LABELS));
        setExperienceLevelOptions(buildFacetOptions(experienceLevel, EXPERIENCE_LABELS));

        if (location) {
          setLocationOptions(location.map((l: any) => ({ label: l.value, value: l.value, count: l.count })));
        }

        if (timezone) {
          setTimezoneOptions(timezone.map((t: any) => ({ label: t.value, value: t.value, count: t.count })));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.warn('[JobsPage] Failed to load jobs metadata:', error)
    }
  }, [filters, hasVerifiedJobAccess, effectivePageSize, searchTerm, sortBy])

  const refreshJobsIfResumeChanged = useCallback(() => {
    if (!isAuthenticated || !token) return
    if (jobsLoading || loadingMore) return

    const marker = readMatchScoreRefreshMarker()
    if (!marker) return
    if (marker.timestamp <= lastJobsLoadedAtRef.current) return

    void loadJobsWithFilters(1, false)
  }, [isAuthenticated, token, jobsLoading, loadingMore, loadJobsWithFilters])

  // 加载更多数据
  const loadMoreJobs = async () => {
    if (loadingMore || jobsLoading) return

    if (!isAuthenticated || isEmailVerificationRequired) {
      showPreviewLimitPrompt()
      return
    }

    const nextPage = currentPage + 1
    const hasMore = jobs.length < totalJobs

    if (hasMore) {
      await loadJobsWithFilters(nextPage, true)
    }
  }

  // P0 Fix: Use debouncedSearchTerm instead of searchTerm to reduce API calls
  useEffect(() => {
    loadJobsWithFilters(1, false)
    const metadataTimer = window.setTimeout(() => {
      void loadJobsMetadata()
    }, 180)

    // Track search or filter change
    if (debouncedSearchTerm) {
      trackingService.track('search_submitted', {
        event_family: 'search',
        outcome: 'started',
        feature_key: 'job_search',
        ...buildSearchTermTrackingProperties(debouncedSearchTerm, 'jobs_page'),
        keyword: debouncedSearchTerm,
      })
      localStorage.setItem('haigoo_last_non_empty_job_search', debouncedSearchTerm)
    }
    rememberLatestJobSearch(debouncedSearchTerm)

    // Track filter usage (if any filter is active)
    const activeFilters = Object.entries(filters).filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'boolean') return value
      return false
    })

    if (activeFilters.length > 0) {
      trackingService.track('filter_applied', {
        event_family: 'search',
        outcome: 'succeeded',
        filters: activeFilters.map(f => f[0]),
        filter_count: activeFilters.length
      })
    }
    // 注意: loadJobsWithFilters 故意不包含在依赖中，因为其内部使用的值已在依赖数组中
    return () => window.clearTimeout(metadataTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, filters, isAuthenticated, token, sortBy])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshJobsIfResumeChanged()
      }
    }

    const handleWindowFocus = () => {
      refreshJobsIfResumeChanged()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [refreshJobsIfResumeChanged])

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
    const search = params.get('search') || ''
    const paramKeys = ['category', 'experienceLevel', 'industry', 'regionType', 'region', 'sourceType', 'location', 'type', 'jobType', 'salary', 'memberOnly', 'isTrusted', 'isNew']
    const hasFilterParam = paramKeys.some(key => params.has(key))

    setSearchTerm(prev => (prev === search ? prev : search))

    if (search.trim() && hasFilterParam) {
      const nextFilters = DEFAULT_JOB_FILTERS
      setFilters(nextFilters)
      const cleanedParams = buildJobsSearchParams(location.search, nextFilters, search)
      navigate({ search: cleanedParams.toString() }, { replace: true })
      return
    }
    if (hasFilterParam) {
      setFilters(prev => {
        const urlRegionType = readCsvParam(params, 'regionType')
        const legacyRegion = params.get('region')
        const legacyRegionType = legacyRegion === 'domestic'
          ? ['domestic']
          : legacyRegion === 'overseas'
            ? ['overseas']
            : []
        const next = normalizeJobFilters({
          ...prev,
          ...(params.has('category') && hasVerifiedJobAccess ? { category: readCsvParam(params, 'category') } : {}),
          ...(params.has('experienceLevel') ? { experienceLevel: readCsvParam(params, 'experienceLevel') } : {}),
          ...(params.has('industry') ? { industry: readCsvParam(params, 'industry') } : {}),
          ...(params.has('regionType') || params.has('region') ? { regionType: urlRegionType.length > 0 ? urlRegionType : legacyRegionType } : {}),
          ...(params.has('sourceType') ? { sourceType: readCsvParam(params, 'sourceType') } : {}),
          ...(params.has('location') ? { location: readCsvParam(params, 'location') } : {}),
          ...(params.has('type') ? { type: readCsvParam(params, 'type') } : {}),
          ...(params.has('jobType') ? { jobType: readCsvParam(params, 'jobType') } : {}),
          ...(params.has('salary') ? { salary: readCsvParam(params, 'salary') } : {}),
          ...(params.has('memberOnly') ? { memberOnly: params.get('memberOnly') === 'true' } : {}),
          ...(params.has('isTrusted') ? { isTrusted: params.get('isTrusted') === 'true' } : {}),
          ...(params.has('isNew') ? { isNew: params.get('isNew') === 'true' } : {})
        })
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
      })
    }
  }, [hasVerifiedJobAccess, location.search, navigate])

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
        throw new Error(data.error || '收藏接口失败')
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
    if (!initialJobsSettled && listMode === 'jobs') return
    const timer = window.setTimeout(() => {
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
    }, listMode === 'jobs' ? 350 : 0)
    return () => window.clearTimeout(timer)
  }, [initialJobsSettled, listMode, token])

  // 地址分类加载已移除 - 不再需要关键词匹配

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

  const mapApplicationJobs = useCallback((applications: any[]) => (
    Array.isArray(applications)
      ? applications.map((item: any) => ({ ...item.job, appliedAt: item.updatedAt })).filter((item: any) => item?.id)
      : []
  ), [])

  const refreshApplicationSummary = useCallback(async (options: { hydrateList?: boolean } = {}) => {
    if (!token) {
      setApplicationCount(0)
      setApplicationJobs([])
      return
    }

    try {
      const resp = await fetch('/api/user-profile?action=my_applications', { headers: { Authorization: `Bearer ${token}` } })
      const data = await resp.json().catch(() => ({}))
      const applications = Array.isArray(data?.applications) ? data.applications : []
      setApplicationCount(applications.length)
      if (options.hydrateList) {
        setApplicationJobs(mapApplicationJobs(applications))
      }
    } catch (error) {
      console.error('[JobsPage] Failed to refresh application summary:', error)
    }
  }, [mapApplicationJobs, token])

  useEffect(() => {
    if (!initialJobsSettled && listMode === 'jobs') return
    const timer = window.setTimeout(() => {
    void refreshApplicationSummary({ hydrateList: listMode === 'applications' })
    }, listMode === 'jobs' ? 450 : 0)
    return () => window.clearTimeout(timer)
  }, [initialJobsSettled, listMode, refreshApplicationSummary])

  useEffect(() => {
    const handleApplicationUpdated = () => {
      void refreshApplicationSummary({ hydrateList: listMode === 'applications' })
    }
    window.addEventListener('haigoo:applications-updated', handleApplicationUpdated)
    window.addEventListener('focus', handleApplicationUpdated)
    return () => {
      window.removeEventListener('haigoo:applications-updated', handleApplicationUpdated)
      window.removeEventListener('focus', handleApplicationUpdated)
    }
  }, [listMode, refreshApplicationSummary])

  useEffect(() => {
    if (!token || listMode === 'jobs') return
    let cancelled = false
    const loadPersonalList = async () => {
      setPersonalListLoading(true)
      try {
        if (listMode === 'favorites') {
          const resp = await fetch('/api/user-profile?action=favorites', { headers: { Authorization: `Bearer ${token}` } })
          const data = await resp.json().catch(() => ({}))
          if (!cancelled) setFavoriteJobs(Array.isArray(data?.favorites) ? data.favorites : [])
        } else {
          const resp = await fetch('/api/user-profile?action=my_applications', { headers: { Authorization: `Bearer ${token}` } })
          const data = await resp.json().catch(() => ({}))
          const applications = Array.isArray(data?.applications) ? data.applications : []
          if (!cancelled) {
            setApplicationCount(applications.length)
            setApplicationJobs(mapApplicationJobs(applications))
          }
        }
      } catch (error) {
        console.error('[JobsPage] Failed to load personal job list:', error)
        if (!cancelled) {
          if (listMode === 'favorites') setFavoriteJobs([])
          else setApplicationJobs([])
        }
      } finally {
        if (!cancelled) setPersonalListLoading(false)
      }
    }
    void loadPersonalList()
    return () => { cancelled = true }
  }, [listMode, mapApplicationJobs, token])

  const visibleJobs = useMemo(() => {
    if (listMode === 'favorites') return favoriteJobs
    if (listMode === 'applications') return applicationJobs
    return distributedJobs
  }, [applicationJobs, distributedJobs, favoriteJobs, listMode])

  const shouldShowListSkeleton =
    (listMode === 'jobs' && (showLoading || (!initialJobsSettled && visibleJobs.length === 0))) ||
    (listMode !== 'jobs' && personalListLoading)

  // Deep Linking: Sync URL with selectedJob
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const jobId = params.get('jobId')

    if (jobId && visibleJobs.length > 0) {
      const job = visibleJobs.find(j => j.id === jobId)
      if (job) {
        if (selectedJob?.id !== job.id) {
          setSelectedJob(job)
          hasManualJobSelectionRef.current = true
          const idx = visibleJobs.findIndex(j => j.id === jobId)
          if (idx !== -1) setCurrentJobIndex(idx)

          if (window.innerWidth >= 1024) {
            setShowInlineDetail(true)
          } else {
            setIsJobDetailOpen(true)
          }
        }
      }
    } else if (!jobId) {
      const selectedStillVisible = selectedJob ? visibleJobs.some(job => job.id === selectedJob.id) : false
      if (window.innerWidth >= 1024 && listMode === 'jobs' && visibleJobs.length > 0 && !hasManualJobSelectionRef.current) {
        const firstJob = visibleJobs[0]
        if (selectedJob?.id !== firstJob.id) {
          setSelectedJob(firstJob)
          setCurrentJobIndex(0)
        }
        setShowInlineDetail(true)
        setIsJobDetailOpen(false)
      } else if (selectedStillVisible && window.innerWidth >= 1024) {
        setShowInlineDetail(true)
      } else {
        setShowInlineDetail(false)
        setIsJobDetailOpen(false)
        if (selectedJob) setSelectedJob(null)
      }
    }
  }, [visibleJobs, location.search, selectedJob, listMode])

  const handleJobSelect = (job: Job, index: number) => {
    hasManualJobSelectionRef.current = true
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
    const nextFilters = DEFAULT_JOB_FILTERS
    setSearchTerm('');
    hasManualJobSelectionRef.current = false
    setFilters(nextFilters);
    syncJobListUrl(nextFilters, '')
    setListMode('jobs')
  }

  return (
    <MobileRestricted allowContinue={true}>
      <div
        className="relative flex min-h-screen flex-col overflow-x-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f8fbfd_52%,#fffefb_100%)] pt-20 lg:h-full lg:overflow-hidden"
        role="main"
        aria-label="职位搜索页面"
      >
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_18%_12%,rgba(255,239,198,0.5),transparent_32%),radial-gradient(circle_at_78%_6%,rgba(217,235,252,0.72),transparent_30%),linear-gradient(180deg,rgba(255,253,248,0.96),rgba(255,253,248,0))]" />
          <img src={JOBS_PAGE_DECOR.sun} alt="" loading="lazy" decoding="async" className="absolute right-12 top-20 hidden w-24 opacity-65 lg:block" />
          <img src={JOBS_PAGE_DECOR.love} alt="" loading="lazy" decoding="async" className="absolute left-[45%] top-[102px] hidden w-9 opacity-55 xl:block" />
          <img src={JOBS_PAGE_DECOR.grass} alt="" loading="lazy" decoding="async" className="absolute bottom-6 left-4 hidden w-40 opacity-50 lg:block" />
          <img src={JOBS_PAGE_DECOR.grass2} alt="" loading="lazy" decoding="async" className="absolute bottom-10 right-10 hidden w-32 opacity-40 xl:block" />
          <img src={JOBS_PAGE_DECOR.tips} alt="" loading="lazy" decoding="async" className="absolute bottom-0 left-0 hidden w-60 opacity-45 lg:block" />
        </div>
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

        <div className="relative z-10 flex-1 flex flex-col max-w-[1620px] mx-auto w-full px-2.5 sm:px-6 lg:px-8 gap-3 lg:overflow-hidden lg:h-full pt-0 mt-0">

          {/* Main Content Area: Split View */}
          <div className="flex flex-col gap-3 min-h-0 mt-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
            {/* Middle Column: Job List */}
            <div className="relative z-30 flex w-full flex-shrink-0 flex-col overflow-visible rounded-[20px] border border-[#cfdbe5] bg-white shadow-[0_28px_72px_-48px_rgba(49,65,88,0.34)] sm:rounded-[24px] lg:w-[40%] lg:rounded-[28px] xl:w-[40%]">
              <div className="relative z-50 flex-shrink-0 bg-transparent p-0">
                <JobFilterBar
                  filters={filters}
                  onFilterChange={(newFilters: any) => {
                    if (import.meta.env.DEV) {
                      console.debug('[JobsPage] onFilterChange triggered:', newFilters)
                    }
                    const updated = normalizeJobFilters({ ...filters, ...newFilters })
                    hasManualJobSelectionRef.current = false
                    if (import.meta.env.DEV) {
                      console.debug('[JobsPage] New filters state:', updated)
                    }
                    setFilters(updated);
                    syncJobListUrl(updated, searchTermRef.current)
                  }}
                  categoryOptions={categoryOptions}
                  industryOptions={industryOptions}
                  jobTypeOptions={jobTypeOptions}
                  experienceLevelOptions={experienceLevelOptions}
                  locationOptions={locationOptions}
                  timezoneOptions={timezoneOptions}
                  searchTerm={searchTerm}
                  onSearchChange={(value) => {
                    hasManualJobSelectionRef.current = false
                    setSearchTerm(value)
                    const shouldClearFilters = Boolean(value.trim()) && hasActiveJobIntent('', filters)
                    const nextFilters = shouldClearFilters ? DEFAULT_JOB_FILTERS : filters
                    if (shouldClearFilters) {
                      setFilters(nextFilters)
                    }
                    syncJobListUrl(nextFilters, value)
                  }}
                  sortBy={sortBy}
                  listMode={listMode}
                  favoriteCount={savedJobs.size}
                  applicationCount={applicationCount}
                  isAuthenticated={hasVerifiedJobAccess}
                  isMember={isMember}
                  verificationRequired={isEmailVerificationRequired}
                  onListModeChange={(mode) => {
                    setListMode(mode)
                    if (mode !== 'jobs') {
                      const params = new URLSearchParams(location.search)
                      params.delete('jobId')
                      navigate({ search: params.toString() }, { replace: true })
                      setSelectedJob(null)
                      hasManualJobSelectionRef.current = false
                    }
                  }}
                  onSortChange={() => {
                    setListMode('jobs')
                    hasManualJobSelectionRef.current = false
                    setSortBy(prev => prev === 'recent' ? 'relevance' : 'recent')
                  }}
                  onOpenTracking={openCommunityPage}
                />
              </div>

              {/* List Header Info - Only show if there's a specific filter info to display like isTrusted */}
              {filters.isTrusted && (
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-end items-center text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1 text-[#6f63f6]">
                    <Zap className="w-3 h-3 fill-[#6f63f6]" />
                    已过滤精选企业
                  </span>
                </div>
              )}
              {jobsRefreshing && listMode === 'jobs' && (
                <div className="h-0.5 overflow-hidden bg-slate-100" aria-label="正在更新职位列表">
                  <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] bg-[#8b7cff]" />
                </div>
              )}

              {/* List Content */}
              <div className="flex-1 overflow-visible bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-0 lg:overflow-y-auto lg:overscroll-y-contain custom-scrollbar">
                {shouldShowListSkeleton ? (
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
                ) : visibleJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    {jobsLoadError && listMode === 'jobs' ? (
                      <>
                        <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-rose-300" />
                        </div>
                        <p className="text-slate-900 font-medium mb-1">职位列表加载失败</p>
                        <p className="text-slate-500 text-xs mb-4 max-w-[240px]">网络或数据服务暂时不可用，请稍后重试。</p>
                        <button onClick={() => loadJobsWithFilters(1, false)} className="text-[#6f63f6] text-sm hover:underline mb-8">重新加载</button>
                      </>
                    ) : filters.aiRecommended ? (
                      <>
                        <div className="w-12 h-12 bg-[#f6f3ff] rounded-full flex items-center justify-center mb-3">
                          <Sparkles className="w-6 h-6 text-[#8b7cff]" />
                        </div>
                        <p className="text-slate-900 font-medium mb-1">当前条件下暂未发现 AI 强推荐的职位</p>
                        <p className="text-slate-500 text-xs mb-4 max-w-[240px]">为了保证内推质量，AI 只会推荐与你高度匹配的优质机会。建议稍微放宽筛选条件，或稍后再来。</p>
                        <button onClick={() => setFilters((prev: any) => ({ ...prev, aiRecommended: false }))} className="text-[#6f63f6] text-sm font-medium hover:underline mb-8 bg-[#f6f3ff] px-4 py-2 rounded-lg">返回普通列表</button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-slate-900 font-medium mb-1">未找到相关职位</p>
                        <button onClick={clearAllFilters} className="text-[#6f63f6] text-sm hover:underline mb-8">清除筛选</button>
                      </>
                    )}

                    {/* Community Promo for Empty State */}
                    <div className="w-full max-w-sm rounded-xl border border-[#dceadf] bg-[linear-gradient(120deg,#f3fbf6_0%,#ffffff_58%,#fff9ef_100%)] p-4 flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#6f63f6]" />
                        <span className="font-bold text-slate-900 text-sm">获取每日精选岗位推荐</span>
                      </div>
                      <p className="text-xs text-slate-500 text-center">加入微信群，获取更及时的精选岗位推荐，并与同行交流经验。</p>
                      <button
                        onClick={openCommunityPage}
                        className="px-6 py-2 bg-white text-[#3f7f67] text-xs font-bold rounded-lg border border-emerald-100 shadow-sm hover:bg-emerald-50 transition-colors w-full tracking-wide"
                      >
                        岗位订阅
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pb-4">
                    {listMode === 'jobs' && activeBundles.length > 0 && !loadingMore && currentPage === 1 && (
                      <div className="border-b border-slate-100/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.72),rgba(255,255,255,0))] px-4 pb-4 pt-4">
                        {/* Fixed-width carousel: show real bundle titles without squeezing; overflow scrolls horizontally. */}
                        <div className="relative">
                          <div
                            className="flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {activeBundles.map((bundle, index) => (
                              <div
                                key={bundle.id}
                                className="snap-start"
                                style={{
                                  flex: activeBundles.length === 1
                                    ? '0 0 100%'
                                    : activeBundles.length === 2
                                      ? '0 0 calc((100% - 12px) / 2)'
                                      : '0 0 clamp(190px, calc((100% - 24px) / 2.35), 238px)'
                                }}
                              >
                                <JobBundleCard bundle={bundle} colorIndex={index} />
                              </div>
                            ))}
                            {/* Trailing spacer preserves right-side peek in scroll mode */}
                            {activeBundles.length > 1 && <div className="flex-shrink-0 w-2 lg:hidden" />}
                            {activeBundles.length > 3 && <div className="hidden flex-shrink-0 w-2 lg:block" />}
                          </div>
                          {/* Right fade hint for scrollable state */}
                          {activeBundles.length > 1 && (
                            <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l from-white via-white/85 to-transparent" />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 px-3 pt-3 sm:px-4 sm:pt-4">
                      {visibleJobs.map((job, index) => (
                        <JobCardNew
                          key={job.id}
                          job={job}
                          variant="list"
                          isActive={selectedJob?.id === job.id}
                          onClick={() => handleJobSelect(job, index)}
                          matchScore={getMeaningfulMatchScore(job) || undefined}
                          isSaved={savedJobs.has(job.id)}
                          showApplicationMethodIcons
                        />
                      ))}
                    </div>

                    {/* Low Result Count Promo */}
                    {listMode === 'jobs' && visibleJobs.length < 5 && (
                      <div className="mx-4 my-4 rounded-2xl border border-[#dceadf] bg-[linear-gradient(120deg,#f3fbf6_0%,#ffffff_58%,#fff9ef_100%)] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_20px_40px_-34px_rgba(64,102,78,0.22)]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-[#49a982] flex-shrink-0">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="text-center sm:text-left">
                            <h3 className="font-bold text-slate-900 text-sm">没找到心仪的职位？</h3>
                            <p className="text-xs text-slate-500 mt-0.5">加入微信群，获取更及时的精选岗位推荐，并与同行交流经验</p>
                          </div>
                        </div>
                        <button
                          onClick={openCommunityPage}
                          className="px-4 py-2 bg-white text-[#3f7f67] text-xs font-bold rounded-lg border border-emerald-100 shadow-sm hover:bg-emerald-50 transition-colors whitespace-nowrap"
                        >
                          岗位订阅
                        </button>
                      </div>
                    )}

                    {/* Load More Trigger */}
                    {listMode === 'jobs' && <div className="p-4 text-center border-t border-slate-100">
                      {loadingMore ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                          <div className="w-4 h-4 border-2 border-[#6f63f6] border-t-transparent rounded-full animate-spin"></div>
                          加载中...
                        </div>
                      ) : jobs.length < totalJobs ? (
                        <button onClick={loadMoreJobs} className="text-xs text-[#6f63f6] hover:underline font-medium">
                          加载更多
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">已加载全部</span>
                      )}
                    </div>}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Detail Panel (Desktop Only) */}
            <div className="relative z-10 hidden h-full flex-1 flex-col overflow-hidden rounded-[28px] border border-[#dfe8ef] bg-white/94 shadow-[0_32px_90px_-60px_rgba(64,78,102,0.28)] backdrop-blur-sm lg:flex">
              {selectedJob ? (
                <div className="h-full overflow-y-auto custom-scrollbar overscroll-y-contain">
                  <Suspense fallback={
                    <div className="flex h-full min-h-[520px] items-center justify-center text-sm font-semibold text-slate-400">
                      岗位详情加载中...
                    </div>
                  }>
                    <JobDetailPanel
                      job={selectedJob}
                      onSave={(id) => selectedJob && toggleSaveJob(id, selectedJob)}
                      isSaved={savedJobs.has(selectedJob.id)}
                      onApply={() => { /* apply logic */ }}
                      showCloseButton={false}
                      onNavigateJob={(direction) => {
                        const nextIndex = direction === 'prev' ? Math.max(0, currentJobIndex - 1) : Math.min(visibleJobs.length - 1, currentJobIndex + 1)
                        handleJobSelect(visibleJobs[nextIndex], nextIndex)
                      }}
                      canNavigatePrev={currentJobIndex > 0}
                      canNavigateNext={currentJobIndex < visibleJobs.length - 1}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-slate-400 bg-[linear-gradient(180deg,rgba(255,253,249,0.86),rgba(255,255,255,0.96))]">
                  <img src={JOBS_PAGE_DECOR.beach} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-24" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,249,0.68)_0%,rgba(255,255,255,0.86)_72%,rgba(255,255,255,0.94)_100%)]" />
                  <img src={JOBS_PAGE_DECOR.sun} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute right-12 top-12 h-24 w-24 opacity-65" />
                  <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-slate-100 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
                    <Briefcase className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-semibold text-slate-600">选择一个职位查看详情</p>
                  <p className="mt-2 max-w-[260px] text-center text-sm text-slate-400">左侧列表适合快速筛选，右侧详情用于集中判断与申请。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Job Detail Modal (Mobile Only) */}
        {isJobDetailOpen && selectedJob && (
          <Suspense fallback={
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/40 p-6 text-sm font-semibold text-white">
              岗位详情加载中...
            </div>
          }>
            <JobDetailModal
              job={selectedJob}
              isOpen={isJobDetailOpen}
              onClose={() => { setIsJobDetailOpen(false); }}
              onSave={() => selectedJob && toggleSaveJob(selectedJob.id, selectedJob)}
              isSaved={savedJobs.has(selectedJob.id)}
              jobs={visibleJobs}
              currentJobIndex={currentJobIndex}
              variant="center"
              onNavigateJob={(direction: 'prev' | 'next') => {
                const nextIndex = direction === 'prev' ? Math.max(0, currentJobIndex - 1) : Math.min(visibleJobs.length - 1, currentJobIndex + 1)
                handleJobSelect(visibleJobs[nextIndex], nextIndex)
              }}
            />
          </Suspense>
        )}

        {/* WeChat Community Modal */}
        {showWechatModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowWechatModal(false)}>
            <div className="relative w-full max-w-[360px] bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="absolute right-4 top-4 z-20">
                <button
                  onClick={() => setShowWechatModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 bg-white/80 hover:bg-slate-100 backdrop-blur rounded-full transition-colors shadow-sm border border-slate-100"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-8 text-center bg-gradient-to-br from-emerald-50/50 via-white to-sky-50/50 relative">
                {/* Decorative blob */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100 rounded-full mix-blend-multiply filter blur-2xl opacity-50 translate-x-8 -translate-y-8"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-100 rounded-full mix-blend-multiply filter blur-2xl opacity-50 -translate-x-8 translate-y-8"></div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm border border-emerald-100 mb-5">
                    <Sparkles className="w-7 h-7 text-emerald-500" />
                  </div>
                  <h3 className="text-[22px] font-bold tracking-tight text-slate-900 mb-2">
                    岗位订阅
                  </h3>
                  <p className="text-[13px] leading-relaxed text-slate-500 mb-6 px-1">
                    加入企业微信群，获得更及时的精选岗位推荐，并与同行交流经验。
                  </p>
                  
                  <div className="relative mx-auto max-w-[200px] bg-white p-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 mb-6 group">
                    <img
                      src="/Wechat_group.webp"
                      alt="微信群二维码"
                      className="w-full h-auto rounded-xl object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    使用微信或企业微信扫码加入
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </MobileRestricted>
  )
}
