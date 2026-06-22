import type { CorporateEnglishClipTag, CorporateEnglishPronunciationMark } from './corporate-english-service'

const API_BASE = '/api/corporate-english-public'

export interface CorporateEnglishPublicCompany {
  companyId: string
  name: string
  website?: string
  logo?: string
  industry?: string
  description?: string
  jobCount?: number
  videoCount?: number
  clipCount?: number
  accessTier?: 'free' | 'vip'
  latestUpdatedAt?: string
}

export interface CorporateEnglishPublicClip {
  id: string
  clipId: string
  materialId: string
  companyId: string
  sequence: number
  clipTitle: string
  startMs: number
  endMs: number
  subtitleText: string
  translationText: string
  clipTags: CorporateEnglishClipTag[]
  pronunciationMarks: CorporateEnglishPronunciationMark[]
  subtitleCues?: Array<{
    startMs: number
    endMs: number
    subtitleText: string
    translationText: string
  }>
  audioUrl: string
  hasAudio?: boolean
  audioUnavailableReason?: string
  isFavorited: boolean
  isLocked?: boolean
  lockReason?: string
  requiredPlan?: 'half_year' | 'annual' | ''
  materialTitle?: string
  companyName?: string
  speakerName?: string
  savedAt?: string
}

export interface CorporateEnglishPublicVideo {
  id: string
  materialId: string
  companyId: string
  materialTitle: string
  speakerName: string
  speakerRole: string
  speakerEmail?: string
  speakerLinkedin?: string
  hasSpeakerEmail?: boolean
  hasSpeakerLinkedin?: boolean
  tencentVideoVid?: string
  tencentVideoUrl?: string
  isVideoLocked?: boolean
  videoLockReason?: string
  videoSummary?: string
  sequence: number
  clipCount: number
  durationMs?: number
  publishedAt?: string
  updatedAt?: string
  clips: CorporateEnglishPublicClip[]
}

export interface CorporateEnglishPublicSection {
  title: string
  body: string
}

export interface CorporateEnglishPublicResourceLink {
  title: string
  url: string
}

export interface CorporateEnglishCompanyDetail {
  company: CorporateEnglishPublicCompany
  permissions?: {
    accessTier: 'free' | 'vip'
    isAuthenticated: boolean
    canViewVideos: boolean
    canViewProfile: boolean
    canViewClips: boolean
    canViewResources: boolean
    canViewSpeakerContacts: boolean
    canUseFreeSample: boolean
      requiredForVideos: 'half_year'
      requiredForProfile: 'half_year'
      requiredForClips: 'half_year'
      requiredForResources: 'half_year'
    }
  profile: {
    cultureSections: CorporateEnglishPublicSection[]
    ceoThinkingSections: CorporateEnglishPublicSection[]
    otherResources: CorporateEnglishPublicResourceLink[]
  }
  videos: CorporateEnglishPublicVideo[]
  jobs: Array<{
    id: string
    title: string
    originalTitle?: string
    company?: string
    companyId?: string
    location?: string
    jobType?: string
    category?: string
    salary?: string
    url?: string
    createdAt?: string
    isTranslated?: boolean
    translatedAt?: string
  }>
  favorites: CorporateEnglishPublicClip[]
}

function getAuthHeaders(extra: Record<string, string> = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('haigoo_auth_token') : ''
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed: ${response.status}`)
  }
  return data as T
}

export const corporateEnglishPublicService = {
  async listCompanies() {
    const query = new URLSearchParams({ resource: 'companies' })
    const data = await readJson<{ success: boolean; companies: CorporateEnglishPublicCompany[] }>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return data.companies || []
  },

  async getCompany(companyId: string): Promise<CorporateEnglishCompanyDetail> {
    const query = new URLSearchParams({ resource: 'company', companyId })
    const data = await readJson<{ success: boolean } & CorporateEnglishCompanyDetail>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return data
  },

  async listFavorites(): Promise<CorporateEnglishPublicClip[]> {
    const query = new URLSearchParams({ resource: 'favorites' })
    const data = await readJson<{ success: boolean; favorites: CorporateEnglishPublicClip[] }>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return data.favorites || []
  },

  async addFavorite(clipId: string) {
    const query = new URLSearchParams({ resource: 'favorite', clipId })
    await readJson<{ success: boolean }>(
      await fetch(`${API_BASE}?${query.toString()}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      })
    )
  },

  async removeFavorite(clipId: string) {
    const query = new URLSearchParams({ resource: 'favorite', clipId })
    await readJson<{ success: boolean }>(
      await fetch(`${API_BASE}?${query.toString()}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
    )
  },

  async downloadClipAudio(clipId: string): Promise<Blob> {
    const query = new URLSearchParams({ resource: 'clip-audio', clipId })
    const response = await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.error || '音频加载失败')
    }
    return response.blob()
  }
}
