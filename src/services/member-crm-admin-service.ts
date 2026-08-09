import type {
  CrmApplication,
  CrmServiceRecord,
  MemberCrmDetail,
  MemberCrmListResponse,
  MemberCrmProfile
} from '../types/member-crm-types'
import { trackingService } from './tracking-service'

type RequestOptions = RequestInit & { token?: string | null }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options
  const query = new URLSearchParams(path.split('?')[1] || '')
  const resource = query.get('resource') || 'members'
  const entityId = query.get('userId') || query.get('id') || undefined
  const response = await trackingService.trackedFetch(`/api/admin/member-crm${path}`, {
    ...rest,
    headers: {
      ...(rest.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {})
    }
  }, {
    module: 'member_crm',
    feature_key: `member_crm_${resource}`,
    entity_type: query.get('userId') ? 'member' : resource,
    entity_id: entityId
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) throw new Error(data.error || '会员 CRM 请求失败')
  return data.data as T
}

async function fileRequest(path: string, token?: string | null) {
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || '文件读取失败')
  }
  const disposition = response.headers.get('Content-Disposition') || ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  return {
    blob: await response.blob(),
    fileName: encodedName ? decodeURIComponent(encodedName) : ''
  }
}

export const memberCrmAdminService = {
  list(params: URLSearchParams, token?: string | null) {
    return request<MemberCrmListResponse>(`?resource=members&${params.toString()}`, { token })
  },

  detail(userId: string, token?: string | null) {
    return request<MemberCrmDetail>(`?resource=detail&userId=${encodeURIComponent(userId)}`, { token })
  },

  saveProfile(userId: string, profile: MemberCrmProfile, token?: string | null) {
    return request<MemberCrmProfile>('?resource=profile', {
      method: 'PATCH', token, body: JSON.stringify({ userId, ...profile })
    })
  },

  saveService(userId: string, service: Partial<CrmServiceRecord>, token?: string | null) {
    return request<CrmServiceRecord>('?resource=services', {
      method: service.id ? 'PATCH' : 'POST', token, body: JSON.stringify({ userId, ...service })
    })
  },

  archiveService(userId: string, id: string, token?: string | null) {
    return request<{ id: string }>(`?resource=services&userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE', token
    })
  },

  createManualApplication(userId: string, application: Partial<CrmApplication>, token?: string | null) {
    return request<CrmApplication>('?resource=manual-applications', {
      method: 'POST', token, body: JSON.stringify({ userId, ...application })
    })
  },

  updateManualApplication(userId: string, application: Partial<CrmApplication> & { id: string }, token?: string | null) {
    return request<CrmApplication>('?resource=manual-applications', {
      method: 'PATCH', token, body: JSON.stringify({ userId, ...application })
    })
  },

  archiveManualApplication(userId: string, id: string, token?: string | null) {
    return request<{ id: string }>(`?resource=manual-applications&userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE', token
    })
  },

  addApplicationEvent(payload: {
    userId: string
    sourceKind: 'site' | 'manual'
    applicationId: string
    status: string
    note: string
    eventAt?: string
    nextFollowUpAt?: string | null
  }, token?: string | null) {
    return request('?resource=application-events', {
      method: 'POST', token, body: JSON.stringify(payload)
    })
  },

  uploadResume(userId: string, file: File, notes: string, token?: string | null) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('notes', notes)
    return request(`?resource=resumes&userId=${encodeURIComponent(userId)}`, {
      method: 'POST', token, body: formData
    })
  },

  deleteResume(userId: string, id: string, token?: string | null) {
    return request(`?resource=resumes&userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE', token
    })
  },

  getCrmResumeFile(id: string, token?: string | null, disposition: 'inline' | 'attachment' = 'attachment') {
    const query = new URLSearchParams({ resource: 'resume-file', id, disposition })
    return fileRequest(`/api/admin/member-crm?${query.toString()}`, token)
  },

  getUserResumeFile(id: string, token?: string | null) {
    return fileRequest(`/api/resumes?action=download&id=${encodeURIComponent(id)}`, token)
  }
}
