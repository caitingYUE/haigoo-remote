import type { MiniJob } from '../types'
import { mapApiJob, type RawApiJob } from '../utils/job-format'
import { createRequestKey, requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'

export interface MiniApplicationRecord {
  id: string | number
  jobId: string
  interactionType?: string
  status?: string
  applicationSource?: string | null
  updatedAt?: string | null
  jobTitle?: string
  company?: string
}

interface FavoritesResponse {
  favoriteJobIds?: string[]
  jobs?: RawApiJob[]
  favorite?: boolean
}

interface ApplicationsResponse {
  applications?: MiniApplicationRecord[]
  jobs?: RawApiJob[]
}

export interface MiniApplicationsFeed {
  applications: MiniApplicationRecord[]
  jobs: MiniJob[]
}

export async function fetchFavorites() {
  const data = await requestJson<FavoritesResponse>('/mini/favorites', { authenticated: true })
  return {
    favoriteJobIds: Array.isArray(data.favoriteJobIds) ? data.favoriteJobIds : [],
    jobs: Array.isArray(data.jobs) ? data.jobs.map(mapApiJob).filter((job) => Boolean(job.id)) : []
  }
}

export async function setJobFavorite(jobId: string, favorite: boolean) {
  const response = await requestJson<FavoritesResponse>('/mini/favorites', {
    method: 'POST',
    authenticated: true,
    data: { jobId, favorite, idempotencyKey: createRequestKey(`favorite-${jobId}`) }
  })
  void trackMiniEvent('mini_favorite_changed', { job_id: jobId, status: favorite ? 'saved' : 'removed' })
  return response
}

export async function fetchApplications(): Promise<MiniApplicationsFeed> {
  const data = await requestJson<ApplicationsResponse>('/mini/applications', { authenticated: true })
  return {
    applications: Array.isArray(data.applications) ? data.applications : [],
    jobs: Array.isArray(data.jobs) ? data.jobs.map(mapApiJob).filter((job) => Boolean(job.id)) : []
  }
}
