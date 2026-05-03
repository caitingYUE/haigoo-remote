import crypto from 'node:crypto'
import net from 'node:net'
import fetch from 'node-fetch'
import sharp from 'sharp'

const ASSET_TABLE = 'company_image_assets'
const DEFAULT_FETCH_TIMEOUT_MS = 12000
const DEFAULT_MAX_SOURCE_BYTES = 3 * 1024 * 1024
const LOGO_MAX_SIZE = 256
let assetSchemaReady = null

function isMissingAssetSchema(error) {
  const message = String(error?.message || '')
  return message.includes(ASSET_TABLE)
    || message.includes('cached_logo_url')
    || message.includes('logo_cache_status')
    || message.includes('logo_cache_hash')
}

function isPrivateHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase()
  if (!normalized) return true
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true

  const ipType = net.isIP(normalized)
  if (ipType === 4) {
    const [a, b] = normalized.split('.').map(Number)
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a === 0
  }
  if (ipType === 6) {
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80')
  }
  return false
}

export function normalizePublicImageUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    if (isPrivateHostname(parsed.hostname)) return ''
    return parsed.toString()
  } catch (_) {
    return ''
  }
}

export function buildCompanyAssetUrl(companyId, assetType = 'logo', hash = '') {
  const id = String(companyId || '').trim()
  if (!id) return ''
  const params = new URLSearchParams()
  params.set('companyId', id)
  params.set('type', assetType)
  if (hash) params.set('v', String(hash).slice(0, 16))
  return `/api/company-assets?${params.toString()}`
}

export function resolveCachedLogoUrlFromRow(row) {
  if (!row) return ''
  const explicitUrl = String(row.cached_logo_url || row.trusted_cached_logo_url || '').trim()
  if (explicitUrl) return explicitUrl

  const status = String(row.logo_cache_status || row.trusted_logo_cache_status || '').trim().toLowerCase()
  const companyId = row.company_id || row.trusted_company_id
  if (status !== 'ready' || !companyId) return ''

  return buildCompanyAssetUrl(companyId, 'logo', row.logo_cache_hash || row.trusted_logo_cache_hash || '')
}

async function markLogoCacheFailure(client, companyId, sourceUrl, errorMessage) {
  try {
    await client.query(
      `UPDATE trusted_companies
       SET logo_cache_status = 'failed',
           logo_cache_error = $2,
           logo_cached_at = NOW(),
           cached_logo_url = NULL,
           logo_cache_hash = NULL
       WHERE company_id = $1`,
      [companyId, String(errorMessage || 'Failed to cache logo').slice(0, 500)]
    )

    await client.query(
      `INSERT INTO ${ASSET_TABLE}
         (asset_id, company_id, asset_type, source_url, status, error_message, fetched_at, updated_at)
       VALUES ($1, $2, 'logo', $3, 'failed', $4, NOW(), NOW())
       ON CONFLICT (company_id, asset_type) DO UPDATE SET
         source_url = EXCLUDED.source_url,
         status = 'failed',
         error_message = EXCLUDED.error_message,
         fetched_at = NOW(),
         updated_at = NOW()`,
      [`${companyId}:logo`, companyId, sourceUrl || null, String(errorMessage || 'Failed to cache logo').slice(0, 500)]
    )
  } catch (error) {
    if (!isMissingAssetSchema(error)) {
      console.warn('[company-image-assets] Failed to mark logo cache failure:', error?.message || error)
    }
  }
}

async function fetchImageBuffer(sourceUrl, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      throw new Error(`Source image responded ${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length') || 0)
    const maxBytes = options.maxBytes || DEFAULT_MAX_SOURCE_BYTES
    if (contentLength && contentLength > maxBytes) {
      throw new Error(`Source image is too large: ${contentLength} bytes`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > maxBytes) {
      throw new Error(`Source image is too large: ${buffer.length} bytes`)
    }
    return buffer
  } finally {
    clearTimeout(timeout)
  }
}

async function processLogoBuffer(sourceBuffer) {
  const pipeline = sharp(sourceBuffer, { animated: false })
    .rotate()
    .resize(LOGO_MAX_SIZE, LOGO_MAX_SIZE, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 84, effort: 4 })

  const outputBuffer = await pipeline.toBuffer()
  const metadata = await sharp(outputBuffer).metadata()
  return {
    buffer: outputBuffer,
    mimeType: 'image/webp',
    format: 'webp',
    width: metadata.width || null,
    height: metadata.height || null
  }
}

export async function cacheCompanyLogoAsset(client, companyId, logoUrl, options = {}) {
  const id = String(companyId || '').trim()
  const sourceUrl = normalizePublicImageUrl(logoUrl)
  if (!id || !sourceUrl) {
    return { success: false, skipped: true, reason: 'missing_company_or_public_url' }
  }

  try {
    if (assetSchemaReady !== true) {
      try {
        await client.query(`SELECT 1 FROM ${ASSET_TABLE} LIMIT 1`)
        assetSchemaReady = true
      } catch (schemaError) {
        if (isMissingAssetSchema(schemaError)) {
          return { success: false, skipped: true, reason: 'asset_schema_missing' }
        }
        throw schemaError
      }
    }

    const sourceBuffer = await fetchImageBuffer(sourceUrl, options)
    const processed = await processLogoBuffer(sourceBuffer)
    const sha256 = crypto.createHash('sha256').update(processed.buffer).digest('hex')
    const assetId = `${id}:logo`
    const publicUrl = buildCompanyAssetUrl(id, 'logo', sha256)

    await client.query(
      `INSERT INTO ${ASSET_TABLE}
         (asset_id, company_id, asset_type, source_url, content, mime_type, format, width, height, size_bytes, sha256, status, error_message, fetched_at, updated_at)
       VALUES ($1, $2, 'logo', $3, $4, $5, $6, $7, $8, $9, $10, 'ready', NULL, NOW(), NOW())
       ON CONFLICT (company_id, asset_type) DO UPDATE SET
         source_url = EXCLUDED.source_url,
         content = EXCLUDED.content,
         mime_type = EXCLUDED.mime_type,
         format = EXCLUDED.format,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         size_bytes = EXCLUDED.size_bytes,
         sha256 = EXCLUDED.sha256,
         status = 'ready',
         error_message = NULL,
         fetched_at = NOW(),
         updated_at = NOW()`,
      [
        assetId,
        id,
        sourceUrl,
        processed.buffer,
        processed.mimeType,
        processed.format,
        processed.width,
        processed.height,
        processed.buffer.length,
        sha256
      ]
    )

    await client.query(
      `UPDATE trusted_companies
       SET cached_logo_url = $2,
           logo_cache_status = 'ready',
           logo_cache_hash = $3,
           logo_cache_error = NULL,
           logo_cached_at = NOW()
       WHERE company_id = $1`,
      [id, publicUrl, sha256]
    )

    return {
      success: true,
      companyId: id,
      sourceUrl,
      cachedLogoUrl: publicUrl,
      hash: sha256,
      sizeBytes: processed.buffer.length
    }
  } catch (error) {
    if (isMissingAssetSchema(error)) {
      return { success: false, skipped: true, reason: 'asset_schema_missing' }
    }
    await markLogoCacheFailure(client, id, sourceUrl, error?.message || error)
    return { success: false, error: error?.message || String(error) }
  }
}

export async function cacheCompanyLogoBestEffort(client, companyId, logoUrl, options = {}) {
  try {
    return await cacheCompanyLogoAsset(client, companyId, logoUrl, options)
  } catch (error) {
    console.warn('[company-image-assets] Best-effort logo cache failed:', error?.message || error)
    return { success: false, error: error?.message || String(error) }
  }
}

export async function getCompanyImageAsset(client, companyId, assetType = 'logo') {
  const id = String(companyId || '').trim()
  const type = String(assetType || 'logo').trim().toLowerCase()
  if (!id || type !== 'logo') return null

  try {
    const rows = await client.query(
      `SELECT asset_id, company_id, asset_type, content, mime_type, sha256, size_bytes, updated_at
       FROM ${ASSET_TABLE}
       WHERE company_id = $1 AND asset_type = $2 AND status = 'ready' AND content IS NOT NULL
       LIMIT 1`,
      [id, type]
    )
    return rows?.[0] || null
  } catch (error) {
    if (!isMissingAssetSchema(error)) {
      console.warn('[company-image-assets] Failed to read image asset:', error?.message || error)
    }
    return null
  }
}

export { isMissingAssetSchema }
