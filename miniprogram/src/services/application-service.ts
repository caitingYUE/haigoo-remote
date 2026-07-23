import type { MiniJob } from '../types'
import { requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'

export interface ApplicationResponse {
  success?: boolean
  usage?: number
  limit?: number
  remaining?: number
  isMember?: boolean
  type?: 'website' | 'email' | 'referral'
  websiteUrl?: string
  hiringEmail?: string
  emailType?: string
  code?: string
  applicationStatus?: 'entry_opened' | 'applied'
}

function createIdempotencyKey(jobId: string, type: string) {
  return `mini-${type}-${jobId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function requestApplication(job: MiniJob, type: 'website' | 'email' | 'referral'): Promise<ApplicationResponse> {
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
export const unlockReferralApplication = (job: MiniJob) => requestApplication(job, 'referral')

export function confirmApplicationCompleted(job: MiniJob, type: 'website' | 'email' | 'referral') {
  return requestJson<{ success?: boolean; status?: 'applied' }>(
    `/mini/jobs/${encodeURIComponent(job.id)}/application-status`,
    {
      method: 'POST',
      authenticated: true,
      data: { type, status: 'applied' }
    }
  ).then((response) => {
    void trackMiniEvent('mini_application_confirmed', { job_id: job.id, apply_method: type, status: 'applied' })
    return response
  })
}
