import type { CorporateEnglishClipTag, CorporateEnglishPronunciationMark } from './corporate-english-service'
import type { CorporateEnglishAccessTier, CorporateEnglishModuleKey } from './corporate-english-service'

const API_BASE = '/api/corporate-english-public'

export interface CorporateEnglishPublicCompany {
  companyId: string
  name: string
  website?: string
  logo?: string
  originalLogoUrl?: string
  cachedLogoUrl?: string
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
  requiredPlan?: 'starter' | 'half_year' | 'annual' | ''
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
  sourceVideoUrl?: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  coverImageHash?: string
  coverImageWidth?: number
  coverImageHeight?: number
  coverImageUpdatedAt?: string
  accessTier?: CorporateEnglishAccessTier
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

export interface CorporateEnglishPublicModuleVideo {
  id: string
  videoId: string
  moduleKey: CorporateEnglishModuleKey
  title: string
  description: string
  videoSource?: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  coverImageHash?: string
  coverImageWidth?: number
  coverImageHeight?: number
  coverImageUpdatedAt?: string
  category: string
  difficultyLevel?: string
  difficultyLevelLabel?: string
  tags: string[]
  accessTier: CorporateEnglishAccessTier
  durationMs?: number
  publishedAt?: string
  sortOrder: number
  tencentIframeUrl?: string
  isLocked: boolean
  loginRequired: boolean
  upgradeRequired: boolean
  lockReason?: string
}

export interface CorporateEnglishPublicCeoVideo {
  id: string
  materialId: string
  companyId: string
  companyName: string
  companyWebsite?: string
  companyLogo?: string
  companyIndustry?: string
  materialTitle: string
  speakerName: string
  speakerRole: string
  videoSummary?: string
  sequence: number
  clipCount: number
  durationMs?: number
  publishedAt?: string
  updatedAt?: string
  accessTier?: CorporateEnglishAccessTier
  coverImageUrl?: string
  coverThumbnailUrl?: string
  coverImageHash?: string
  tencentVideoUrl?: string
  sourceVideoUrl?: string
  isVideoLocked?: boolean
  loginRequired?: boolean
  upgradeRequired?: boolean
  lockReason?: string
}

export interface CorporateEnglishPublicCategory {
  label: string
  value: string
  count: number
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
      requiredForVideos: 'starter'
      requiredForProfile: 'starter'
      requiredForClips: 'starter'
      requiredForResources: 'starter'
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

  async listCeoVideos() {
    const query = new URLSearchParams({ resource: 'ceo-videos' })
    const data = await readJson<{ success: boolean; videos: CorporateEnglishPublicCeoVideo[] }>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return data.videos || []
  },

  async listModuleVideos(params: {
    module: CorporateEnglishModuleKey
    category?: string
    difficultyLevel?: string
    limit?: number
  }) {
    const query = new URLSearchParams({ resource: 'module-videos', module: params.module })
    if (params.category) query.set('category', params.category)
    if (params.difficultyLevel) query.set('difficultyLevel', params.difficultyLevel)
    if (params.limit) query.set('limit', String(params.limit))
    const data = await readJson<{
      success: boolean
      categories: CorporateEnglishPublicCategory[]
      videos: CorporateEnglishPublicModuleVideo[]
    }>(await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() }))
    return {
      categories: data.categories || [],
      videos: data.videos || []
    }
  },

  async getCeoVideo(materialId: string): Promise<CorporateEnglishCompanyDetail> {
    const query = new URLSearchParams({ resource: 'ceo-video', materialId })
    const data = await readJson<{ success: boolean } & CorporateEnglishCompanyDetail>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return data
  },

  async getModuleVideo(videoId: string): Promise<{
    video: CorporateEnglishPublicModuleVideo
    recommendations: CorporateEnglishPublicModuleVideo[]
  }> {
    const query = new URLSearchParams({ resource: 'module-video', videoId })
    const data = await readJson<{
      success: boolean
      video: CorporateEnglishPublicModuleVideo
      recommendations: CorporateEnglishPublicModuleVideo[]
    }>(await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() }))
    return {
      video: data.video,
      recommendations: data.recommendations || []
    }
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
