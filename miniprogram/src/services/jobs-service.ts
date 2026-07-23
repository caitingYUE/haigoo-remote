import type { JobsResponse, MiniJob } from '../types'
import { previewCategories, previewJobs } from '../data/preview-jobs'
import { mapApiJob, type RawApiJob } from '../utils/job-format'
import { requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'
import { loginWithWechat } from './mini-auth-service'
import { getMiniSessionToken, hasAuthenticatedSession } from './session'

interface RawJobsResponse {
  jobs?: RawApiJob[]
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
  aggregations?: {
    category?: Array<{ value?: string; count?: number }>
  }
  categories?: Array<{ label?: string; value?: string; count?: number }>
  browse?: JobsResponse['browse']
}

export interface JobsQuery {
  page?: number
  limit?: number
  search?: string
  category?: string
  featured?: boolean
  sortBy?: 'default' | 'recent'
}

const requestCache = new Map<string, { expiresAt: number; promise: Promise<JobsResponse> }>()
const CACHE_TTL = 30 * 1000

function previewResponse(query: JobsQuery = {}): JobsResponse {
  const search = String(query.search || '').toLowerCase()
  const categoryTerms = String(query.category || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  const filteredJobs = previewJobs.filter((job) => {
    if (query.featured && !job.featured) return false
    if (categoryTerms.length > 0) {
      const haystack = [job.category, job.title, job.type, ...job.tags].join(' ').toLowerCase()
      if (!categoryTerms.some((item) => haystack.includes(item))) return false
    }
    return !search || [job.title, job.company, ...job.tags].join(' ').toLowerCase().includes(search)
  })
  const page = Math.max(1, query.page || 1)
  const pageSize = Math.max(1, query.limit || 20)
  const jobs = filteredJobs.slice((page - 1) * pageSize, page * pageSize)
  return {
    jobs,
    total: filteredJobs.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(filteredJobs.length / pageSize)),
    categories: previewCategories
  }
}

function mapJobsResponse(data: RawJobsResponse): JobsResponse {
  const jobs = Array.isArray(data.jobs)
    ? data.jobs.map(mapApiJob).filter((job) => Boolean(job.id))
    : []
  const categoryAggregations = Array.isArray(data.categories)
    ? data.categories
    : data.aggregations && data.aggregations.category
  const categories = Array.isArray(categoryAggregations)
    ? categoryAggregations
      .map((item) => ({
        label: String(item.value || '').trim(),
        value: String(item.value || '').trim(),
        count: Number(item.count || 0)
      }))
      .filter((item) => item.value && item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
    : []

  return {
    jobs,
    total: Number(data.total || jobs.length),
    page: Number(data.page || 1),
    pageSize: Number(data.pageSize || jobs.length),
    totalPages: Number(data.totalPages || 1),
    categories,
    browse: data.browse
  }
}

async function ensureBrowseSession() {
  if (process.env.TARO_ENV === 'h5') return
  if (!getMiniSessionToken()) await loginWithWechat()
}

export async function fetchJobs(query: JobsQuery = {}): Promise<JobsResponse> {
  await ensureBrowseSession()
  const page = query.page || 1
  const limit = query.limit || 20
  const authenticated = hasAuthenticatedSession()
  const params = {
    page,
    limit,
    pageSize: limit,
    search: query.search ? query.search.trim() : undefined,
    category: query.category,
    featured: query.featured ? 'true' : undefined,
    sortBy: query.sortBy || 'default',
    isApproved: true,
  }
  const url = `/mini/jobs?${new URLSearchParams(Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]))}`

  const cacheKey = `${authenticated ? 'auth' : 'guest'}:${url}`
  const cached = requestCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.promise

  const promise = requestJson<RawJobsResponse>(url, { authenticated: true }).then(mapJobsResponse)
  requestCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL, promise })

  try {
    const response = await promise
    void trackMiniEvent('mini_jobs_loaded', {
      page_key: 'jobs',
      result_count: response.jobs.length,
      filter_count: Number(Boolean(query.category)) + Number(Boolean(query.featured)),
      has_keyword: Boolean(query.search),
      status: response.browse?.limited ? 'limited' : 'succeeded'
    })
    if (response.browse?.limited) void trackMiniEvent('mini_browse_limit_reached', { page_key: 'jobs', status: 'blocked' })
    return response
  } catch (error) {
    requestCache.delete(cacheKey)
    if (process.env.TARO_ENV === 'h5') return previewResponse(query)
    throw error
  }
}

export async function fetchFeaturedJobs(): Promise<MiniJob[]> {
  await ensureBrowseSession()
  try {
    const data = await requestJson<RawJobsResponse>(
      '/mini/jobs?featured=true&limit=6',
      { authenticated: true }
    )
    return Array.isArray(data.jobs)
      ? data.jobs.map(mapApiJob).filter((job) => Boolean(job.id))
      : []
  } catch (error) {
    if (process.env.TARO_ENV === 'h5') return previewJobs.filter((job) => job.featured)
    throw error
  }
}

export async function fetchJobById(id: string): Promise<MiniJob | null> {
  await ensureBrowseSession()
  let data: RawJobsResponse
  try {
    data = await requestJson<RawJobsResponse>(
      `/mini/jobs/${encodeURIComponent(id)}`,
      { authenticated: true }
    )
  } catch (error) {
    if (process.env.TARO_ENV === 'h5') return previewJobs.find((job) => job.id === id) || previewJobs[0]
    throw error
  }
  const job = (data as RawJobsResponse & { job?: RawApiJob }).job || (Array.isArray(data.jobs) ? data.jobs[0] : undefined)
  const mappedJob = job ? mapApiJob(job) : null
  if (mappedJob && (mappedJob.status === 'closed' || mappedJob.status === 'expired')) return null
  return mappedJob
}

export function clearJobsRequestCache() {
  requestCache.clear()
}
