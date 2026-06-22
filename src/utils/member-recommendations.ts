import { Job } from '../types'
import { ProcessedJobsFilters, processedJobsService } from '../services/processed-jobs-service'

const MEMBER_RECOMMENDATION_LIMIT = 6
const MAX_COMPANY_PER_RECOMMENDATION = 2
const CANDIDATE_POOL_SIZE = 72
const NEAR_MATCH_SCORE_GAP = 5
const JOB_FILTERS_STORAGE_KEY = 'haigoo_job_filters'
const JOB_SEARCH_STORAGE_KEY = 'haigoo_last_job_search'

type DailyMemberRecommendationOptions = {
  hasResume?: boolean
}

type StoredJobFilters = {
  category?: string[]
  experienceLevel?: string[]
  industry?: string[]
  regionType?: string[]
  sourceType?: string[]
  location?: string[]
  type?: string[]
  jobType?: string[]
  salary?: string[]
  isTrusted?: boolean
  isNew?: boolean
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function readStoredJobContext(): { filters: ProcessedJobsFilters; hasUserContext: boolean } {
  if (typeof window === 'undefined') return { filters: {}, hasUserContext: false }

  let storedFilters: StoredJobFilters = {}
  try {
    const raw = window.localStorage.getItem(JOB_FILTERS_STORAGE_KEY)
    storedFilters = raw ? JSON.parse(raw) : {}
  } catch {
    storedFilters = {}
  }

  const filters: ProcessedJobsFilters = {}
  const addArrayFilter = (sourceKey: keyof StoredJobFilters, targetKey: keyof ProcessedJobsFilters = sourceKey as keyof ProcessedJobsFilters) => {
    const values = normalizeStringArray(storedFilters[sourceKey])
    if (values.length > 0) {
      filters[targetKey] = values.join(',') as never
    }
  }

  addArrayFilter('category')
  addArrayFilter('experienceLevel')
  addArrayFilter('industry')
  addArrayFilter('regionType')
  addArrayFilter('sourceType')
  addArrayFilter('location')
  addArrayFilter('type')
  addArrayFilter('jobType')
  addArrayFilter('salary')

  if (storedFilters.isTrusted) filters.isTrusted = true
  if (storedFilters.isNew) filters.isNew = true

  const recentSearch = String(window.localStorage.getItem(JOB_SEARCH_STORAGE_KEY) || '').trim()
  if (recentSearch) filters.search = recentSearch

  const hasUserContext = Boolean(
    recentSearch ||
    Object.keys(filters).some((key) => key !== 'memberOnly' && key !== 'sortBy' && key !== 'skipAggregations')
  )

  return { filters, hasUserContext }
}

export function rememberLatestJobSearch(searchTerm: string) {
  if (typeof window === 'undefined') return
  const normalized = searchTerm.trim()
  if (normalized) {
    window.localStorage.setItem(JOB_SEARCH_STORAGE_KEY, normalized)
  } else {
    window.localStorage.removeItem(JOB_SEARCH_STORAGE_KEY)
  }
}

export function getMeaningfulRecommendationScore(job: Job) {
  return Number(job.trueMatchScore ?? job.displayMatchScore ?? job.matchScore ?? job.recommendationScore ?? 0) || 0
}

function uniqueJobs(jobs: Job[]) {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    const id = String(job.id || '').trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function isRenderableJob(job: Job) {
  return Boolean(String(job.id || '').trim() && String(job.title || '').trim() && String(job.company || '').trim())
}

function getPublishedTime(job: Job) {
  return new Date(job.publishedAt || job.updatedAt || (job as any).createdAt || 0).getTime() || 0
}

function getCompanyKey(job: Job) {
  return String(job.companyId || job.company || 'unknown').trim().toLowerCase()
}

function getPriorityScore(job: Job) {
  return (
    (job.memberOnly ? 4 : 0) +
    (job.isFeatured ? 3 : 0) +
    (job.canRefer ? 1 : 0) +
    (job.isTrusted ? 1 : 0) +
    (job.isNew ? 0.5 : 0)
  )
}

export function selectDailyMemberRecommendations(
  jobs: Job[],
  limit = MEMBER_RECOMMENDATION_LIMIT,
  options: DailyMemberRecommendationOptions = {}
) {
  const dayKey = getLocalDateKey()
  const sorted = uniqueJobs(jobs)
    .filter(isRenderableJob)
    .map((job, index) => {
      const score = getMeaningfulRecommendationScore(job)
      const publishedAt = getPublishedTime(job)
      return {
        job,
        index,
        score,
        priority: getPriorityScore(job),
        publishedAt,
        dailyRank: hashString(`${dayKey}:${job.company || ''}:${job.id}`)
      }
    })
    .sort((a, b) => {
      if (options.hasResume) {
        const scoreDiff = b.score - a.score
        if (Math.abs(scoreDiff) >= NEAR_MATCH_SCORE_GAP) return scoreDiff

        const memberDiff = Number(Boolean(b.job.memberOnly)) - Number(Boolean(a.job.memberOnly))
        if (memberDiff !== 0) return memberDiff

        const featuredDiff = Number(Boolean(b.job.isFeatured)) - Number(Boolean(a.job.isFeatured))
        if (featuredDiff !== 0) return featuredDiff

        const priorityDiff = b.priority - a.priority
        if (priorityDiff !== 0) return priorityDiff

        if (scoreDiff !== 0) return scoreDiff
      } else {
        const priorityDiff = b.priority - a.priority
        if (priorityDiff !== 0) return priorityDiff
      }

      const dateDiff = b.publishedAt - a.publishedAt
      if (Math.abs(dateDiff) >= 24 * 60 * 60 * 1000) return dateDiff

      if (a.dailyRank !== b.dailyRank) return a.dailyRank - b.dailyRank
      return a.index - b.index
    })

  const companyCounts = new Map<string, number>()
  const selected: Job[] = []

  for (const item of sorted) {
    const companyKey = getCompanyKey(item.job)
    const count = companyCounts.get(companyKey) || 0
    if (count >= MAX_COMPANY_PER_RECOMMENDATION) continue

    selected.push(item.job)
    companyCounts.set(companyKey, count + 1)

    if (selected.length >= limit) break
  }

  return selected
}

export async function fetchDailyMemberRecommendations(
  limit = MEMBER_RECOMMENDATION_LIMIT,
  options: DailyMemberRecommendationOptions = {}
): Promise<Job[]> {
  const { filters: contextFilters, hasUserContext } = readStoredJobContext()
  const baseFilters: ProcessedJobsFilters = {
    status: 'active',
    isApproved: true,
    skipAggregations: true,
    sortBy: options.hasResume ? 'relevance' : 'recent'
  }

  const fetchBatch = async (filters: ProcessedJobsFilters) => {
    const response = await processedJobsService.getProcessedJobs(1, CANDIDATE_POOL_SIZE, filters)
    return response.jobs || []
  }

  const batches: Job[][] = []

  try {
    batches.push(await fetchBatch({ ...baseFilters, ...contextFilters }))
  } catch (error) {
    console.warn('[member-recommendations] personalized jobs failed:', error)
  }

  const firstBatch = batches[0] || []
  const hasPersonalSignal = hasUserContext || firstBatch.some((job) => getMeaningfulRecommendationScore(job) > 0)

  if (hasUserContext && firstBatch.length < limit) {
    try {
      batches.push(await fetchBatch({ ...baseFilters, memberOnly: true }))
    } catch (error) {
      console.warn('[member-recommendations] broad member jobs failed:', error)
    }
  }

  if (!hasPersonalSignal || uniqueJobs(batches.flat()).length < limit) {
    try {
      batches.push(await fetchBatch({ ...baseFilters, isFeatured: true, sortBy: 'recent' }))
    } catch (error) {
      console.warn('[member-recommendations] featured jobs failed:', error)
    }
  }

  if (uniqueJobs(batches.flat()).length < limit) {
    try {
      batches.push(await fetchBatch({ ...baseFilters, sortBy: 'recent' }))
    } catch (error) {
      console.warn('[member-recommendations] latest jobs failed:', error)
    }
  }

  return selectDailyMemberRecommendations(batches.flat(), limit, options)
}
