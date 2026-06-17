import crypto from 'node:crypto'
import neonHelper from '../server-utils/dal/neon-helper.js'
import { extractToken, verifyToken } from '../server-utils/auth-helpers.js'
import userHelper from '../server-utils/user-helper.js'
import { SUPER_ADMIN_EMAILS } from '../server-utils/admin-config.js'

const MATERIALS_TABLE = 'corporate_english_materials'
const ASSETS_TABLE = 'corporate_english_assets'
const CLIPS_TABLE = 'corporate_english_clips'

const MAX_CLIP_BYTES = 3 * 1024 * 1024
const MAX_CHUNK_BYTES = 1024 * 1024
const MAX_CLIPS_PER_MATERIAL = 50
const VALID_ASSET_KINDS = new Set(['clip_audio'])
const VALID_STATUSES = new Set(['draft', 'published', 'archived'])

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeStatus(status) {
  const next = normalizeString(status) || 'draft'
  return VALID_STATUSES.has(next) ? next : 'draft'
}

function normalizeClipTags(tags) {
  if (!Array.isArray(tags)) return []
  return tags
    .slice(0, 12)
    .map((group, index) => {
      const title = normalizeString(group?.title || `标签组 ${index + 1}`).slice(0, 40)
      const values = Array.isArray(group?.tags) ? group.tags : []
      return {
        title,
        tags: values
          .map((tag) => normalizeString(tag).replace(/^#+/, '').slice(0, 60))
          .filter(Boolean)
          .slice(0, 20)
      }
    })
    .filter((group) => group.title && group.tags.length > 0)
}

function toInt(value, fallback = 0) {
  const next = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(next) ? next : fallback
}

function mapMaterialRow(row) {
  if (!row) return null
  return {
    id: row.material_id,
    materialId: row.material_id,
    companyId: row.company_id,
    companyName: row.company_name_snapshot,
    companyWebsite: row.company_website_snapshot,
    materialTitle: row.material_title,
    speakerName: row.speaker_name,
    speakerRole: row.speaker_role,
    speakerEmail: row.speaker_email,
    speakerLinkedin: row.speaker_linkedin,
    sourceAudioAssetId: row.source_audio_asset_id,
    subtitleCsvAssetId: row.subtitle_csv_asset_id,
    normalizedSubtitleRows: Array.isArray(row.normalized_subtitle_rows) ? row.normalized_subtitle_rows : [],
    status: row.status,
    clipCount: Number(row.clip_count || 0),
    durationMs: row.duration_ms,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapClipRow(row) {
  return {
    id: row.clip_id,
    clipId: row.clip_id,
    materialId: row.material_id,
    companyId: row.company_id,
    clipAudioAssetId: row.clip_audio_asset_id,
    sequence: Number(row.sequence || 0),
    clipTitle: row.clip_title || '',
    startMs: Number(row.start_ms || 0),
    endMs: Number(row.end_ms || 0),
    subtitleText: row.subtitle_text || '',
    translationText: row.translation_text || '',
    clipTags: Array.isArray(row.clip_tags) ? row.clip_tags : [],
    status: row.status || 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapAssetRow(row) {
  if (!row) return null
  return {
    id: row.asset_id,
    assetId: row.asset_id,
    materialId: row.material_id,
    companyId: row.company_id,
    assetKind: row.asset_kind,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes || 0),
    sha256: row.sha256,
    uploadStatus: row.upload_status,
    uploadedChunks: Number(row.uploaded_chunks || 0),
    totalChunks: row.total_chunks,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function resolveAdmin(req) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  if (!payload?.userId && !payload?.email) return null

  const payloadEmail = normalizeString(payload.email).toLowerCase()
  if (payload?.isAdmin || payload?.role === 'admin' || SUPER_ADMIN_EMAILS.includes(payloadEmail)) {
    return { id: payload.userId || payload.email, email: payload.email, payload }
  }

  if (payload.userId) {
    try {
      const user = await userHelper.getUserById(payload.userId)
      const email = normalizeString(user?.email).toLowerCase()
      const isAdmin = Boolean(user?.roles?.admin || SUPER_ADMIN_EMAILS.includes(email))
      if (isAdmin) return { id: payload.userId, email: user?.email, user, payload }
    } catch (error) {
      console.warn('[corporate-english] Failed to resolve admin user:', error?.message || error)
    }
  }
  return null
}

function getAssetLimit(assetKind) {
  if (assetKind === 'clip_audio') return MAX_CLIP_BYTES
  return 0
}

function decodeBase64Chunk(base64) {
  const normalized = normalizeString(base64).replace(/^data:[^;]+;base64,/, '')
  return Buffer.from(normalized, 'base64')
}

function validateMaterialPayload(body) {
  const companyId = normalizeString(body.companyId || body.company_id)
  const companyName = normalizeString(body.companyName || body.company_name_snapshot)
  const materialTitle = normalizeString(body.materialTitle || body.material_title)
  const speakerName = normalizeString(body.speakerName || body.speaker_name)
  const speakerRole = normalizeString(body.speakerRole || body.speaker_role)
  const clips = Array.isArray(body.clips) ? body.clips : []

  if (!companyId) return { error: '请选择可信企业' }
  if (!companyName) return { error: '缺少企业名称' }
  if (!materialTitle) return { error: '请填写素材标题' }
  if (!speakerName) return { error: '请填写素材人物名称' }
  if (!speakerRole) return { error: '请填写人物职业' }
  if (clips.length === 0) return { error: '请至少配置并保存一个剪辑片段' }
  if (clips.length > MAX_CLIPS_PER_MATERIAL) return { error: `单个素材最多支持 ${MAX_CLIPS_PER_MATERIAL} 个剪辑段` }

  for (const [index, clip] of clips.entries()) {
    const startMs = toInt(clip.startMs ?? clip.start_ms, -1)
    const endMs = toInt(clip.endMs ?? clip.end_ms, -1)
    if (startMs < 0 || endMs <= startMs) {
      return { error: `第 ${index + 1} 段剪辑时间无效` }
    }
  }

  return { error: null }
}

async function ensureTrustedCompany(companyId) {
  const rows = await neonHelper.query(
    `SELECT company_id, name, website
     FROM trusted_companies
     WHERE company_id = $1
     LIMIT 1`,
    [companyId]
  )
  return rows?.[0] || null
}

async function assertAssetsReady(assetIds) {
  const ids = [...new Set(assetIds.filter(Boolean))]
  if (ids.length === 0) return
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(',')
  const rows = await neonHelper.query(
    `SELECT asset_id, upload_status FROM ${ASSETS_TABLE} WHERE asset_id IN (${placeholders})`,
    ids
  )
  const ready = new Set((rows || []).filter((row) => row.upload_status === 'ready').map((row) => String(row.asset_id)))
  const missing = ids.filter((id) => !ready.has(String(id)))
  if (missing.length > 0) {
    throw new Error('存在尚未上传完成的音频或字幕文件')
  }
}

async function listMaterials(req, res) {
  const page = Math.max(toInt(req.query.page, 1), 1)
  const limit = Math.min(Math.max(toInt(req.query.limit, 20), 1), 50)
  const offset = (page - 1) * limit
  const params = []
  const conditions = ['m.deleted_at IS NULL']

  const search = normalizeString(req.query.search).toLowerCase()
  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(
      LOWER(m.material_title) LIKE $${params.length}
      OR LOWER(m.company_name_snapshot) LIKE $${params.length}
      OR LOWER(m.speaker_name) LIKE $${params.length}
      OR LOWER(m.speaker_role) LIKE $${params.length}
      OR EXISTS (
        SELECT 1 FROM ${CLIPS_TABLE} c
        WHERE c.material_id = m.material_id
          AND LOWER(c.clip_tags::text) LIKE $${params.length}
      )
    )`)
  }

  const companyId = normalizeString(req.query.companyId || req.query.company_id)
  if (companyId) {
    params.push(companyId)
    conditions.push(`m.company_id = $${params.length}`)
  }

  const status = normalizeString(req.query.status)
  if (status && status !== 'all') {
    params.push(normalizeStatus(status))
    conditions.push(`m.status = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countRows = await neonHelper.query(
    `SELECT COUNT(*)::int AS total FROM ${MATERIALS_TABLE} m ${where}`,
    params
  )
  const total = Number(countRows?.[0]?.total || 0)

  params.push(limit, offset)
  const rows = await neonHelper.query(
    `SELECT m.*
     FROM ${MATERIALS_TABLE} m
     ${where}
     ORDER BY m.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return res.status(200).json({
    success: true,
    materials: (rows || []).map(mapMaterialRow),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit))
  })
}

async function getMaterial(req, res) {
  const id = normalizeString(req.query.id)
  if (!id) return res.status(400).json({ success: false, error: 'Missing material id' })

  const rows = await neonHelper.query(
    `SELECT * FROM ${MATERIALS_TABLE} WHERE material_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  )
  const material = mapMaterialRow(rows?.[0])
  if (!material) return res.status(404).json({ success: false, error: 'Material not found' })

  const [clipRows, assetRows] = await Promise.all([
    neonHelper.query(
      `SELECT * FROM ${CLIPS_TABLE} WHERE material_id = $1 ORDER BY sequence ASC, created_at ASC`,
      [id]
    ),
    neonHelper.query(
      `SELECT asset_id, material_id, company_id, asset_kind, filename, mime_type, size_bytes, sha256, upload_status, uploaded_chunks, total_chunks, created_at, updated_at
       FROM ${ASSETS_TABLE}
       WHERE material_id = $1 OR asset_id IN ($2, $3)
       ORDER BY created_at ASC`,
      [id, material.sourceAudioAssetId, material.subtitleCsvAssetId]
    )
  ])

  return res.status(200).json({
    success: true,
    material,
    clips: (clipRows || []).map(mapClipRow),
    assets: (assetRows || []).map(mapAssetRow)
  })
}

async function initAsset(req, res, admin) {
  const body = req.body || {}
  const assetKind = normalizeString(body.assetKind || body.asset_kind)
  if (!VALID_ASSET_KINDS.has(assetKind)) return res.status(400).json({ success: false, error: 'Invalid asset kind' })

  const filename = normalizeString(body.filename) || 'upload.bin'
  const mimeType = normalizeString(body.mimeType || body.mime_type) || 'application/octet-stream'
  const totalChunks = Math.max(toInt(body.totalChunks || body.total_chunks, 1), 1)
  const expectedSize = toInt(body.sizeBytes || body.size_bytes, 0)
  const limit = getAssetLimit(assetKind)
  if (expectedSize <= 0 || expectedSize > limit) {
    return res.status(400).json({ success: false, error: '文件大小超出 V1 限制' })
  }

  const rows = await neonHelper.query(
    `INSERT INTO ${ASSETS_TABLE}
       (asset_kind, filename, mime_type, content, size_bytes, sha256, upload_status, uploaded_chunks, total_chunks, company_id, material_id, created_by, updated_at)
     VALUES ($1, $2, $3, NULL, 0, $4, 'pending', 0, $5, $6, $7, $8, NOW())
     RETURNING asset_id, asset_kind, filename, mime_type, size_bytes, upload_status, uploaded_chunks, total_chunks, created_at, updated_at`,
    [
      assetKind,
      filename,
      mimeType,
      normalizeString(body.sha256) || null,
      totalChunks,
      normalizeString(body.companyId || body.company_id) || null,
      normalizeString(body.materialId || body.material_id) || null,
      admin.id || admin.email || 'admin'
    ]
  )

  return res.status(200).json({ success: true, asset: mapAssetRow(rows?.[0]) })
}

async function appendAssetChunk(req, res) {
  const body = req.body || {}
  const assetId = normalizeString(body.assetId || body.asset_id)
  if (!assetId) return res.status(400).json({ success: false, error: 'Missing asset id' })

  const chunk = decodeBase64Chunk(body.chunkBase64 || body.chunk_base64)
  if (chunk.length <= 0 || chunk.length > MAX_CHUNK_BYTES + 1024) {
    return res.status(400).json({ success: false, error: 'Invalid chunk size' })
  }

  const assetRows = await neonHelper.query(
    `SELECT asset_kind, upload_status FROM ${ASSETS_TABLE} WHERE asset_id = $1 LIMIT 1`,
    [assetId]
  )
  const asset = assetRows?.[0]
  if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' })
  if (asset.upload_status !== 'pending') return res.status(400).json({ success: false, error: 'Asset upload is not pending' })

  const rows = await neonHelper.query(
    `UPDATE ${ASSETS_TABLE}
     SET content = CASE WHEN content IS NULL THEN $2::bytea ELSE content || $2::bytea END,
         size_bytes = COALESCE(octet_length(content), 0) + $3,
         uploaded_chunks = uploaded_chunks + 1,
         updated_at = NOW()
     WHERE asset_id = $1
     RETURNING asset_id, asset_kind, filename, mime_type, size_bytes, upload_status, uploaded_chunks, total_chunks, created_at, updated_at`,
    [assetId, chunk, chunk.length]
  )

  const updated = rows?.[0]
  const limit = getAssetLimit(updated?.asset_kind)
  if (Number(updated?.size_bytes || 0) > limit) {
    await neonHelper.query(`UPDATE ${ASSETS_TABLE} SET upload_status = 'failed', updated_at = NOW() WHERE asset_id = $1`, [assetId])
    return res.status(400).json({ success: false, error: '文件大小超出 V1 限制' })
  }

  return res.status(200).json({ success: true, asset: mapAssetRow(updated) })
}

async function completeAsset(req, res) {
  const body = req.body || {}
  const assetId = normalizeString(body.assetId || body.asset_id)
  const expectedSize = toInt(body.sizeBytes || body.size_bytes, 0)
  const expectedSha = normalizeString(body.sha256)
  if (!assetId || expectedSize <= 0) return res.status(400).json({ success: false, error: 'Missing asset completion data' })

  const rows = await neonHelper.query(
    `SELECT asset_id, asset_kind, filename, mime_type, content, size_bytes, sha256, upload_status, uploaded_chunks, total_chunks, created_at, updated_at
     FROM ${ASSETS_TABLE}
     WHERE asset_id = $1
     LIMIT 1`,
    [assetId]
  )
  const asset = rows?.[0]
  if (!asset?.content) return res.status(404).json({ success: false, error: 'Asset content not found' })

  const content = Buffer.isBuffer(asset.content) ? asset.content : Buffer.from(asset.content)
  const actualSha = crypto.createHash('sha256').update(content).digest('hex')
  if (content.length !== expectedSize) {
    return res.status(400).json({ success: false, error: '上传大小校验失败' })
  }
  if (expectedSha && actualSha !== expectedSha) {
    return res.status(400).json({ success: false, error: '上传 hash 校验失败' })
  }

  const updatedRows = await neonHelper.query(
    `UPDATE ${ASSETS_TABLE}
     SET size_bytes = $2,
         sha256 = $3,
         upload_status = 'ready',
         updated_at = NOW()
     WHERE asset_id = $1
     RETURNING asset_id, asset_kind, filename, mime_type, size_bytes, sha256, upload_status, uploaded_chunks, total_chunks, created_at, updated_at`,
    [assetId, content.length, actualSha]
  )

  return res.status(200).json({ success: true, asset: mapAssetRow(updatedRows?.[0]) })
}

async function saveMaterial(req, res, admin, existingId = null) {
  const body = req.body || {}
  const validation = validateMaterialPayload(body)
  if (validation.error) return res.status(400).json({ success: false, error: validation.error })

  const companyId = normalizeString(body.companyId || body.company_id)
  const company = await ensureTrustedCompany(companyId)
  if (!company) return res.status(400).json({ success: false, error: '请选择有效的可信企业' })

  const sourceAudioAssetId = normalizeString(body.sourceAudioAssetId || body.source_audio_asset_id) || null
  const subtitleCsvAssetId = normalizeString(body.subtitleCsvAssetId || body.subtitle_csv_asset_id) || null
  const clips = Array.isArray(body.clips) ? body.clips : []
  await assertAssetsReady([sourceAudioAssetId, subtitleCsvAssetId, ...clips.map((clip) => normalizeString(clip.clipAudioAssetId || clip.clip_audio_asset_id))])

  const payload = {
    companyId,
    companyName: normalizeString(body.companyName) || company.name,
    companyWebsite: normalizeString(body.companyWebsite) || company.website || null,
    materialTitle: normalizeString(body.materialTitle || body.material_title),
    speakerName: normalizeString(body.speakerName || body.speaker_name),
    speakerRole: normalizeString(body.speakerRole || body.speaker_role),
    speakerEmail: normalizeString(body.speakerEmail || body.speaker_email) || null,
    speakerLinkedin: normalizeString(body.speakerLinkedin || body.speaker_linkedin) || null,
    sourceAudioAssetId,
    subtitleCsvAssetId,
    normalizedSubtitleRows: Array.isArray(body.normalizedSubtitleRows || body.normalized_subtitle_rows)
      ? (body.normalizedSubtitleRows || body.normalized_subtitle_rows)
      : [],
    status: normalizeStatus(body.status),
    durationMs: toInt(body.durationMs || body.duration_ms, 0) || null,
    actor: admin.id || admin.email || 'admin'
  }

  let materialId = existingId
  if (materialId) {
    const rows = await neonHelper.query(
      `UPDATE ${MATERIALS_TABLE}
       SET company_id = $2,
           company_name_snapshot = $3,
           company_website_snapshot = $4,
           material_title = $5,
           speaker_name = $6,
           speaker_role = $7,
           speaker_email = $8,
           speaker_linkedin = $9,
           source_audio_asset_id = $10,
           subtitle_csv_asset_id = $11,
           normalized_subtitle_rows = $12::jsonb,
           status = $13,
           clip_count = $14,
           duration_ms = $15,
           updated_by = $16,
           updated_at = NOW()
       WHERE material_id = $1 AND deleted_at IS NULL
       RETURNING material_id`,
      [
        materialId,
        payload.companyId,
        payload.companyName,
        payload.companyWebsite,
        payload.materialTitle,
        payload.speakerName,
        payload.speakerRole,
        payload.speakerEmail,
        payload.speakerLinkedin,
        payload.sourceAudioAssetId,
        payload.subtitleCsvAssetId,
        JSON.stringify(payload.normalizedSubtitleRows),
        payload.status,
        clips.length,
        payload.durationMs,
        payload.actor
      ]
    )
    if (!rows?.[0]) return res.status(404).json({ success: false, error: 'Material not found' })
    await neonHelper.query(`DELETE FROM ${CLIPS_TABLE} WHERE material_id = $1`, [materialId])
  } else {
    const rows = await neonHelper.query(
      `INSERT INTO ${MATERIALS_TABLE}
         (company_id, company_name_snapshot, company_website_snapshot, material_title, speaker_name, speaker_role,
          speaker_email, speaker_linkedin, source_audio_asset_id, subtitle_csv_asset_id, normalized_subtitle_rows,
          status, clip_count, duration_ms, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $15)
       RETURNING material_id`,
      [
        payload.companyId,
        payload.companyName,
        payload.companyWebsite,
        payload.materialTitle,
        payload.speakerName,
        payload.speakerRole,
        payload.speakerEmail,
        payload.speakerLinkedin,
        payload.sourceAudioAssetId,
        payload.subtitleCsvAssetId,
        JSON.stringify(payload.normalizedSubtitleRows),
        payload.status,
        clips.length,
        payload.durationMs,
        payload.actor
      ]
    )
    materialId = rows?.[0]?.material_id
  }

  await neonHelper.query(
    `UPDATE ${ASSETS_TABLE}
     SET material_id = $1, company_id = $2, updated_at = NOW()
     WHERE asset_id IN (${[sourceAudioAssetId, subtitleCsvAssetId, ...clips.map((clip) => normalizeString(clip.clipAudioAssetId || clip.clip_audio_asset_id))]
      .filter(Boolean)
      .map((_, index) => `$${index + 3}`)
      .join(',') || 'NULL'})`,
    [materialId, payload.companyId, ...[sourceAudioAssetId, subtitleCsvAssetId, ...clips.map((clip) => normalizeString(clip.clipAudioAssetId || clip.clip_audio_asset_id))].filter(Boolean)]
  )

  for (const [index, clip] of clips.entries()) {
    await neonHelper.query(
      `INSERT INTO ${CLIPS_TABLE}
         (material_id, company_id, clip_audio_asset_id, sequence, clip_title, start_ms, end_ms, subtitle_text, translation_text, clip_tags, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
      [
        materialId,
        payload.companyId,
        normalizeString(clip.clipAudioAssetId || clip.clip_audio_asset_id) || null,
        toInt(clip.sequence, index),
        normalizeString(clip.clipTitle || clip.clip_title),
        toInt(clip.startMs || clip.start_ms, 0),
        toInt(clip.endMs || clip.end_ms, 0),
        String(clip.subtitleText || clip.subtitle_text || ''),
        String(clip.translationText || clip.translation_text || ''),
        JSON.stringify(normalizeClipTags(clip.clipTags || clip.clip_tags)),
        normalizeStatus(clip.status || payload.status)
      ]
    )
  }

  return res.status(existingId ? 200 : 201).json({ success: true, materialId })
}

async function deleteMaterial(req, res, admin) {
  const id = normalizeString(req.query.id || req.body?.id)
  if (!id) return res.status(400).json({ success: false, error: 'Missing material id' })
  const rows = await neonHelper.query(
    `UPDATE ${MATERIALS_TABLE}
     SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
     WHERE material_id = $1 AND deleted_at IS NULL
     RETURNING material_id`,
    [id, admin.id || admin.email || 'admin']
  )
  if (!rows?.[0]) return res.status(404).json({ success: false, error: 'Material not found' })
  return res.status(200).json({ success: true })
}

async function downloadAsset(req, res) {
  const id = normalizeString(req.query.id)
  if (!id) return res.status(400).json({ success: false, error: 'Missing asset id' })
  const rows = await neonHelper.query(
    `SELECT asset_id, filename, mime_type, content, size_bytes, sha256, upload_status
     FROM ${ASSETS_TABLE}
     WHERE asset_id = $1 AND upload_status = 'ready'
     LIMIT 1`,
    [id]
  )
  const asset = rows?.[0]
  if (!asset?.content) return res.status(404).json({ success: false, error: 'Asset not found' })
  const content = Buffer.isBuffer(asset.content) ? asset.content : Buffer.from(asset.content)
  res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
  res.setHeader('Content-Length', String(content.length))
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.filename || 'asset.bin')}"`)
  res.setHeader('Cache-Control', 'private, max-age=300')
  if (asset.sha256) res.setHeader('ETag', `"${asset.sha256}"`)
  return res.status(200).send(content)
}

export default async function handler(req, res) {
  sendCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const admin = await resolveAdmin(req)
  if (!admin) return res.status(403).json({ success: false, error: 'Forbidden' })
  if (!neonHelper.isConfigured) return res.status(500).json({ success: false, error: 'Database not configured' })

  try {
    const resource = normalizeString(req.query.resource || 'materials')

    if (req.method === 'GET' && resource === 'materials') return await listMaterials(req, res)
    if (req.method === 'GET' && resource === 'material') return await getMaterial(req, res)
    if (req.method === 'GET' && resource === 'asset') return await downloadAsset(req, res)
    if (req.method === 'POST' && resource === 'asset-init') return await initAsset(req, res, admin)
    if (req.method === 'POST' && resource === 'asset-chunk') return await appendAssetChunk(req, res)
    if (req.method === 'POST' && resource === 'asset-complete') return await completeAsset(req, res)
    if (req.method === 'POST' && resource === 'material') return await saveMaterial(req, res, admin)
    if (req.method === 'PUT' && resource === 'material') return await saveMaterial(req, res, admin, normalizeString(req.query.id || req.body?.id))
    if (req.method === 'DELETE' && resource === 'material') return await deleteMaterial(req, res, admin)

    return res.status(404).json({ success: false, error: 'Resource not found' })
  } catch (error) {
    console.error('[corporate-english] Handler error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
