import type { MiniJob } from '../types'
import { requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'

export interface ApplicationResponse {
  success?: boolean
  usage?: ApplicationUsageItem
  type?: 'website' | 'email'
  websiteUrl?: string
  hiringEmail?: string
  emailType?: string
  code?: string
  applicationStatus?: 'entry_opened' | 'applied'
}

export interface ApplicationUsageItem {
  usage?: number
  limit?: number
  remaining?: number
  isMember?: boolean
  sharedAccess?: boolean
}

export interface ApplicationUsage {
  success?: boolean
  isMember: boolean
  website: ApplicationUsageItem
  email: ApplicationUsageItem
}

function createIdempotencyKey(jobId: string, type: string) {
  return `mini-${type}-${jobId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function requestApplication(job: MiniJob, type: 'website' | 'email'): Promise<ApplicationResponse> {
  const response = await requestJson<ApplicationResponse>(
    `/mini/jobs/${encodeURIComponent(job.id)}/application`,
    {
      method: 'POST',
      authenticated: true,
      data: {
        type,
        idempotencyKey: createIdempotencyKey(job.id, type)
      }
    }
  )
  void trackMiniEvent('mini_application_entry_opened', { job_id: job.id, apply_method: type, status: 'entry_opened' })
  return response
}

export const unlockWebsiteApplication = (job: MiniJob) => requestApplication(job, 'website')
export const unlockEmailApplication = (job: MiniJob) => requestApplication(job, 'email')

export function fetchApplicationUsage() {
  return requestJson<ApplicationUsage>(
    '/mini/application-usage',
    { authenticated: true }
  )
}

export function confirmApplicationCompleted(job: MiniJob, type: 'website' | 'email') {
  return requestJson<{ success?: boolean; status?: 'applied' }>(
    `/mini/jobs/${encodeURIComponent(job.id)}/application-status`,
    {
      method: 'POST',
      authenticated: true,
      data: {
        type,
        status: 'applied',
        idempotencyKey: createIdempotencyKey(job.id, `${type}-confirmed`)
      }
    }
  ).then((response) => {
    void trackMiniEvent('mini_application_confirmed', { job_id: job.id, apply_method: type, status: 'applied' })
    return response
  })
}
