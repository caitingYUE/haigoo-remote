import neonHelper from '../server-utils/dal/neon-helper.js'
import userHelper from '../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../server-utils/auth-helpers.js'
import { deriveMembershipCapabilities } from '../lib/shared/membership.js'

const MATERIALS_TABLE = 'corporate_english_materials'
const ASSETS_TABLE = 'corporate_english_assets'
const CLIPS_TABLE = 'corporate_english_clips'
const PROFILES_TABLE = 'corporate_english_company_profiles'
const FAVORITES_TABLE = 'corporate_english_clip_favorites'

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function normalizeString(value) {
  return String(value || '').trim()
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

function mapSections(value) {
  return Array.isArray(value) ? value : []
}

function mapResourceLinks(value) {
  return Array.isArray(value) ? value : []
}

function isLocalPreviewRequest(req) {
  const host = String(req?.headers?.host || req?.headers?.['x-forwarded-host'] || '').toLowerCase()
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]')
}

function statusClause(alias, includeDrafts) {
  return includeDrafts ? `${alias}.status <> 'archived'` : `${alias}.status = 'published'`
}

function normalizeAccessTier(value) {
  return value === 'free' ? 'free' : 'vip'
}

function getUserId(user) {
  return user?.userId || user?.user_id || user?.id || ''
}

function getPermissions(user, companyAccessTier = 'vip') {
  const capabilities = deriveMembershipCapabilities(user)
  const isAuthenticated = Boolean(user)
  const isFreeCompany = normalizeAccessTier(companyAccessTier) === 'free'
  const hasFullCorporateEnglish = capabilities.isActive && (
    ['quarter', 'quarter_pro', 'year', 'half_year', 'annual'].includes(capabilities.memberType) ||
    capabilities.canAccessCorporateEnglishVideos ||
    capabilities.canAccessCorporateEnglishProfile ||
    capabilities.canAccessCorporateEnglishClips ||
    capabilities.canAccessCorporateEnglishResources
  )
  return {
    accessTier: normalizeAccessTier(companyAccessTier),
    isAuthenticated,
    canViewVideos: isAuthenticated && (isFreeCompany ? hasFullCorporateEnglish : capabilities.canAccessCorporateEnglishVideos),
    canViewProfile: capabilities.canAccessCorporateEnglishProfile,
    canViewClips: capabilities.canAccessCorporateEnglishClips,
    canViewResources: capabilities.canAccessCorporateEnglishResources,
    canViewSpeakerContacts: hasFullCorporateEnglish,
    canUseFreeSample: isAuthenticated && isFreeCompany,
    requiredForVideos: 'half_year',
    requiredForProfile: 'half_year',
    requiredForClips: 'half_year',
    requiredForResources: 'half_year'
  }
}

function canAccessClip(row, permissions, freeSampleClipIds = new Set()) {
  if (permissions.canViewClips) return true
  return permissions.canUseFreeSample && freeSampleClipIds.has(String(row.clip_id))
}

function canAccessMaterial(row, permissions, freeSampleMaterialId = '') {
  if (permissions.canViewVideos) return true
  return permissions.canUseFreeSample && String(row.material_id) === String(freeSampleMaterialId)
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeSubtitleCues(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((cue) => ({
      startMs: Number(cue?.startMs ?? cue?.start_ms ?? 0),
      endMs: Number(cue?.endMs ?? cue?.end_ms ?? 0),
      subtitleText: normalizeString(cue?.subtitleText ?? cue?.subtitle_text),
      translationText: normalizeString(cue?.translationText ?? cue?.translation_text)
    }))
    .filter((cue) => Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs) && cue.endMs > cue.startMs && (cue.subtitleText || cue.translationText))
    .sort((a, b) => a.startMs - b.startMs)
}

function buildClipSubtitleCues(clip, material) {
  const rows = Array.isArray(material?.normalized_subtitle_rows) ? material.normalized_subtitle_rows : []
  const clipStartMs = Number(clip?.start_ms || 0)
  const clipEndMs = Number(clip?.end_ms || 0)
  if (!rows.length || !Number.isFinite(clipStartMs) || !Number.isFinite(clipEndMs) || clipEndMs <= clipStartMs) {
    return []
  }

  const selectedRows = rows
    .map((row) => ({
      sourceStartMs: Number(row?.subtitle_start_ms),
      subtitleText: normalizeString(row?.subtitle_text),
      translationText: normalizeString(row?.translation_text)
    }))
    .filter((row) =>
      Number.isFinite(row.sourceStartMs) &&
      row.sourceStartMs >= clipStartMs &&
      row.sourceStartMs <= clipEndMs &&
      (row.subtitleText || row.translationText)
    )
    .sort((a, b) => a.sourceStartMs - b.sourceStartMs)

  const firstClipLine = normalizeComparableText(String(clip?.subtitle_text || '').split('\n').find((line) => line.trim()))
  const firstCueLine = normalizeComparableText(selectedRows[0]?.subtitleText)
  if (firstClipLine && firstCueLine) {
    const firstClipPreview = firstClipLine.slice(0, 48)
    const firstCuePreview = firstCueLine.slice(0, 48)
    if (!firstCueLine.includes(firstClipPreview) && !firstClipLine.includes(firstCuePreview)) {
      return []
    }
  }

  return selectedRows.map((row, index) => {
    const nextStartMs = selectedRows[index + 1]?.sourceStartMs ?? clipEndMs
    const startMs = Math.max(0, row.sourceStartMs - clipStartMs)
    const endMs = Math.max(startMs + 1, Math.min(clipEndMs - clipStartMs, nextStartMs - clipStartMs))
    return {
      startMs,
      endMs,
      subtitleText: row.subtitleText,
      translationText: row.translationText
    }
  })
}

function mapClip(row, favoriteClipIds = new Set(), options = {}) {
  const unlocked = options.unlocked !== false
  const hasAudio = row.clip_audio_upload_status === 'ready' && Number(row.clip_audio_size_bytes || 0) > 0
  const storedSubtitleCues = normalizeSubtitleCues(row.subtitle_cues)
  return {
    id: row.clip_id,
    clipId: row.clip_id,
    materialId: row.material_id,
    companyId: row.company_id,
    sequence: Number(row.sequence || 0),
    clipTitle: row.clip_title || '',
    startMs: Number(row.start_ms || 0),
    endMs: Number(row.end_ms || 0),
    subtitleText: row.subtitle_text || '',
    translationText: row.translation_text || '',
    clipTags: Array.isArray(row.clip_tags) ? row.clip_tags : [],
    pronunciationMarks: Array.isArray(row.pronunciation_marks) ? row.pronunciation_marks : [],
    audioUrl: unlocked && hasAudio ? `/api/corporate-english-public?resource=clip-audio&clipId=${encodeURIComponent(row.clip_id)}` : '',
    hasAudio,
    audioUnavailableReason: hasAudio ? '' : '该片段音频暂不可用，请稍后重试。',
    isFavorited: unlocked && favoriteClipIds.has(String(row.clip_id)),
    isLocked: !unlocked,
    lockReason: unlocked ? '' : (options.lockReason || '人工精选和剪辑后的跟读音频、口语练习重点、字幕等内容。'),
    requiredPlan: unlocked ? '' : (options.requiredPlan || 'half_year'),
    subtitleCues: storedSubtitleCues.length > 0
      ? storedSubtitleCues
      : (Array.isArray(options.subtitleCues) ? options.subtitleCues : [])
  }
}

function pickTranslatedText(row, key, fallback = '') {
  const translations = parseJsonObject(row?.translations)
  return normalizeString(translations?.[key]) || normalizeString(fallback)
}

function mapMaterial(row, clips, permissions, options = {}) {
  const videoUnlocked = options.videoUnlocked ?? permissions.canViewVideos
  return {
    id: row.material_id,
    materialId: row.material_id,
    companyId: row.company_id,
    materialTitle: row.material_title,
    speakerName: row.speaker_name,
    speakerRole: row.speaker_role,
    speakerEmail: permissions.canViewSpeakerContacts ? row.speaker_email : '',
    speakerLinkedin: permissions.canViewSpeakerContacts ? row.speaker_linkedin : '',
    hasSpeakerEmail: Boolean(row.speaker_email),
    hasSpeakerLinkedin: Boolean(row.speaker_linkedin),
    tencentVideoVid: row.tencent_video_vid || '',
    tencentVideoUrl: row.tencent_video_url || '',
    isVideoLocked: !videoUnlocked,
    videoLockReason: videoUnlocked
      ? ''
      : permissions.isAuthenticated
        ? '外企英语材料为会员配套英语练习工具。'
        : 'CEO 访谈视频',
    videoSummary: row.video_summary || '',
    sequence: Number(row.sequence || 0),
    clipCount: Number(row.clip_count || clips.length || 0),
    durationMs: row.duration_ms,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    clips
  }
}

async function resolveUser(req) {
  const token = extractToken(req)
  if (!token) return null
  try {
    const payload = verifyToken(token)
    if (!payload?.userId) return null
    return await userHelper.getUserById(payload.userId)
  } catch {
    return null
  }
}

async function listCompanies(req, res, user) {
  const includeDrafts = isLocalPreviewRequest(req)
  const capabilities = deriveMembershipCapabilities(user)
  const shouldPinFree = !capabilities.canAccessCorporateEnglishVideos
  const rows = await neonHelper.query(
    `SELECT
       m.company_id,
       MAX(m.company_name_snapshot) AS company_name,
       MAX(m.company_website_snapshot) AS company_website,
       MAX(tc.logo) AS logo,
       MAX(tc.industry) AS industry,
       COUNT(DISTINCT m.material_id)::int AS video_count,
       COUNT(c.clip_id)::int AS clip_count,
       MAX(m.updated_at) AS latest_updated_at,
       COALESCE(MAX(p.sort_order), 0) AS sort_order,
       COALESCE(MAX(to_jsonb(p)->>'access_tier'), 'vip') AS access_tier
     FROM ${MATERIALS_TABLE} m
     JOIN trusted_companies tc ON tc.company_id = m.company_id
     LEFT JOIN ${CLIPS_TABLE} c ON c.material_id = m.material_id AND ${statusClause('c', includeDrafts)}
     LEFT JOIN ${PROFILES_TABLE} p ON p.company_id = m.company_id
     WHERE m.deleted_at IS NULL
       AND ${statusClause('m', includeDrafts)}
     GROUP BY m.company_id
     HAVING COUNT(c.clip_id) > 0
     ORDER BY
       CASE WHEN $1::boolean AND COALESCE(MAX(to_jsonb(p)->>'access_tier'), 'vip') = 'free' THEN 0 ELSE 1 END ASC,
       MAX(m.updated_at) DESC`,
    [shouldPinFree]
  )

  return res.status(200).json({
    success: true,
    companies: (rows || []).map((row) => ({
      companyId: row.company_id,
      name: row.company_name,
      website: row.company_website,
      logo: row.logo,
      industry: row.industry,
      videoCount: Number(row.video_count || 0),
      clipCount: Number(row.clip_count || 0),
      accessTier: normalizeAccessTier(row.access_tier),
      latestUpdatedAt: row.latest_updated_at
    }))
  })
}

async function getFavorites(userId) {
  if (!userId) return new Set()
  const rows = await neonHelper.query(
    `SELECT clip_id FROM ${FAVORITES_TABLE} WHERE user_id = $1`,
    [userId]
  )
  return new Set((rows || []).map((row) => String(row.clip_id)))
}

async function getFavoriteItems(user, includeDrafts = false) {
  const userId = getUserId(user)
  if (!userId) return []
  const rows = await neonHelper.query(
    `SELECT f.created_at, c.clip_id, c.material_id, c.company_id, c.sequence, c.clip_title, c.start_ms, c.end_ms,
            c.subtitle_text, c.translation_text, c.clip_tags,
            c.pronunciation_marks,
            a.upload_status AS clip_audio_upload_status,
            a.size_bytes AS clip_audio_size_bytes,
            m.material_title, m.company_name_snapshot, m.speaker_name, m.normalized_subtitle_rows,
            COALESCE(to_jsonb(p)->>'access_tier', 'vip') AS access_tier,
            (
              SELECT c2.clip_id
              FROM ${CLIPS_TABLE} c2
              JOIN ${MATERIALS_TABLE} m2 ON m2.material_id = c2.material_id
              WHERE c2.company_id = c.company_id
                AND ${statusClause('c2', includeDrafts)}
                AND ${statusClause('m2', includeDrafts)}
                AND m2.deleted_at IS NULL
              ORDER BY m2.sequence ASC, m2.published_at DESC NULLS LAST, m2.updated_at DESC, c2.sequence ASC, c2.created_at ASC
              LIMIT 1
            ) AS free_sample_clip_id
     FROM ${FAVORITES_TABLE} f
     JOIN ${CLIPS_TABLE} c ON c.clip_id = f.clip_id
     JOIN ${MATERIALS_TABLE} m ON m.material_id = c.material_id
     LEFT JOIN ${ASSETS_TABLE} a ON a.asset_id = c.clip_audio_asset_id
     LEFT JOIN ${PROFILES_TABLE} p ON p.company_id = c.company_id
     WHERE f.user_id = $1
       AND ${statusClause('c', includeDrafts)}
       AND ${statusClause('m', includeDrafts)}
       AND m.deleted_at IS NULL
     ORDER BY f.created_at DESC
     LIMIT 50`,
    [userId]
  )
  return (rows || [])
    .map((row) => {
      const permissions = getPermissions(user, row.access_tier)
      const unlocked = canAccessClip(row, permissions, new Set(row.free_sample_clip_id ? [String(row.free_sample_clip_id)] : []))
      if (!unlocked) return null
      return {
        ...mapClip(row, new Set([String(row.clip_id)]), {
          unlocked,
          subtitleCues: buildClipSubtitleCues(row, row)
        }),
        materialTitle: row.material_title,
        companyName: row.company_name_snapshot,
        speakerName: row.speaker_name,
        savedAt: row.created_at
      }
    })
    .filter(Boolean)
}

async function listFavoriteItems(req, res, user) {
  const userId = getUserId(user)
  if (!userId) return res.status(401).json({ success: false, error: '请先登录' })
  const includeDrafts = isLocalPreviewRequest(req)
  const favorites = await getFavoriteItems(user, includeDrafts)
  return res.status(200).json({ success: true, favorites })
}

async function ensureFavoriteUserRow(user, req) {
  const userId = getUserId(user)
  if (!userId) return false

  const rows = await neonHelper.query(
    'SELECT user_id FROM users WHERE user_id = $1 LIMIT 1',
    [userId]
  )
  if (rows?.[0]) return true
  if (!isLocalPreviewRequest(req)) return false

  await neonHelper.query(
    `INSERT INTO users (
       user_id, email, password_hash, username, email_verified,
       membership_level, member_status, member_type, member_expire_at,
       roles, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9::jsonb, NOW(), NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [
      userId,
      user.email || `${userId}@local.preview`,
      user.password_hash || user.passwordHash || 'local-preview-user',
      user.username || user.email || 'Local Preview User',
      user.membership_level || user.membershipLevel || 'free',
      user.member_status || user.memberStatus || 'inactive',
      user.member_type || user.memberType || 'none',
      user.member_expire_at || user.memberExpireAt || null,
      JSON.stringify(user.roles || { user: true })
    ]
  )
  return true
}

async function getCompany(req, res, user) {
  const companyId = normalizeString(req.query.companyId || req.query.company_id)
  if (!companyId) return res.status(400).json({ success: false, error: 'Missing company id' })
  const includeDrafts = isLocalPreviewRequest(req)

  const [companyRows, materialRows, clipRows, profileRows, jobRows, favoriteClipIds, favoriteItems] = await Promise.all([
    neonHelper.query(
      `SELECT company_id, name, website, logo, industry, description, job_count
       FROM trusted_companies
       WHERE company_id = $1
       LIMIT 1`,
      [companyId]
    ),
    neonHelper.query(
      `SELECT *
       FROM ${MATERIALS_TABLE}
       WHERE company_id = $1 AND deleted_at IS NULL AND ${statusClause('corporate_english_materials', includeDrafts)}
       ORDER BY sequence ASC, published_at DESC NULLS LAST, updated_at DESC`,
      [companyId]
    ),
    neonHelper.query(
      `SELECT c.*,
              a.upload_status AS clip_audio_upload_status,
              a.size_bytes AS clip_audio_size_bytes
       FROM ${CLIPS_TABLE} c
       JOIN ${MATERIALS_TABLE} m ON m.material_id = c.material_id
       LEFT JOIN ${ASSETS_TABLE} a ON a.asset_id = c.clip_audio_asset_id
       WHERE c.company_id = $1
         AND ${statusClause('c', includeDrafts)}
         AND ${statusClause('m', includeDrafts)}
         AND m.deleted_at IS NULL
       ORDER BY m.sequence ASC, m.published_at DESC NULLS LAST, m.updated_at DESC, c.sequence ASC, c.created_at ASC`,
      [companyId]
    ),
    neonHelper.query(
      `SELECT * FROM ${PROFILES_TABLE} WHERE company_id = $1 AND status = 'published' LIMIT 1`,
      [companyId]
    ),
    neonHelper.query(
      `SELECT job_id, title, company, company_id, location, job_type, category, salary, url, created_at,
              translations, is_translated, translated_at
       FROM jobs
       WHERE company_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 8`,
      [companyId]
    ).catch(() => []),
    getFavorites(getUserId(user)),
    getFavoriteItems(user, includeDrafts)
  ])

  const company = companyRows?.[0]
  if (!company || (materialRows || []).length === 0) return res.status(404).json({ success: false, error: 'Company content not found' })
  const permissions = getPermissions(user, profileRows?.[0]?.access_tier)

  const firstMaterialByCompany = (materialRows || [])[0]
  const freeSampleMaterialId = firstMaterialByCompany ? String(firstMaterialByCompany.material_id) : ''
  const firstClipByCompany = (clipRows || [])[0]
  const freeSampleClipIds = new Set(firstClipByCompany ? [String(firstClipByCompany.clip_id)] : [])
  const materialById = new Map((materialRows || []).map((material) => [String(material.material_id), material]))
  const clipsByMaterial = new Map()
  for (const clip of clipRows || []) {
    const list = clipsByMaterial.get(clip.material_id) || []
    const unlocked = canAccessClip(clip, permissions, freeSampleClipIds)
    const material = materialById.get(String(clip.material_id))
    list.push(mapClip(clip, favoriteClipIds, {
      unlocked,
      subtitleCues: buildClipSubtitleCues(clip, material),
        lockReason: permissions.isAuthenticated
          ? '人工精选和剪辑后的跟读音频、口语练习重点、字幕等内容。'
          : '跟读音频、翻译等口语练习素材。',
          requiredPlan: permissions.isAuthenticated ? 'half_year' : ''
      }))
    clipsByMaterial.set(clip.material_id, list)
  }

  return res.status(200).json({
    success: true,
    company: {
      companyId: company.company_id,
      name: company.name,
      website: company.website,
      logo: company.logo,
      industry: company.industry,
      description: company.description,
      jobCount: Number(company.job_count || 0),
      accessTier: permissions.accessTier
    },
    profile: {
      cultureSections: mapSections(profileRows?.[0]?.culture_sections),
      ceoThinkingSections: mapSections(profileRows?.[0]?.ceo_thinking_sections),
      otherResources: mapResourceLinks(profileRows?.[0]?.other_resources)
    },
    permissions,
    videos: (materialRows || []).map((material) => {
      const videoUnlocked = canAccessMaterial(material, permissions, freeSampleMaterialId)
      return mapMaterial(material, clipsByMaterial.get(material.material_id) || [], permissions, { videoUnlocked })
    }),
    jobs: (jobRows || []).map((job) => ({
      id: job.job_id,
      title: pickTranslatedText(job, 'title', job.title),
      originalTitle: job.title,
      company: pickTranslatedText(job, 'company', job.company),
      companyId: job.company_id,
      location: pickTranslatedText(job, 'location', job.location),
      jobType: pickTranslatedText(job, 'type', job.job_type),
      category: job.category,
      salary: job.salary,
      url: job.url,
      createdAt: job.created_at,
      isTranslated: Boolean(job.is_translated),
      translatedAt: job.translated_at
    })),
    favorites: favoriteItems
  })
}

async function canAccessClipById(clipId, user, includeDrafts = false) {
  const rows = await neonHelper.query(
    `WITH target AS (
       SELECT c.clip_id, c.company_id, COALESCE(to_jsonb(p)->>'access_tier', 'vip') AS access_tier
       FROM ${CLIPS_TABLE} c
       JOIN ${MATERIALS_TABLE} m ON m.material_id = c.material_id
       LEFT JOIN ${PROFILES_TABLE} p ON p.company_id = c.company_id
       WHERE c.clip_id = $1
         AND ${statusClause('c', includeDrafts)}
         AND ${statusClause('m', includeDrafts)}
         AND m.deleted_at IS NULL
       LIMIT 1
     ),
     first_free AS (
       SELECT c2.clip_id
       FROM ${CLIPS_TABLE} c2
       JOIN ${MATERIALS_TABLE} m2 ON m2.material_id = c2.material_id
       WHERE c2.company_id = (SELECT company_id FROM target)
         AND ${statusClause('c2', includeDrafts)}
         AND ${statusClause('m2', includeDrafts)}
         AND m2.deleted_at IS NULL
       ORDER BY m2.sequence ASC, m2.published_at DESC NULLS LAST, m2.updated_at DESC, c2.sequence ASC, c2.created_at ASC
       LIMIT 1
     )
     SELECT target.*, first_free.clip_id AS free_sample_clip_id
     FROM target
     LEFT JOIN first_free ON true`,
    [clipId]
  )
  const row = rows?.[0]
  if (!row) return { exists: false, allowed: false }
  const permissions = getPermissions(user, row.access_tier)
  const allowed = permissions.canViewClips || (permissions.canUseFreeSample && String(row.clip_id) === String(row.free_sample_clip_id))
  return { exists: true, allowed, permissions }
}

async function downloadClipAudio(req, res, user) {
  const clipId = normalizeString(req.query.clipId || req.query.clip_id)
  if (!clipId) return res.status(400).json({ success: false, error: 'Missing clip id' })
  const includeDrafts = isLocalPreviewRequest(req)
  const access = await canAccessClipById(clipId, user, includeDrafts)
  if (!access.exists) return res.status(404).json({ success: false, error: 'Audio not found' })
  if (!access.allowed) return res.status(403).json({ success: false, error: '了解会员服务后可解锁跟读音频' })
  const rows = await neonHelper.query(
    `SELECT a.filename, a.mime_type, a.content, a.size_bytes, a.sha256
     FROM ${CLIPS_TABLE} c
     JOIN ${MATERIALS_TABLE} m ON m.material_id = c.material_id
     JOIN ${ASSETS_TABLE} a ON a.asset_id = c.clip_audio_asset_id
     WHERE c.clip_id = $1
       AND ${statusClause('c', includeDrafts)}
       AND ${statusClause('m', includeDrafts)}
       AND m.deleted_at IS NULL
       AND a.upload_status = 'ready'
     LIMIT 1`,
    [clipId]
  )
  const asset = rows?.[0]
  if (!asset?.content) return res.status(404).json({ success: false, error: 'Audio not found' })
  const content = Buffer.isBuffer(asset.content) ? asset.content : Buffer.from(asset.content)
  res.setHeader('Content-Type', asset.mime_type || 'audio/webm')
  res.setHeader('Content-Length', String(content.length))
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.filename || 'clip.webm')}"`)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  if (asset.sha256) res.setHeader('ETag', `"${asset.sha256}"`)
  return res.status(200).send(content)
}

async function updateFavorite(req, res, user, shouldAdd) {
  const userId = getUserId(user)
  if (!userId) return res.status(401).json({ success: false, error: '请先登录' })
  const clipId = normalizeString(req.query.clipId || req.body?.clipId || req.body?.clip_id)
  if (!clipId) return res.status(400).json({ success: false, error: 'Missing clip id' })
  const includeDrafts = isLocalPreviewRequest(req)
  const access = await canAccessClipById(clipId, user, includeDrafts)
  if (!access.exists) return res.status(404).json({ success: false, error: 'Clip not found' })
  if (!access.allowed) return res.status(403).json({ success: false, error: '了解会员服务后可收藏跟读片段' })
  const hasUserRow = await ensureFavoriteUserRow(user, req)
  if (!hasUserRow) return res.status(401).json({ success: false, error: '登录状态已失效，请重新登录' })

  if (shouldAdd) {
    await neonHelper.query(
      `INSERT INTO ${FAVORITES_TABLE} (user_id, clip_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, clip_id) DO NOTHING`,
      [userId, clipId]
    )
  } else {
    await neonHelper.query(
      `DELETE FROM ${FAVORITES_TABLE} WHERE user_id = $1 AND clip_id = $2`,
      [userId, clipId]
    )
  }
  return res.status(200).json({ success: true })
}

export default async function handler(req, res) {
  sendCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!neonHelper.isConfigured) return res.status(500).json({ success: false, error: 'Database not configured' })

  try {
    const resource = normalizeString(req.query.resource || 'companies')
    const user = await resolveUser(req)

    if (req.method === 'GET' && resource === 'companies') return await listCompanies(req, res, user)
    if (req.method === 'GET' && resource === 'company') return await getCompany(req, res, user)
    if (req.method === 'GET' && resource === 'favorites') return await listFavoriteItems(req, res, user)
    if (req.method === 'GET' && resource === 'clip-audio') return await downloadClipAudio(req, res, user)
    if (req.method === 'POST' && resource === 'favorite') return await updateFavorite(req, res, user, true)
    if (req.method === 'DELETE' && resource === 'favorite') return await updateFavorite(req, res, user, false)

    return res.status(404).json({ success: false, error: 'Resource not found' })
  } catch (error) {
    console.error('[corporate-english-public] Handler error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
