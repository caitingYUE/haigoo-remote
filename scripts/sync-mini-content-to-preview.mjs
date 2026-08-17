import fs from 'node:fs'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const previewEnvPath = process.argv.find((argument) => argument.startsWith('--preview-env='))?.slice('--preview-env='.length)
if (!previewEnvPath || !fs.existsSync(previewEnvPath)) {
  throw new Error('Usage: node scripts/sync-mini-content-to-preview.mjs --preview-env=/path/to/preview.env')
}

function parseEnvFile(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!match) return []
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    return [[match[1], value.replace(/\\n/g, '\n')]]
  }))
}

const previewEnv = parseEnvFile(fs.readFileSync(previewEnvPath, 'utf8'))
const sourceUrl = process.env.NEON_DATABASE_DATABASE_URL || process.env.DATABASE_URL
const targetUrl = previewEnv.NEON_DATABASE_DATABASE_URL || previewEnv.DATABASE_URL
if (!sourceUrl || !targetUrl) throw new Error('Production and Preview database URLs are required')
if (sourceUrl === targetUrl) throw new Error('Refusing to sync when source and target databases are identical')

const source = neon(sourceUrl)
const target = neon(targetUrl)
const notes = await source.query(
  `SELECT * FROM career_growth_notes
    WHERE status = 'published'
      AND jsonb_typeof(content_blocks) = 'array'
      AND jsonb_array_length(content_blocks) > 0
    ORDER BY sort_order ASC, published_at DESC`,
  []
)

if (notes.length === 0 || notes.length > 200) throw new Error(`Unexpected published note count: ${notes.length}`)

for (const note of notes) {
  if (note.source_video_id) {
    const videos = await source.query(
      `SELECT video_id, module_key, video_title, description, tencent_iframe_url, category,
              tags, access_tier, status, sort_order, published_at, created_at, updated_at,
              video_source, cover_image_hash, cover_image_width, cover_image_height,
              cover_image_updated_at, duration_ms, difficulty_level, video_notes, is_featured
         FROM corporate_english_module_videos
        WHERE video_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [note.source_video_id]
    )
    const video = videos[0]
    if (!video) throw new Error(`Linked video missing for note ${note.note_id}`)
    await target.query(
      `INSERT INTO corporate_english_module_videos (
         video_id, module_key, video_title, description, tencent_iframe_url, category,
         tags, access_tier, status, sort_order, published_at, created_at, updated_at,
         deleted_at, video_source, cover_image_hash, cover_image_width, cover_image_height,
         cover_image_updated_at, duration_ms, difficulty_level, video_notes, is_featured
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,NULL,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22)
       ON CONFLICT (video_id) DO UPDATE SET
         video_title=EXCLUDED.video_title, description=EXCLUDED.description,
         tencent_iframe_url=EXCLUDED.tencent_iframe_url, tags=EXCLUDED.tags,
         access_tier=EXCLUDED.access_tier, status=EXCLUDED.status,
         sort_order=EXCLUDED.sort_order, published_at=EXCLUDED.published_at,
         updated_at=EXCLUDED.updated_at, video_source=EXCLUDED.video_source,
         cover_image_hash=EXCLUDED.cover_image_hash, cover_image_width=EXCLUDED.cover_image_width,
         cover_image_height=EXCLUDED.cover_image_height, cover_image_updated_at=EXCLUDED.cover_image_updated_at,
         duration_ms=EXCLUDED.duration_ms, difficulty_level=EXCLUDED.difficulty_level,
         video_notes=EXCLUDED.video_notes, is_featured=EXCLUDED.is_featured, deleted_at=NULL`,
      [video.video_id, video.module_key, video.video_title, video.description, video.tencent_iframe_url || '', video.category || '',
        JSON.stringify(video.tags || []), video.access_tier, video.status, video.sort_order, video.published_at,
        video.created_at, video.updated_at, video.video_source || '', video.cover_image_hash, video.cover_image_width,
        video.cover_image_height, video.cover_image_updated_at, video.duration_ms, video.difficulty_level || '',
        JSON.stringify(video.video_notes || []), Boolean(video.is_featured)]
    )
  }

  await target.query(
    `INSERT INTO career_growth_notes (
       note_id, origin_type, source_video_id, title, original_title, summary, author_name,
       source_name, source_url, rights_basis, rights_confirmed, rights_confirmed_by,
       rights_confirmed_at, content_blocks, category, difficulty_level, tags, access_tier,
       status, is_featured, sort_order, published_at, cover_image_hash, cover_image_width,
       cover_image_height, cover_image_updated_at, version, created_by, updated_by, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
     ON CONFLICT (note_id) DO UPDATE SET
       origin_type=EXCLUDED.origin_type, source_video_id=EXCLUDED.source_video_id,
       title=EXCLUDED.title, original_title=EXCLUDED.original_title, summary=EXCLUDED.summary,
       author_name=EXCLUDED.author_name, source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
       rights_basis=EXCLUDED.rights_basis, rights_confirmed=EXCLUDED.rights_confirmed,
       rights_confirmed_by=EXCLUDED.rights_confirmed_by, rights_confirmed_at=EXCLUDED.rights_confirmed_at,
       content_blocks=EXCLUDED.content_blocks, category=EXCLUDED.category,
       difficulty_level=EXCLUDED.difficulty_level, tags=EXCLUDED.tags,
       access_tier=EXCLUDED.access_tier, status=EXCLUDED.status, is_featured=EXCLUDED.is_featured,
       sort_order=EXCLUDED.sort_order, published_at=EXCLUDED.published_at,
       cover_image_hash=EXCLUDED.cover_image_hash, cover_image_width=EXCLUDED.cover_image_width,
       cover_image_height=EXCLUDED.cover_image_height, cover_image_updated_at=EXCLUDED.cover_image_updated_at,
       version=EXCLUDED.version, updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at`,
    [note.note_id, note.origin_type, note.source_video_id, note.title, note.original_title, note.summary,
      note.author_name, note.source_name, note.source_url, note.rights_basis, note.rights_confirmed,
      note.rights_confirmed_by, note.rights_confirmed_at, JSON.stringify(note.content_blocks || []), note.category,
      note.difficulty_level, JSON.stringify(note.tags || []), note.access_tier, note.status, note.is_featured,
      note.sort_order, note.published_at, note.cover_image_hash, note.cover_image_width, note.cover_image_height,
      note.cover_image_updated_at, note.version, note.created_by, note.updated_by, note.created_at, note.updated_at]
  )

  const ownerType = note.origin_type === 'video' ? 'module_video' : 'growth_note'
  const ownerId = note.source_video_id || note.note_id
  const assets = await source.query(
    `SELECT variant, filename, mime_type, content, width, height, size_bytes, sha256, created_by, created_at, updated_at
       FROM corporate_english_cover_assets
      WHERE owner_type=$1 AND owner_id=$2`,
    [ownerType, ownerId]
  )
  for (const asset of assets) {
    await target.query(
      `INSERT INTO corporate_english_cover_assets
       (owner_type, owner_id, variant, filename, mime_type, content, width, height, size_bytes, sha256, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (owner_type, owner_id, variant) DO UPDATE SET
         filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type, content=EXCLUDED.content,
         width=EXCLUDED.width, height=EXCLUDED.height, size_bytes=EXCLUDED.size_bytes,
         sha256=EXCLUDED.sha256, created_by=EXCLUDED.created_by, updated_at=EXCLUDED.updated_at`,
      [ownerType, ownerId, asset.variant, asset.filename, asset.mime_type, asset.content, asset.width,
        asset.height, asset.size_bytes, asset.sha256, asset.created_by, asset.created_at, asset.updated_at]
    )
  }
}

console.log(JSON.stringify({ synced: notes.length, ids: notes.map((note) => note.note_id) }, null, 2))
