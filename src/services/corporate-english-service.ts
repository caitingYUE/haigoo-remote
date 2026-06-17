const API_BASE = '/api/corporate-english'
const CHUNK_SIZE = 1024 * 1024

export type CorporateEnglishStatus = 'draft' | 'published' | 'archived'
export type CorporateEnglishAssetKind = 'source_audio' | 'subtitle_csv' | 'clip_audio'

export interface CorporateEnglishSubtitleRow {
  source_title?: string
  subtitle_timecode: string
  subtitle_start_ms: number
  subtitle_text: string
  translation_text: string
}

export interface CorporateEnglishClipTag {
  title: string
  tags: string[]
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
  clipTags?: CorporateEnglishClipTag[]
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
  sourceAudioAssetId?: string
  subtitleCsvAssetId?: string
  normalizedSubtitleRows: CorporateEnglishSubtitleRow[]
  status: CorporateEnglishStatus
  clipCount: number
  durationMs?: number
  createdAt: string
  updatedAt: string
}

export interface CorporateEnglishMaterialDetail {
  material: CorporateEnglishMaterial
  clips: CorporateEnglishClip[]
  assets: CorporateEnglishAsset[]
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
  sourceAudioAssetId?: string | null
  subtitleCsvAssetId?: string | null
  normalizedSubtitleRows: CorporateEnglishSubtitleRow[]
  status: CorporateEnglishStatus
  durationMs?: number | null
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

  async getMaterial(id: string): Promise<CorporateEnglishMaterialDetail> {
    const query = new URLSearchParams({ resource: 'material', id })
    const data = await readJson<{ success: boolean } & CorporateEnglishMaterialDetail>(
      await fetch(`${API_BASE}?${query.toString()}`, { headers: getAuthHeaders() })
    )
    return { material: data.material, clips: data.clips || [], assets: data.assets || [] }
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
