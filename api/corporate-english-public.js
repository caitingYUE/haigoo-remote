import neonHelper from '../server-utils/dal/neon-helper.js'
import userHelper from '../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../server-utils/auth-helpers.js'
import { deriveMembershipCapabilities } from '../lib/shared/membership.js'
import { resolveCachedLogoUrlFromRow } from '../lib/services/company-image-asset-service.js'

const MATERIALS_TABLE = 'corporate_english_materials'
const ASSETS_TABLE = 'corporate_english_assets'
const CLIPS_TABLE = 'corporate_english_clips'
const PROFILES_TABLE = 'corporate_english_company_profiles'
const FAVORITES_TABLE = 'corporate_english_clip_favorites'
const MODULE_VIDEOS_TABLE = 'corporate_english_module_videos'
const COVER_ASSETS_TABLE = 'corporate_english_cover_assets'
const VALID_MODULE_KEYS = new Set(['english_interview', 'remote_preparation', 'foreign_meeting'])
const REMOTE_PREPARATION_LEVEL_LABELS = {
  entry: '入门',
  junior: '初级',
  intermediate: '中级',
  advanced: '高级'
}
const VALID_COVER_OWNER_TYPES = new Set(['material', 'module_video'])
const columnSupportCache = new Map()

function buildCoverImageUrl(ownerType, ownerId, variant = 'large', hash = '') {
  const id = normalizeString(ownerId)
  if (!VALID_COVER_OWNER_TYPES.has(ownerType) || !id) return ''
  const params = new URLSearchParams({ resource: 'cover-image', ownerType, ownerId: id, variant })
  if (hash) params.set('v', String(hash).slice(0, 16))
  return `/api/corporate-english-public?${params.toString()}`
}

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeModuleKey(value) {
  const next = normalizeString(value)
  return VALID_MODULE_KEYS.has(next) ? next : ''
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

function isMissingColumnError(error, columnName) {
  return error?.code === '42703' && String(error?.message || error).includes(columnName)
}

function isMissingCoverColumnError(error) {
  return isMissingColumnError(error, 'cover_image')
}

function setTableColumnSupport(tableName, columnName, supported) {
  columnSupportCache.set(`${tableName}:${columnName}`, supported)
}

async function hasTableColumn(tableName, columnName) {
  const cacheKey = `${tableName}:${columnName}`
  if (columnSupportCache.has(cacheKey)) return columnSupportCache.get(cacheKey)
  const rows = await neonHelper.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS has_column`,
    [tableName, columnName]
  )
  const hasColumn = rows?.[0]?.has_column === true
  columnSupportCache.set(cacheKey, hasColumn)
  return hasColumn
}

async function hasCoverColumns(tableName) {
  return hasTableColumn(tableName, 'cover_image_hash')
}

function normalizeAccessTier(value) {
  return value === 'free' ? 'free' : 'vip'
}

function getUserId(user) {
  return user?.userId || user?.user_id || user?.id || ''
}

function canAccessModuleVideo(row, user) {
  if (!user) return false
  if (normalizeAccessTier(row.access_tier) === 'free') return true
  return Boolean(deriveMembershipCapabilities(user).canAccessCorporateEnglishVideos)
}

function mapModuleVideo(row, user) {
  const unlocked = canAccessModuleVideo(row, user)
  const isAuthenticated = Boolean(user)
  const accessTier = normalizeAccessTier(row.access_tier)
  const canExposePublicDetails = isAuthenticated || unlocked
  return {
    id: row.video_id,
    videoId: row.video_id,
    moduleKey: row.module_key,
    title: row.video_title,
    description: canExposePublicDetails ? (row.description || '') : '',
    videoSource: row.video_source || '',
    coverImageUrl: buildCoverImageUrl('module_video', row.video_id, 'large', row.cover_image_hash),
    coverThumbnailUrl: buildCoverImageUrl('module_video', row.video_id, 'thumb', row.cover_image_hash),
    coverImageHash: row.cover_image_hash || '',
    coverImageWidth: row.cover_image_width,
    coverImageHeight: row.cover_image_height,
    coverImageUpdatedAt: row.cover_image_updated_at,
    category: row.category || '',
    difficultyLevel: row.difficulty_level || '',
    difficultyLevelLabel: REMOTE_PREPARATION_LEVEL_LABELS[row.difficulty_level] || '',
    tags: canExposePublicDetails && Array.isArray(row.tags) ? row.tags : [],
    accessTier,
    durationMs: row.duration_ms,
    publishedAt: row.published_at,
    sortOrder: Number(row.sort_order || 0),
    tencentIframeUrl: unlocked ? (row.tencent_iframe_url || '') : '',
    isLocked: !unlocked,
    loginRequired: !isAuthenticated,
    upgradeRequired: isAuthenticated && accessTier === 'vip' && !unlocked,
    lockReason: unlocked
      ? ''
      : isAuthenticated
        ? '该视频为会员内容，升级后可播放。'
        : '登录后可播放免费视频，会员视频需开通会员。'
  }
}

function getPermissions(user, companyAccessTier = 'vip') {
  const capabilities = deriveMembershipCapabilities(user)
  const isAuthenticated = Boolean(user)
  const isFreeCompany = normalizeAccessTier(companyAccessTier) === 'free'
  const hasFullCorporateEnglish = capabilities.isActive && (
    ['starter', 'quarter', 'quarter_pro', 'year', 'half_year', 'annual'].includes(capabilities.memberType) ||
    capabilities.canAccessCorporateEnglishVideos ||
    capabilities.canAccessCorporateEnglishProfile ||
    capabilities.canAccessCorporateEnglishClips ||
    capabilities.canAccessCorporateEnglishResources
  )
  return {
    accessTier: normalizeAccessTier(companyAccessTier),
    isAuthenticated,
    canViewVideos: isAuthenticated && (isFreeCompany ? hasFullCorporateEnglish : capabilities.canAccessCorporateEnglishVideos),
    canViewProfile: isAuthenticated && (isFreeCompany || capabilities.canAccessCorporateEnglishProfile),
    canViewClips: capabilities.canAccessCorporateEnglishClips,
    canViewResources: isAuthenticated && (isFreeCompany || capabilities.canAccessCorporateEnglishResources),
    canViewSpeakerContacts: hasFullCorporateEnglish,
    canUseFreeSample: isAuthenticated && isFreeCompany,
    requiredForVideos: 'starter',
    requiredForProfile: 'starter',
    requiredForClips: 'starter',
    requiredForResources: 'starter'
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
  if (!unlocked) {
    return {
      id: row.clip_id,
      clipId: row.clip_id,
      materialId: row.material_id,
      companyId: row.company_id,
      sequence: Number(row.sequence || 0),
      clipTitle: '跟读片段',
      startMs: Number(row.start_ms || 0),
      endMs: Number(row.end_ms || 0),
      subtitleText: '',
      translationText: '',
      clipTags: [],
      pronunciationMarks: [],
      audioUrl: '',
      hasAudio,
      audioUnavailableReason: hasAudio ? '' : '该片段音频暂不可用，请稍后重试。',
      isFavorited: false,
      isLocked: true,
      lockReason: options.lockReason || '人工精选和剪辑后的跟读音频、口语练习重点、字幕等内容。',
      requiredPlan: options.requiredPlan || 'starter',
      subtitleCues: []
    }
  }
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
    requiredPlan: unlocked ? '' : (options.requiredPlan || 'starter'),
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
    speakerName: permissions.isAuthenticated ? row.speaker_name : '',
    speakerRole: row.speaker_role,
    speakerEmail: permissions.canViewSpeakerContacts ? row.speaker_email : '',
    speakerLinkedin: permissions.canViewSpeakerContacts ? row.speaker_linkedin : '',
    hasSpeakerEmail: Boolean(row.speaker_email),
    hasSpeakerLinkedin: Boolean(row.speaker_linkedin),
    tencentVideoVid: row.tencent_video_vid || '',
    tencentVideoUrl: videoUnlocked ? (row.tencent_video_url || '') : '',
    sourceVideoUrl: videoUnlocked ? (row.source_video_url || '') : '',
    coverImageUrl: buildCoverImageUrl('material', row.material_id, 'large', row.cover_image_hash),
    coverThumbnailUrl: buildCoverImageUrl('material', row.material_id, 'thumb', row.cover_image_hash),
    coverImageHash: row.cover_image_hash || '',
    coverImageWidth: row.cover_image_width,
    coverImageHeight: row.cover_image_height,
    coverImageUpdatedAt: row.cover_image_updated_at,
    isVideoLocked: !videoUnlocked,
    videoLockReason: videoUnlocked
      ? ''
      : permissions.isAuthenticated
        ? '外企英语材料为会员配套英语练习工具。'
        : 'CEO 访谈视频',
    videoSummary: videoUnlocked || permissions.canViewProfile ? (row.video_summary || '') : '',
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
       MAX(tc.cached_logo_url) AS cached_logo_url,
       MAX(tc.logo_cache_status) AS logo_cache_status,
       MAX(tc.logo_cache_hash) AS logo_cache_hash,
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
      logo: resolveCachedLogoUrlFromRow(row) || row.logo,
      originalLogoUrl: row.logo,
      cachedLogoUrl: resolveCachedLogoUrlFromRow(row),
      industry: row.industry,
      videoCount: Number(row.video_count || 0),
      clipCount: Number(row.clip_count || 0),
      accessTier: normalizeAccessTier(row.access_tier),
      latestUpdatedAt: row.latest_updated_at
    }))
  })
}

function mapCeoVideoListRow(row, user) {
  const permissions = getPermissions(user, row.access_tier)
  const videoUnlocked = permissions.isAuthenticated && (permissions.canViewVideos || permissions.accessTier === 'free')
  const canExposePublicDetails = Boolean(user)
  return {
    id: row.material_id,
    materialId: row.material_id,
    companyId: row.company_id,
    companyName: row.company_name_snapshot,
    companyWebsite: row.company_website_snapshot || '',
    companyLogo: resolveCachedLogoUrlFromRow(row) || row.logo || '',
    companyIndustry: row.industry || '',
    materialTitle: row.material_title,
    speakerName: canExposePublicDetails ? row.speaker_name : '',
    speakerRole: row.speaker_role,
    videoSummary: canExposePublicDetails ? (row.video_summary || '') : '',
    sequence: Number(row.sequence || 0),
    clipCount: Number(row.clip_count || 0),
    durationMs: row.duration_ms,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    accessTier: normalizeAccessTier(row.access_tier),
    coverImageUrl: buildCoverImageUrl('material', row.material_id, 'large', row.cover_image_hash),
    coverThumbnailUrl: buildCoverImageUrl('material', row.material_id, 'thumb', row.cover_image_hash),
    coverImageHash: row.cover_image_hash || '',
    tencentVideoUrl: videoUnlocked ? (row.tencent_video_url || '') : '',
    sourceVideoUrl: videoUnlocked ? (row.source_video_url || '') : '',
    isVideoLocked: !videoUnlocked,
    loginRequired: !user,
    upgradeRequired: Boolean(user) && !videoUnlocked,
    lockReason: videoUnlocked
      ? ''
      : user
        ? '外企英语材料为会员配套英语练习工具。'
        : '登录后可播放 CEO 访谈视频。'
  }
}

async function listCeoVideos(req, res, user) {
  const includeDrafts = isLocalPreviewRequest(req)
  const capabilities = deriveMembershipCapabilities(user)
  const canViewMemberVideos = Boolean(capabilities.canAccessCorporateEnglishVideos)
  const requestedLimit = Number(req.query.limit || 24)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 48) : 24
  const selectFields = `
       m.material_id,
       m.company_id,
       m.company_name_snapshot,
       m.company_website_snapshot,
       m.material_title,
       m.speaker_name,
       m.speaker_role,
       m.video_summary,
       m.sequence,
       m.clip_count,
       m.duration_ms,
       m.published_at,
       m.updated_at,
       m.tencent_video_url,
       m.source_video_url,
       tc.logo,
       tc.cached_logo_url,
       tc.logo_cache_status,
       tc.logo_cache_hash,
       tc.industry,
       COALESCE(to_jsonb(p)->>'access_tier', 'vip') AS access_tier,
       COALESCE(p.sort_order, 0) AS profile_sort_order`
  const selectFieldsWithCover = `${selectFields},
       m.cover_image_hash`
  const buildQuery = (fields) => `SELECT
       ${fields}
     FROM ${MATERIALS_TABLE} m
     JOIN trusted_companies tc ON tc.company_id = m.company_id
     LEFT JOIN ${PROFILES_TABLE} p ON p.company_id = m.company_id
     WHERE m.deleted_at IS NULL
       AND ${statusClause('m', includeDrafts)}
     ORDER BY
       CASE WHEN $2::boolean THEN 0 ELSE CASE WHEN COALESCE(to_jsonb(p)->>'access_tier', 'vip') = 'free' THEN 0 ELSE 1 END END ASC,
       m.published_at DESC NULLS LAST,
       m.sequence ASC,
       m.updated_at DESC
     LIMIT $1`

  const includeCoverFields = await hasCoverColumns(MATERIALS_TABLE)
  let rows = []
  try {
    rows = await neonHelper.query(buildQuery(includeCoverFields ? selectFieldsWithCover : selectFields), [limit, canViewMemberVideos])
  } catch (error) {
    if (!isMissingCoverColumnError(error)) throw error
    setTableColumnSupport(MATERIALS_TABLE, 'cover_image_hash', false)
    rows = await neonHelper.query(buildQuery(selectFields), [limit, canViewMemberVideos])
  }

  return res.status(200).json({
    success: true,
    videos: (rows || []).map((row) => mapCeoVideoListRow(row, user))
  })
}

async function listModuleVideos(req, res, user) {
  const moduleKey = normalizeModuleKey(req.query.module || req.query.moduleKey || req.query.module_key)
  if (!moduleKey) return res.status(400).json({ success: false, error: 'Invalid module' })

  const category = normalizeString(req.query.category)
  const difficultyLevel = normalizeString(req.query.difficultyLevel || req.query.difficulty_level || req.query.level)
  const capabilities = deriveMembershipCapabilities(user)
  const canViewMemberVideos = Boolean(capabilities.canAccessCorporateEnglishVideos)
  const params = [moduleKey]
  const conditions = ['module_key = $1', "status = 'published'", 'deleted_at IS NULL']
  const includeDifficultyLevelField = await hasTableColumn(MODULE_VIDEOS_TABLE, 'difficulty_level')
  if (category && category !== '全部') {
    params.push(category)
    conditions.push(`category = $${params.length}`)
  }
  if (includeDifficultyLevelField && moduleKey === 'remote_preparation' && difficultyLevel && difficultyLevel !== '全部') {
    params.push(difficultyLevel)
    conditions.push(`difficulty_level = $${params.length}`)
  }
  const requestedLimit = Number(req.query.limit || 48)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 96) : 48

  const includeDurationField = await hasTableColumn(MODULE_VIDEOS_TABLE, 'duration_ms')
  const selectFields = `
       video_id,
       module_key,
       video_title,
       description,
       video_source,
       category${includeDifficultyLevelField ? `,
       difficulty_level` : ''},
       tags,
       access_tier${includeDurationField ? `,
       duration_ms` : ''},
       published_at,
       sort_order,
       updated_at,
       tencent_iframe_url`
  const selectFieldsWithCover = `${selectFields},
       cover_image_hash,
       cover_image_width,
       cover_image_height,
       cover_image_updated_at`
  const buildQuery = (fields) => `SELECT
       ${fields}
     FROM ${MODULE_VIDEOS_TABLE}
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE WHEN $${params.length + 1}::boolean THEN 0 ELSE CASE WHEN access_tier = 'free' THEN 0 ELSE 1 END END ASC,
       published_at DESC NULLS LAST,
       sort_order ASC,
       updated_at DESC
     LIMIT $${params.length + 2}`

  const includeCoverFields = await hasCoverColumns(MODULE_VIDEOS_TABLE)
  let rows = []
  try {
    rows = await neonHelper.query(buildQuery(includeCoverFields ? selectFieldsWithCover : selectFields), [...params, canViewMemberVideos, limit])
  } catch (error) {
    if (!isMissingCoverColumnError(error)) throw error
    setTableColumnSupport(MODULE_VIDEOS_TABLE, 'cover_image_hash', false)
    rows = await neonHelper.query(buildQuery(selectFields), [...params, canViewMemberVideos, limit])
  }

  const categoryRows = includeDifficultyLevelField && moduleKey === 'remote_preparation'
    ? await neonHelper.query(
      `SELECT difficulty_level AS category, COUNT(*)::int AS count
       FROM ${MODULE_VIDEOS_TABLE}
       WHERE module_key = $1
         AND status = 'published'
         AND deleted_at IS NULL
         AND NULLIF(BTRIM(difficulty_level), '') IS NOT NULL
       GROUP BY difficulty_level
       ORDER BY
         CASE difficulty_level
           WHEN 'entry' THEN 10
           WHEN 'junior' THEN 20
           WHEN 'intermediate' THEN 30
           WHEN 'advanced' THEN 40
           ELSE 999
         END`,
      [moduleKey]
    )
    : await neonHelper.query(
      `SELECT category, COUNT(*)::int AS count
       FROM ${MODULE_VIDEOS_TABLE}
       WHERE module_key = $1
         AND status = 'published'
         AND deleted_at IS NULL
         AND NULLIF(BTRIM(category), '') IS NOT NULL
       GROUP BY category
       ORDER BY MAX(published_at) DESC NULLS LAST, category ASC`,
      [moduleKey]
    )
  const totalCount = (categoryRows || []).reduce((sum, row) => sum + Number(row.count || 0), 0)

  return res.status(200).json({
    success: true,
    categories: [
      { label: '全部', value: '全部', count: totalCount },
      ...(categoryRows || []).map((row) => ({
        label: moduleKey === 'remote_preparation' ? (REMOTE_PREPARATION_LEVEL_LABELS[row.category] || row.category) : row.category,
        value: row.category,
        count: Number(row.count || 0)
      }))
    ],
    videos: (rows || []).map((row) => mapModuleVideo(row, user))
  })
}

async function getCeoVideo(req, res, user) {
  const materialId = normalizeString(req.query.materialId || req.query.material_id || req.query.id)
  if (!materialId) return res.status(400).json({ success: false, error: 'Missing material id' })
  const includeDrafts = isLocalPreviewRequest(req)
  const rows = await neonHelper.query(
    `SELECT company_id
     FROM ${MATERIALS_TABLE}
     WHERE material_id = $1
       AND deleted_at IS NULL
       AND ${statusClause('corporate_english_materials', includeDrafts)}
     LIMIT 1`,
    [materialId]
  )
  const companyId = rows?.[0]?.company_id
  if (!companyId) return res.status(404).json({ success: false, error: 'Video not found' })
  return getCompany({ ...req, query: { ...req.query, companyId } }, res, user)
}

async function getModuleVideo(req, res, user) {
  const videoId = normalizeString(req.query.videoId || req.query.video_id || req.query.id)
  if (!videoId) return res.status(400).json({ success: false, error: 'Missing video id' })
  const rows = await neonHelper.query(
    `SELECT *
     FROM ${MODULE_VIDEOS_TABLE}
     WHERE video_id = $1
       AND status = 'published'
       AND deleted_at IS NULL
     LIMIT 1`,
    [videoId]
  )
  const video = rows?.[0]
  if (!video) return res.status(404).json({ success: false, error: 'Video not found' })

  const recommendationRows = await neonHelper.query(
    `SELECT *
     FROM ${MODULE_VIDEOS_TABLE}
     WHERE module_key = $1
       AND video_id <> $2
       AND status = 'published'
       AND deleted_at IS NULL
     ORDER BY
       CASE WHEN NULLIF(BTRIM(category), '') IS NOT NULL AND category = $3 THEN 0 ELSE 1 END,
       published_at DESC NULLS LAST,
       sort_order ASC,
       updated_at DESC
     LIMIT 8`,
    [video.module_key, videoId, video.category || '']
  )

  return res.status(200).json({
    success: true,
    video: mapModuleVideo(video, user),
    recommendations: (recommendationRows || []).map((row) => mapModuleVideo(row, user))
  })
}

function normalizeCoverOwnerType(value) {
  const next = normalizeString(value)
  return VALID_COVER_OWNER_TYPES.has(next) ? next : ''
}

async function getCoverImage(req, res) {
  const ownerType = normalizeCoverOwnerType(req.query.ownerType || req.query.owner_type)
  const ownerId = normalizeString(req.query.ownerId || req.query.owner_id)
  const variant = normalizeString(req.query.variant) === 'thumb' ? 'thumb' : 'large'
  if (!ownerType || !ownerId) return res.status(404).json({ success: false, error: 'Asset not found' })
  const rows = await neonHelper.query(
    `SELECT content, mime_type, size_bytes, sha256
     FROM ${COVER_ASSETS_TABLE}
     WHERE owner_type = $1
       AND owner_id = $2
       AND variant = $3
     LIMIT 1`,
    [ownerType, ownerId, variant]
  )
  const asset = rows?.[0]
  if (!asset?.content) return res.status(404).json({ success: false, error: 'Asset not found' })
  const content = Buffer.isBuffer(asset.content) ? asset.content : Buffer.from(asset.content)
  res.setHeader('Content-Type', asset.mime_type || 'image/webp')
  res.setHeader('Content-Length', String(content.length))
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  if (asset.sha256) res.setHeader('ETag', `"${asset.sha256}"`)
  return res.status(200).send(content)
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
      `SELECT company_id, name, website, logo, cached_logo_url, logo_cache_status, logo_cache_hash, industry, description, job_count
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
       WHERE company_id = $1
         AND status = 'active'
         AND COALESCE(is_approved, false) = true
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
  const canExposeCompanyProfile = permissions.canViewProfile
  const canExposeJobs = permissions.canViewResources || permissions.canViewProfile

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
          requiredPlan: permissions.isAuthenticated ? 'starter' : ''
      }))
    clipsByMaterial.set(clip.material_id, list)
  }

  return res.status(200).json({
    success: true,
    company: {
      companyId: company.company_id,
      name: company.name,
      website: company.website,
      logo: resolveCachedLogoUrlFromRow(company) || company.logo,
      originalLogoUrl: company.logo,
      cachedLogoUrl: resolveCachedLogoUrlFromRow(company),
      industry: company.industry,
      description: company.description,
      jobCount: Number(company.job_count || 0),
      accessTier: permissions.accessTier
    },
    profile: {
      cultureSections: canExposeCompanyProfile ? mapSections(profileRows?.[0]?.culture_sections) : [],
      ceoThinkingSections: canExposeCompanyProfile ? mapSections(profileRows?.[0]?.ceo_thinking_sections) : [],
      otherResources: permissions.canViewResources ? mapResourceLinks(profileRows?.[0]?.other_resources) : []
    },
    permissions,
    videos: (materialRows || []).map((material) => {
      const videoUnlocked = canAccessMaterial(material, permissions, freeSampleMaterialId)
      return mapMaterial(material, clipsByMaterial.get(material.material_id) || [], permissions, { videoUnlocked })
    }),
    jobs: canExposeJobs ? (jobRows || []).map((job) => ({
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
    })) : [],
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

    if (req.method === 'GET' && resource === 'cover-image') return await getCoverImage(req, res)
    if (req.method === 'GET' && resource === 'companies') return await listCompanies(req, res, user)
    if (req.method === 'GET' && resource === 'ceo-videos') return await listCeoVideos(req, res, user)
    if (req.method === 'GET' && resource === 'ceo-video') return await getCeoVideo(req, res, user)
    if (req.method === 'GET' && resource === 'company') return await getCompany(req, res, user)
    if (req.method === 'GET' && resource === 'module-videos') return await listModuleVideos(req, res, user)
    if (req.method === 'GET' && resource === 'module-video') return await getModuleVideo(req, res, user)
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
