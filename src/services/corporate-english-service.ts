const API_BASE = '/api/corporate-english'
const CHUNK_SIZE = 1024 * 1024

export type CorporateEnglishStatus = 'draft' | 'published' | 'archived'
export type CorporateEnglishAssetKind = 'source_audio' | 'subtitle_csv' | 'clip_audio'
export type CorporateEnglishAccessTier = 'free' | 'vip'
export type CorporateEnglishModuleKey = 'english_interview' | 'remote_preparation' | 'foreign_meeting'

export interface CorporateEnglishSubtitleRow {
  source_title?: string
  subtitle_timecode: string
  subtitle_start_ms: number
  subtitle_text: string
  translation_text: string
}

export interface CorporateEnglishSubtitleCue {
  startMs: number
  endMs: number
  subtitleText: string
  translationText: string
}

export interface CorporateEnglishClipTag {
  title: string
  tags: string[]
}

export type CorporateEnglishPronunciationMarkType = 'stress' | 'weak' | 'linking' | 'keyword' | 'pause'

export interface CorporateEnglishPronunciationMark {
  type: CorporateEnglishPronunciationMarkType
  text: string
  note?: string
}

export interface CorporateEnglishContentSection {
  title: string
  body: string
}

export interface CorporateEnglishResourceLink {
  title: string
  url: string
}

export interface CorporateEnglishCompanyProfile {
  companyId: string
  cultureSections: CorporateEnglishContentSection[]
  ceoThinkingSections: CorporateEnglishContentSection[]
  otherResources: CorporateEnglishResourceLink[]
  accessTier: CorporateEnglishAccessTier
  status: CorporateEnglishStatus
  sortOrder: number
  updatedAt?: string
}

export interface CorporateEnglishAsset {
  id: string
  assetId: string
  materialId?: string | null
  companyId?: string | null
  assetKind: CorporateEnglishAssetKind
  filename: string
  mimeType?: string
  sizeBytes: number
  sha256?: string
  uploadStatus: 'pending' | 'ready' | 'failed'
  uploadedChunks: number
  totalChunks?: number
}

export interface CorporateEnglishClip {
  id?: string
  clipId?: string
  materialId?: string
  companyId?: string
  clipAudioAssetId?: string | null
  sequence: number
  clipTitle?: string
  startMs: number
  endMs: number
  subtitleText: string
  translationText: string
  subtitleCues?: CorporateEnglishSubtitleCue[]
  clipTags?: CorporateEnglishClipTag[]
  pronunciationMarks?: CorporateEnglishPronunciationMark[]
  status: CorporateEnglishStatus
}

export interface CorporateEnglishMaterial {
  id: string
  materialId: string
  companyId: string
  companyName: string
  companyWebsite?: string
  materialTitle: string
  speakerName: string
  speakerRole: string
  speakerEmail?: string
  speakerLinkedin?: string
  tencentVideoVid?: string
  tencentVideoUrl?: string
  sourceVideoUrl?: string
  videoSummary?: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  coverImageHash?: string
  coverImageWidth?: number
  coverImageHeight?: number
  coverImageUpdatedAt?: string
  sequence?: number
  publishedAt?: string
  sourceAudioAssetId?: string
  subtitleCsvAssetId?: string
  normalizedSubtitleRows: CorporateEnglishSubtitleRow[]
  status: CorporateEnglishStatus
  clipCount: number
  durationMs?: number
  isFeatured?: boolean
  createdAt: string
  updatedAt: string
}

export interface CorporateEnglishMaterialDetail {
  material: CorporateEnglishMaterial
  clips: CorporateEnglishClip[]
  assets: CorporateEnglishAsset[]
}

export interface CorporateEnglishModuleVideo {
  id: string
  videoId: string
  moduleKey: CorporateEnglishModuleKey
  title: string
  description: string
  tencentIframeUrl: string
  videoSource: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  coverImageHash?: string
  coverImageWidth?: number
  coverImageHeight?: number
  coverImageUpdatedAt?: string
  category: string
  difficultyLevel?: string
  difficultyLevelLabel?: string
  videoNotes: CorporateEnglishVideoNoteBlock[]
  tags: string[]
  accessTier: CorporateEnglishAccessTier
  status: CorporateEnglishStatus
  sortOrder: number
  publishedAt: string
  isFeatured?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CorporateEnglishVideoNoteBlockType = 'heading_1' | 'heading_2' | 'paragraph' | 'bullet_list' | 'numbered_list' | 'quote'

export interface CorporateEnglishVideoNoteBlock {
  id: string
  type: CorporateEnglishVideoNoteBlockType
  text?: string
  items?: string[]
}

export interface SaveCorporateEnglishModuleVideoPayload {
  moduleKey: CorporateEnglishModuleKey
  title: string
  description?: string
  tencentIframeUrl: string
  videoSource?: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  category?: string
  difficultyLevel?: string
  videoNotes?: CorporateEnglishVideoNoteBlock[]
  tags?: string[]
  accessTier: CorporateEnglishAccessTier
  status: CorporateEnglishStatus
  sortOrder?: number
  publishedAt?: string
  isFeatured?: boolean
}

export interface SaveCorporateEnglishMaterialPayload {
  companyId: string
  companyName: string
  companyWebsite?: string
  materialTitle: string
  speakerName: string
  speakerRole: string
  speakerEmail?: string
  speakerLinkedin?: string
  tencentVideoVid?: string
  tencentVideoUrl?: string
  sourceVideoUrl?: string
  videoSummary?: string
  sequence?: number
  sourceAudioAssetId?: string | null
  subtitleCsvAssetId?: string | null
  normalizedSubtitleRows: CorporateEnglishSubtitleRow[]
  status: CorporateEnglishStatus
  durationMs?: number | null
  isFeatured?: boolean
  clips: CorporateEnglishClip[]
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

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.split(',')[1] || '')
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file chunk'))
    reader.readAsDataURL(blob)
  })
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function blobToSingleBase64(blob: Blob): Promise<string> {
  return blobToBase64(blob)
}

export const corporateEnglishService = {
  async listMaterials(params: {
    page?: number
    limit?: number
    search?: string
    companyId?: string
    status?: CorporateEnglishStatus | 'all'
  }) {
    const query = new URLSearchParams({ resource: 'materials' })
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.companyId) query.set('companyId', params.companyId)
    if (params.status && params.status !== 'all') query.set('status', params.status)

    return readJson<{
      success: boolean
      materials: CorporateEnglishMaterial[]
      total: number
      page: number
      totalPages: number
    }>(await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() }))
  },

  async listCompanyGroups(params: {
    page?: number
    limit?: number
    search?: string
    status?: CorporateEnglishStatus | 'all'
  }) {
    const query = new URLSearchParams({ resource: 'company-groups' })
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.status && params.status !== 'all') query.set('status', params.status)

    return readJson<{
      success: boolean
      companies: Array<{
        companyId: string
        companyName: string
        companyWebsite?: string
        status: CorporateEnglishStatus
        videoCount: number
        clipCount: number
        latestUpdatedAt?: string
        profile?: CorporateEnglishCompanyProfile | null
        materials: CorporateEnglishMaterial[]
      }>
      total: number
      page: number
      totalPages: number
    }>(await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() }))
  },

  async getCompanyProfile(companyId: string): Promise<CorporateEnglishCompanyProfile | null> {
    const query = new URLSearchParams({ resource: 'company-profile', companyId })
    const data = await readJson<{ success: boolean; profile: CorporateEnglishCompanyProfile | null }>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return data.profile
  },

  async saveCompanyProfile(payload: CorporateEnglishCompanyProfile) {
    const data = await readJson<{ success: boolean; profile: CorporateEnglishCompanyProfile }>(
      await fetch(`${API_BASE}?resource=company-profile`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      })
    )
    return data.profile
  },

  async getMaterial(id: string): Promise<CorporateEnglishMaterialDetail> {
    const query = new URLSearchParams({ resource: 'material', id })
    const data = await readJson<{ success: boolean } & CorporateEnglishMaterialDetail>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return { material: data.material, clips: data.clips || [], assets: data.assets || [] }
  },

  async listModuleVideos(params: {
    module: CorporateEnglishModuleKey
    page?: number
    limit?: number
    search?: string
    status?: CorporateEnglishStatus | 'all'
  }) {
    const query = new URLSearchParams({ resource: 'module-videos', module: params.module })
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.status && params.status !== 'all') query.set('status', params.status)

    return readJson<{
      success: boolean
      videos: CorporateEnglishModuleVideo[]
      total: number
      page: number
      totalPages: number
    }>(await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() }))
  },

  async saveModuleVideo(payload: SaveCorporateEnglishModuleVideoPayload, id?: string) {
    const query = new URLSearchParams({ resource: 'module-video' })
    if (id) query.set('id', id)
    const data = await readJson<{ success: boolean; video: CorporateEnglishModuleVideo }>(
      await fetch(`${API_BASE}?${query.toString()}`, {
        method: id ? 'PUT' : 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      })
    )
    return data.video
  },

  async deleteModuleVideo(id: string) {
    const query = new URLSearchParams({ resource: 'module-video', id })
    await readJson<{ success: boolean }>(
      await fetch(`${API_BASE}?${query.toString()}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
    )
  },

  async uploadCoverImage(params: {
    ownerType: 'material' | 'module_video'
    ownerId: string
    file: File
  }) {
    const contentBase64 = await blobToSingleBase64(params.file)
    const data = await readJson<{
      success: boolean
      cover: {
        ownerType: 'material' | 'module_video'
        ownerId: string
        coverImageHash: string
        coverImageWidth: number
        coverImageHeight: number
        coverImageUrl: string
        coverThumbnailUrl: string
      }
    }>(
      await fetch(`${API_BASE}?resource=cover-image`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          filename: params.file.name,
          mimeType: params.file.type || 'application/octet-stream',
          sizeBytes: params.file.size,
          contentBase64
        })
      })
    )
    return data.cover
  },

  async uploadAsset(params: {
    blob: Blob
    filename: string
    mimeType: string
    assetKind: CorporateEnglishAssetKind
    companyId?: string
    materialId?: string
    onProgress?: (progress: number) => void
  }): Promise<CorporateEnglishAsset> {
    const sha256 = await sha256Hex(params.blob)
    const totalChunks = Math.max(1, Math.ceil(params.blob.size / CHUNK_SIZE))
    const init = await readJson<{ success: boolean; asset: CorporateEnglishAsset }>(
      await fetch(`${API_BASE}?resource=asset-init`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          assetKind: params.assetKind,
          filename: params.filename,
          mimeType: params.mimeType,
          sizeBytes: params.blob.size,
          totalChunks,
          sha256,
          companyId: params.companyId,
          materialId: params.materialId
        })
      })
    )

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * CHUNK_SIZE
      const chunk = params.blob.slice(start, Math.min(start + CHUNK_SIZE, params.blob.size))
      const chunkBase64 = await blobToBase64(chunk)
      await readJson<{ success: boolean; asset: CorporateEnglishAsset }>(
        await fetch(`${API_BASE}?resource=asset-chunk`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            assetId: init.asset.assetId,
            chunkIndex: index,
            chunkBase64
          })
        })
      )
      params.onProgress?.(Math.round(((index + 1) / totalChunks) * 100))
    }

    const complete = await readJson<{ success: boolean; asset: CorporateEnglishAsset }>(
      await fetch(`${API_BASE}?resource=asset-complete`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          assetId: init.asset.assetId,
          sizeBytes: params.blob.size,
          sha256
        })
      })
    )
    return complete.asset
  },

  async saveMaterial(payload: SaveCorporateEnglishMaterialPayload, id?: string) {
    const query = new URLSearchParams({ resource: 'material' })
    if (id) query.set('id', id)
    const data = await readJson<{ success: boolean; materialId: string }>(
      await fetch(`${API_BASE}?${query.toString()}`, {
        method: id ? 'PUT' : 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      })
    )
    return data.materialId
  },

  async deleteMaterial(id: string) {
    const query = new URLSearchParams({ resource: 'material', id })
    await readJson<{ success: boolean }>(
      await fetch(`${API_BASE}?${query.toString()}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
    )
  },

  async downloadAsset(assetId: string): Promise<Blob> {
    const query = new URLSearchParams({ resource: 'asset', id: assetId })
    const response = await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.error || '下载失败')
    }
    return response.blob()
  }
}
