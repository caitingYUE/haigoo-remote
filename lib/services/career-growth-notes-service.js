import neonHelper from '../../server-utils/dal/neon-helper.js'

export const CAREER_GROWTH_NOTES_TABLE = 'career_growth_notes'
const VALID_ORIGINS = new Set(['video', 'original', 'external'])
const VALID_STATUSES = new Set(['draft', 'published', 'archived'])
const VALID_DIFFICULTIES = new Set(['entry', 'junior', 'intermediate', 'advanced'])
const VALID_BLOCK_TYPES = new Set(['heading_1', 'heading_2', 'paragraph', 'bullet_list', 'numbered_list', 'quote'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value, max = 1000) {
  return String(value || '').trim().slice(0, max)
}

function normalizeBlocks(value) {
  if (!Array.isArray(value)) return []
  let remaining = 60000
  const blocks = []
  for (const [index, block] of value.slice(0, 300).entries()) {
    if (remaining <= 0) break
    const type = VALID_BLOCK_TYPES.has(block?.type) ? block.type : 'paragraph'
    const id = text(block?.id, 80) || `note-${index + 1}`
    if (type === 'bullet_list' || type === 'numbered_list') {
      const items = (Array.isArray(block?.items) ? block.items : [])
        .slice(0, 100)
        .map((item) => text(item, Math.min(2000, remaining)))
        .filter(Boolean)
      remaining -= items.reduce((sum, item) => sum + item.length, 0)
      if (items.length) blocks.push({ id, type, items })
    } else {
      const content = text(block?.text, Math.min(30000, remaining))
      if (content) {
        blocks.push({ id, type, text: content })
        remaining -= content.length
      }
    }
  }
  return blocks
}

function normalizeTags(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/[，,;；\n]+/)
  return [...new Set(items.map((item) => text(item, 40)).filter(Boolean))].slice(0, 8)
}

function httpsUrl(value) {
  const candidate = text(value, 1000)
  if (!candidate) return ''
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export function mapCareerGrowthNote(row) {
  if (!row) return null
  const coverOwnerType = row.origin_type === 'video' ? 'module_video' : 'growth_note'
  const coverOwnerId = row.source_video_id || row.note_id
  const coverParams = (variant) => {
    if (!row.cover_image_hash) return ''
    const params = new URLSearchParams({ resource: 'cover-image', ownerType: coverOwnerType, ownerId: String(coverOwnerId), variant })
    params.set('v', String(row.cover_image_hash).slice(0, 16))
    return `/api/corporate-english-public?${params}`
  }
  return {
    id: String(row.note_id),
    noteId: String(row.note_id),
    originType: row.origin_type,
    sourceVideoId: row.source_video_id ? String(row.source_video_id) : null,
    title: row.title || '',
    originalTitle: row.original_title || '',
    summary: row.summary || '',
    authorName: row.author_name || '',
    sourceName: row.source_name || '',
    sourceUrl: row.source_url || '',
    rightsBasis: row.rights_basis || '',
    rightsConfirmed: row.rights_confirmed === true,
    contentBlocks: Array.isArray(row.content_blocks) ? row.content_blocks : [],
    category: row.category || '',
    difficultyLevel: row.difficulty_level || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    accessTier: row.access_tier === 'free' ? 'free' : 'vip',
    status: VALID_STATUSES.has(row.status) ? row.status : 'draft',
    isFeatured: row.is_featured === true,
    sortOrder: Number(row.sort_order || 0),
    publishedAt: row.published_at || null,
    coverImageHash: row.cover_image_hash || '',
    coverImageWidth: row.cover_image_width || null,
    coverImageHeight: row.cover_image_height || null,
    coverImageUrl: coverParams('large'),
    coverThumbnailUrl: coverParams('thumb'),
    version: Number(row.version || 1),
    createdBy: row.created_by || '',
    updatedBy: row.updated_by_display || row.updated_by || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  }
}

export function normalizeCareerGrowthNote(body, existing = null, actor = '') {
  const originType = existing?.origin_type || text(body.originType || body.origin_type, 16) || 'original'
  if (!VALID_ORIGINS.has(originType)) throw Object.assign(new Error('笔记来源类型无效'), { statusCode: 400 })
  const status = VALID_STATUSES.has(body.status) ? body.status : existing?.status || 'draft'
  const difficulty = text(body.difficultyLevel || body.difficulty_level, 24)
  const sourceUrlRaw = text(body.sourceUrl || body.source_url, 1000)
  const payload = {
    originType,
    sourceVideoId: existing?.source_video_id || (originType === 'video' ? text(body.sourceVideoId || body.source_video_id, 36) : ''),
    title: text(body.title, 200),
    originalTitle: text(body.originalTitle || body.original_title, 200),
    summary: text(body.summary, 2000),
    authorName: text(body.authorName || body.author_name, 120) || (originType === 'original' ? 'Haigoo 职业研究' : ''),
    sourceName: text(body.sourceName || body.source_name, 160) || (originType === 'original' ? 'Haigoo Remote' : ''),
    sourceUrl: sourceUrlRaw ? httpsUrl(sourceUrlRaw) : '',
    rightsBasis: text(body.rightsBasis || body.rights_basis, 32) || (originType === 'original' ? 'owned' : originType === 'video' ? 'linked_video' : ''),
    rightsConfirmed: originType !== 'external' || body.rightsConfirmed === true || body.rights_confirmed === true,
    contentBlocks: normalizeBlocks(body.contentBlocks || body.content_blocks),
    category: text(body.category, 80) || '远程职业准备',
    difficultyLevel: VALID_DIFFICULTIES.has(difficulty) ? difficulty : '',
    tags: normalizeTags(body.tags),
    accessTier: body.accessTier === 'free' || body.access_tier === 'free' ? 'free' : 'vip',
    status,
    isFeatured: body.isFeatured === true || body.is_featured === true,
    sortOrder: Number.isFinite(Number(body.sortOrder ?? body.sort_order)) ? Math.trunc(Number(body.sortOrder ?? body.sort_order)) : 0,
    publishedAt: body.publishedAt || body.published_at || existing?.published_at || new Date().toISOString(),
    actor: text(actor, 255) || 'admin'
  }
  const publishedAt = new Date(payload.publishedAt)
  if (Number.isNaN(publishedAt.getTime())) throw Object.assign(new Error('发布时间格式无效'), { statusCode: 400 })
  payload.publishedAt = publishedAt.toISOString()
  if (sourceUrlRaw && !payload.sourceUrl) throw Object.assign(new Error('来源链接必须是有效的 HTTPS 地址'), { statusCode: 400 })
  if (!payload.title) throw Object.assign(new Error('请填写笔记标题'), { statusCode: 400 })
  if (originType === 'video' && !payload.sourceVideoId) throw Object.assign(new Error('视频笔记缺少关联视频'), { statusCode: 400 })
  if (status === 'published') {
    if (!payload.summary || !payload.authorName || payload.contentBlocks.length === 0) {
      throw Object.assign(new Error('发布前请补齐简介、作者和正文'), { statusCode: 400 })
    }
    const hasCover = Boolean(existing?.cover_image_hash || body.coverImageHash || body.cover_image_hash)
    if (!hasCover) throw Object.assign(new Error('发布前请上传封面'), { statusCode: 400 })
    if (originType === 'external' && (!payload.sourceName || !payload.sourceUrl || !payload.rightsBasis || !payload.rightsConfirmed)) {
      throw Object.assign(new Error('外部整理笔记发布前必须填写来源并确认发布依据'), { statusCode: 400 })
    }
  }
  return payload
}

export async function getCareerGrowthNote(id) {
  if (!UUID_PATTERN.test(String(id || ''))) throw Object.assign(new Error('笔记参数无效'), { statusCode: 400 })
  const rows = await neonHelper.query(
    `SELECT notes.*, COALESCE(updater.email, notes.updated_by) AS updated_by_display
       FROM ${CAREER_GROWTH_NOTES_TABLE} notes
       LEFT JOIN users updater ON updater.user_id::text = notes.updated_by
      WHERE notes.note_id = $1::uuid LIMIT 1`,
    [id]
  )
  return rows?.[0] || null
}

export async function listCareerGrowthNotes({ page = 1, pageSize = 20, search = '', status = '', originType = '', accessTier = '', category = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const params = []
  const conditions = ['TRUE']
  const add = (condition, value) => { params.push(value); conditions.push(condition.replaceAll('?', `$${params.length}`)) }
  if (text(search, 120)) add('(notes.title ILIKE ? OR notes.original_title ILIKE ? OR notes.summary ILIKE ? OR notes.author_name ILIKE ? OR notes.source_name ILIKE ? OR notes.tags::text ILIKE ?)', `%${text(search, 120)}%`)
  if (VALID_STATUSES.has(status)) add('notes.status = ?', status)
  if (VALID_ORIGINS.has(originType)) add('notes.origin_type = ?', originType)
  if (accessTier === 'free' || accessTier === 'vip') add('notes.access_tier = ?', accessTier)
  if (text(category, 80)) add('notes.category = ?', text(category, 80))
  const where = conditions.join(' AND ')
  const countRows = await neonHelper.query(`SELECT COUNT(*)::int AS count FROM ${CAREER_GROWTH_NOTES_TABLE} notes WHERE ${where}`, params)
  params.push(safePageSize, (safePage - 1) * safePageSize)
  const rows = await neonHelper.query(
    `SELECT notes.*, COALESCE(updater.email, notes.updated_by) AS updated_by_display
       FROM ${CAREER_GROWTH_NOTES_TABLE} notes
       LEFT JOIN users updater ON updater.user_id::text = notes.updated_by
      WHERE ${where}
     ORDER BY notes.is_featured DESC, notes.sort_order ASC, notes.published_at DESC, notes.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return { notes: (rows || []).map(mapCareerGrowthNote), total: Number(countRows?.[0]?.count || 0), page: safePage, pageSize: safePageSize }
}

export async function saveCareerGrowthNote({ id = '', body = {}, actor = '' }) {
  const existing = id ? await getCareerGrowthNote(id) : null
  if (id && !existing) throw Object.assign(new Error('笔记不存在'), { statusCode: 404 })
  if (!id && text(body.originType || body.origin_type, 16) === 'video') {
    throw Object.assign(new Error('视频笔记只能从职业成长视频创建'), { statusCode: 400 })
  }
  const payload = normalizeCareerGrowthNote(body, existing, actor)
  if (!existing) {
    const rows = await neonHelper.query(
      `INSERT INTO ${CAREER_GROWTH_NOTES_TABLE}
       (origin_type, title, original_title, summary, author_name, source_name, source_url,
        rights_basis, rights_confirmed, rights_confirmed_by, rights_confirmed_at,
        content_blocks, category, difficulty_level, tags, access_tier, status,
        is_featured, sort_order, published_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $9 THEN NOW() ELSE NULL END,
               $11::jsonb,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$10,$10)
       RETURNING *`,
      [payload.originType, payload.title, payload.originalTitle, payload.summary, payload.authorName,
        payload.sourceName, payload.sourceUrl, payload.rightsBasis, payload.rightsConfirmed, payload.actor,
        JSON.stringify(payload.contentBlocks), payload.category, payload.difficultyLevel, JSON.stringify(payload.tags),
        payload.accessTier, payload.status, payload.isFeatured, payload.sortOrder, payload.publishedAt]
    )
    return mapCareerGrowthNote(rows?.[0])
  }
  const expectedVersion = Number(body.version)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw Object.assign(new Error('缺少有效的笔记版本'), { statusCode: 400 })
  const rows = await neonHelper.query(
    `WITH updated AS (
       UPDATE ${CAREER_GROWTH_NOTES_TABLE}
          SET title=$3, original_title=$4, summary=$5, author_name=$6,
              source_name=$7, source_url=$8, rights_basis=$9, rights_confirmed=$10,
              rights_confirmed_by=CASE WHEN $10 THEN $11 ELSE NULL END,
              rights_confirmed_at=CASE WHEN $10 THEN COALESCE(rights_confirmed_at, NOW()) ELSE NULL END,
              content_blocks=$12::jsonb, category=$13, difficulty_level=$14, tags=$15::jsonb,
              access_tier=$16, status=$17, is_featured=$18, sort_order=$19, published_at=$20,
              version=version+1, updated_by=$11, updated_at=NOW()
        WHERE note_id=$1::uuid AND version=$2
        RETURNING *
     ), mirrored AS (
       UPDATE corporate_english_module_videos AS video
          SET title_zh=updated.title, video_notes=updated.content_blocks,
              updated_by=$11, updated_at=NOW()
         FROM updated
        WHERE video.video_id=updated.source_video_id
        RETURNING video.video_id
     )
     SELECT * FROM updated`,
    [id, expectedVersion, payload.title, payload.originalTitle, payload.summary, payload.authorName,
      payload.sourceName, payload.sourceUrl, payload.rightsBasis, payload.rightsConfirmed, payload.actor,
      JSON.stringify(payload.contentBlocks), payload.category, payload.difficultyLevel, JSON.stringify(payload.tags),
      payload.accessTier, payload.status, payload.isFeatured, payload.sortOrder, payload.publishedAt]
  )
  if (!rows?.[0]) throw Object.assign(new Error('笔记已被其他入口更新，请重新载入'), { statusCode: 409 })
  return mapCareerGrowthNote(rows[0])
}

export async function upsertCareerGrowthNoteFromVideo(video, actor, expectedVersion) {
  const blocks = normalizeBlocks(video.videoNotes || video.video_notes)
  const existingRows = await neonHelper.query(`SELECT * FROM ${CAREER_GROWTH_NOTES_TABLE} WHERE source_video_id=$1::uuid LIMIT 1`, [video.videoId || video.video_id])
  const existing = existingRows?.[0] || null
  if (blocks.length === 0 && !existing) return null
  const body = {
    originType: 'video',
    sourceVideoId: video.videoId || video.video_id,
    title: video.noteTitle || video.titleZh || video.title || video.videoTitle,
    originalTitle: video.noteOriginalTitle || video.title || video.videoTitle,
    summary: video.noteSummary ?? video.description,
    authorName: video.noteAuthor || 'Haigoo 职业研究',
    sourceName: video.noteSourceName || video.videoSource || '',
    sourceUrl: video.noteSourceUrl || '',
    rightsBasis: 'linked_video', rightsConfirmed: true,
    contentBlocks: blocks,
    category: video.noteCategory || '远程职业准备',
    difficultyLevel: video.difficultyLevel || '', tags: video.tags || [],
    accessTier: video.noteAccessTier || video.accessTier || 'vip',
    status: video.noteStatus || video.status || 'draft',
    isFeatured: video.noteIsFeatured ?? video.isFeatured,
    sortOrder: video.noteSortOrder ?? video.sortOrder,
    publishedAt: video.notePublishedAt || video.publishedAt,
    coverImageHash: video.coverImageHash || existing?.cover_image_hash || ''
  }
  if (existing) return saveCareerGrowthNote({ id: existing.note_id, body: { ...body, version: expectedVersion ?? existing.version }, actor })
  const payload = normalizeCareerGrowthNote(body, { source_video_id: body.sourceVideoId, cover_image_hash: body.coverImageHash }, actor)
  const rows = await neonHelper.query(
    `INSERT INTO ${CAREER_GROWTH_NOTES_TABLE}
     (note_id, origin_type, source_video_id, title, original_title, summary, author_name, source_name, source_url,
      rights_basis, rights_confirmed, rights_confirmed_by, rights_confirmed_at,
      content_blocks, category, difficulty_level, tags, access_tier, status, is_featured, sort_order, published_at,
      cover_image_hash, cover_image_width, cover_image_height, cover_image_updated_at, created_by, updated_by)
     SELECT video_id, 'video', video_id, $2,$3,$4,$5,$6,$7,$8,TRUE,$9,NOW(),$10::jsonb,$11,$12,$13::jsonb,
            $14,$15,$16,$17,$18,cover_image_hash,cover_image_width,cover_image_height,cover_image_updated_at,$9,$9
       FROM corporate_english_module_videos WHERE video_id=$1::uuid
     ON CONFLICT (note_id) DO NOTHING RETURNING *`,
    [body.sourceVideoId, payload.title, payload.originalTitle, payload.summary, payload.authorName, payload.sourceName,
      payload.sourceUrl, payload.rightsBasis, payload.actor, JSON.stringify(payload.contentBlocks), payload.category,
      payload.difficultyLevel, JSON.stringify(payload.tags), payload.accessTier, payload.status, payload.isFeatured,
      payload.sortOrder, payload.publishedAt]
  )
  return mapCareerGrowthNote(rows?.[0])
}

export async function saveVideoWithCareerGrowthNote({ id = '', video, noteBody, actor = '' }) {
  const safeActor = text(actor, 255) || 'admin'
  const existingRows = id ? await neonHelper.query(
    `SELECT video.video_id, video.cover_image_hash AS video_cover_image_hash, note.*
       FROM corporate_english_module_videos video
       LEFT JOIN career_growth_notes note ON note.source_video_id=video.video_id
      WHERE video.video_id=$1::uuid AND video.deleted_at IS NULL LIMIT 1`,
    [id]
  ) : []
  const existing = existingRows?.[0] || null
  if (id && !existing) throw Object.assign(new Error('Video not found'), { statusCode: 404 })
  const hasExistingNote = Boolean(existing?.note_id)
  const hasNote = Boolean(noteBody?.videoNotes?.length || noteBody?.video_notes?.length || hasExistingNote)
  let note = null
  let expectedVersion = null
  if (hasNote) {
    const syntheticExisting = hasExistingNote ? existing : {
      origin_type: 'video',
      source_video_id: id || '00000000-0000-4000-8000-000000000000',
      cover_image_hash: existing?.video_cover_image_hash || ''
    }
    note = normalizeCareerGrowthNote({
      originType: 'video',
      sourceVideoId: syntheticExisting.source_video_id,
      title: noteBody.noteTitle || noteBody.titleZh || video.title,
      originalTitle: noteBody.noteOriginalTitle || video.title,
      summary: noteBody.noteSummary ?? video.description,
      authorName: noteBody.noteAuthor || 'Haigoo 职业研究',
      sourceName: noteBody.noteSourceName || video.videoSource || '',
      sourceUrl: noteBody.noteSourceUrl || '',
      rightsBasis: 'linked_video',
      rightsConfirmed: true,
      contentBlocks: noteBody.videoNotes || noteBody.video_notes,
      category: noteBody.noteCategory || '远程职业准备',
      difficultyLevel: video.difficultyLevel || '',
      tags: video.tags || [],
      accessTier: noteBody.noteAccessTier || video.accessTier || 'vip',
      status: noteBody.noteStatus || video.status || 'draft',
      isFeatured: noteBody.noteIsFeatured ?? video.isFeatured,
      sortOrder: noteBody.noteSortOrder ?? video.sortOrder,
      publishedAt: noteBody.notePublishedAt || video.publishedAt,
      coverImageHash: syntheticExisting.cover_image_hash
    }, syntheticExisting, safeActor)
    if (hasExistingNote) {
      expectedVersion = Number(noteBody.noteVersion ?? noteBody.version)
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        throw Object.assign(new Error('缺少有效的笔记版本'), { statusCode: 400 })
      }
    }
  }
  const videoJson = JSON.stringify({
    ...video,
    publishedAt: video.publishedAt instanceof Date ? video.publishedAt.toISOString() : video.publishedAt
  })
  const noteJson = JSON.stringify(note || {})
  const selectNoteFields = `
    saved_note.note_id,
    saved_note.title AS note_title,
    saved_note.original_title AS note_original_title,
    saved_note.summary AS note_summary,
    saved_note.author_name AS note_author,
    saved_note.source_name AS note_source_name,
    saved_note.source_url AS note_source_url,
    saved_note.category AS note_category,
    saved_note.access_tier AS note_access_tier,
    saved_note.status AS note_status,
    saved_note.is_featured AS note_is_featured,
    saved_note.sort_order AS note_sort_order,
    saved_note.published_at AS note_published_at,
    saved_note.version AS note_version,
    saved_note.updated_at AS note_updated_at`

  if (id) {
    const rows = await neonHelper.query(
      `WITH saved_note AS (
         INSERT INTO career_growth_notes (
           note_id, origin_type, source_video_id, title, original_title, summary, author_name,
           source_name, source_url, rights_basis, rights_confirmed, rights_confirmed_by, rights_confirmed_at,
           content_blocks, category, difficulty_level, tags, access_tier, status,
           is_featured, sort_order, published_at, cover_image_hash, cover_image_width,
           cover_image_height, cover_image_updated_at, created_by, updated_by
         )
         SELECT video_id, 'video', video_id, ($3::jsonb)->>'title', ($3::jsonb)->>'originalTitle',
                ($3::jsonb)->>'summary', ($3::jsonb)->>'authorName', ($3::jsonb)->>'sourceName', ($3::jsonb)->>'sourceUrl',
                'linked_video', TRUE, $6, NOW(), (($3::jsonb)->'contentBlocks')::jsonb,
                ($3::jsonb)->>'category', ($3::jsonb)->>'difficultyLevel', (($3::jsonb)->'tags')::jsonb,
                ($3::jsonb)->>'accessTier', ($3::jsonb)->>'status', (($3::jsonb)->>'isFeatured')::boolean,
                (($3::jsonb)->>'sortOrder')::int, (($3::jsonb)->>'publishedAt')::timestamptz,
                cover_image_hash, cover_image_width, cover_image_height, cover_image_updated_at, $6, $6
           FROM corporate_english_module_videos
          WHERE video_id=$1::uuid AND deleted_at IS NULL AND $5::boolean
         ON CONFLICT (note_id) DO UPDATE SET
           title=EXCLUDED.title, original_title=EXCLUDED.original_title, summary=EXCLUDED.summary,
           author_name=EXCLUDED.author_name, source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
           rights_basis='linked_video', rights_confirmed=TRUE, rights_confirmed_by=$6,
           rights_confirmed_at=COALESCE(career_growth_notes.rights_confirmed_at, NOW()),
           content_blocks=EXCLUDED.content_blocks, category=EXCLUDED.category,
           difficulty_level=EXCLUDED.difficulty_level, tags=EXCLUDED.tags,
           access_tier=EXCLUDED.access_tier, status=EXCLUDED.status,
           is_featured=EXCLUDED.is_featured, sort_order=EXCLUDED.sort_order,
           published_at=EXCLUDED.published_at, version=career_growth_notes.version+1,
           updated_by=$6, updated_at=NOW()
         WHERE career_growth_notes.version=$4::int
         RETURNING *
       ), changed_video AS (
         UPDATE corporate_english_module_videos
            SET module_key=($2::jsonb)->>'moduleKey', video_title=($2::jsonb)->>'title',
                description=($2::jsonb)->>'description', tencent_iframe_url=($2::jsonb)->>'tencentIframeUrl',
                video_source=($2::jsonb)->>'videoSource', category=($2::jsonb)->>'category',
                difficulty_level=($2::jsonb)->>'difficultyLevel', video_notes=(($2::jsonb)->'videoNotes')::jsonb,
                title_zh=CASE WHEN $5::boolean THEN ($3::jsonb)->>'title' ELSE title_zh END,
                tags=(($2::jsonb)->'tags')::jsonb, access_tier=($2::jsonb)->>'accessTier',
                status=($2::jsonb)->>'status', sort_order=(($2::jsonb)->>'sortOrder')::int,
                published_at=(($2::jsonb)->>'publishedAt')::timestamptz,
                is_featured=(($2::jsonb)->>'isFeatured')::boolean, updated_by=$6, updated_at=NOW()
          WHERE video_id=$1::uuid AND deleted_at IS NULL
            AND (NOT $5::boolean OR EXISTS (SELECT 1 FROM saved_note))
          RETURNING *
       )
       SELECT changed_video.*, ${selectNoteFields}
         FROM changed_video
         LEFT JOIN saved_note ON saved_note.source_video_id=changed_video.video_id`,
      [id, videoJson, noteJson, expectedVersion, hasNote, safeActor]
    )
    if (!rows?.[0]) {
      if (hasNote) throw Object.assign(new Error('笔记已被其他入口更新，请重新载入'), { statusCode: 409 })
      throw Object.assign(new Error('Video not found'), { statusCode: 404 })
    }
    return rows[0]
  }

  const rows = await neonHelper.query(
    `WITH inserted_video AS (
       INSERT INTO corporate_english_module_videos (
         module_key, video_title, description, tencent_iframe_url, video_source,
         category, difficulty_level, video_notes, title_zh, tags, access_tier,
         status, sort_order, published_at, is_featured, created_by, updated_by
       ) VALUES (
         ($1::jsonb)->>'moduleKey', ($1::jsonb)->>'title', ($1::jsonb)->>'description', ($1::jsonb)->>'tencentIframeUrl',
         ($1::jsonb)->>'videoSource', ($1::jsonb)->>'category', ($1::jsonb)->>'difficultyLevel',
         (($1::jsonb)->'videoNotes')::jsonb, CASE WHEN $3::boolean THEN ($2::jsonb)->>'title' ELSE '' END,
         (($1::jsonb)->'tags')::jsonb, ($1::jsonb)->>'accessTier', ($1::jsonb)->>'status',
         (($1::jsonb)->>'sortOrder')::int, (($1::jsonb)->>'publishedAt')::timestamptz,
         (($1::jsonb)->>'isFeatured')::boolean, $4, $4
       ) RETURNING *
     ), saved_note AS (
       INSERT INTO career_growth_notes (
         note_id, origin_type, source_video_id, title, original_title, summary, author_name,
         source_name, source_url, rights_basis, rights_confirmed, rights_confirmed_by, rights_confirmed_at,
         content_blocks, category, difficulty_level, tags, access_tier, status,
         is_featured, sort_order, published_at, cover_image_hash, cover_image_width,
         cover_image_height, cover_image_updated_at, created_by, updated_by
       )
       SELECT video_id, 'video', video_id, ($2::jsonb)->>'title', ($2::jsonb)->>'originalTitle',
              ($2::jsonb)->>'summary', ($2::jsonb)->>'authorName', ($2::jsonb)->>'sourceName', ($2::jsonb)->>'sourceUrl',
              'linked_video', TRUE, $4, NOW(), (($2::jsonb)->'contentBlocks')::jsonb,
              ($2::jsonb)->>'category', ($2::jsonb)->>'difficultyLevel', (($2::jsonb)->'tags')::jsonb,
              ($2::jsonb)->>'accessTier', ($2::jsonb)->>'status', (($2::jsonb)->>'isFeatured')::boolean,
              (($2::jsonb)->>'sortOrder')::int, (($2::jsonb)->>'publishedAt')::timestamptz,
              cover_image_hash, cover_image_width, cover_image_height, cover_image_updated_at, $4, $4
         FROM inserted_video WHERE $3::boolean
       RETURNING *
     )
     SELECT inserted_video.*, ${selectNoteFields}
       FROM inserted_video
       LEFT JOIN saved_note ON saved_note.source_video_id=inserted_video.video_id`,
    [videoJson, noteJson, hasNote, safeActor]
  )
  return rows?.[0] || null
}
