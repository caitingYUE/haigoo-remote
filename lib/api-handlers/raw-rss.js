// 导入 Neon 数据库帮助类
import neonHelper from '../../server-utils/dal/neon-helper.js'
const NEON_CONFIGURED = neonHelper?.isConfigured

// 表名常量
const RAW_RSS_TABLE = 'raw_rss'

// Sanitizers
function sanitizeHtml(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim()
}

function truncateString(str, maxBytes) {
  if (!str || typeof str !== 'string') return ''
  const enc = new TextEncoder()
  const bytes = enc.encode(str)
  if (bytes.length <= maxBytes) return str
  const truncated = bytes.slice(0, maxBytes)
  const dec = new TextDecoder()
  let out = dec.decode(truncated)
  while (enc.encode(out).length > maxBytes) {
    out = out.slice(0, -1)
  }
  return out
}

// Dedup helpers
function generateDedupKey(item) {
  if (item.id && typeof item.id === 'string' && item.id.length > 0) return `id:${item.id}`
  
  // Clean URL params for better deduplication
  const cleanLink = (link) => {
    if (!link) return '';
    try {
      const url = new URL(link);
      // Remove query params that often change (utm_*, ref, etc)
      // Actually, removing ALL query params is safer for deduplication unless the job ID is in the query
      // Let's be aggressive: remove search string entirely
      return `${url.origin}${url.pathname}`.toLowerCase();
    } catch {
      return link.toLowerCase().split('?')[0];
    }
  };

  const key = `${cleanLink(item.link)}|${(item.title || '').toLowerCase()}|${(item.source || '').toLowerCase()}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash = hash & hash
  }
  return `hash:${Math.abs(hash).toString(36)}`
}

function filterRecent(items, maxDays = 7) {
  const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)
  return items.filter(i => new Date(i.fetchedAt || i.pubDate) >= cutoff)
}

function removeDuplicatesRaw(items) {
  const seen = new Map()
  return items.filter(i => {
    const key = generateDedupKey(i)
    if (seen.has(key)) {
      const ex = seen.get(key)
      const newScore = (i.description?.length || 0) + (i.rawContent?.length || 0)
      const exScore = (ex.description?.length || 0) + (ex.rawContent?.length || 0)
      if (newScore > exScore || new Date(i.fetchedAt || 0) > new Date(ex.fetchedAt || 0)) {
        seen.set(key, i)
      }
      return false
    }
    seen.set(key, i)
    return true
  })
}

// Neon 数据库操作函数
async function readRawFromNeon(queryParams = {}) {
  if (!NEON_CONFIGURED) {
    console.warn('[raw-rss] Neon database not configured')
    return []
  }

  try {
    const { page = 1, limit = 50, source, category, status, dateFrom, dateTo } = queryParams
    const pageNum = Number(page) || 1
    const pageSize = Number(limit) || 50
    const offset = (pageNum - 1) * pageSize

    // 构建 WHERE 条件
    const whereConditions = []
    const params = []
    let paramIndex = 1

    if (source) {
      whereConditions.push(`source = $${paramIndex}`)
      params.push(source)
      paramIndex++
    }

    if (category) {
      whereConditions.push(`category = $${paramIndex}`)
      params.push(category)
      paramIndex++
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (dateFrom) {
      whereConditions.push(`fetched_at >= $${paramIndex}`)
      params.push(new Date(dateFrom).toISOString())
      paramIndex++
    }

    if (dateTo) {
      whereConditions.push(`fetched_at <= $${paramIndex}`)
      params.push(new Date(dateTo).toISOString())
      paramIndex++
    }

    // 添加最近7天的过滤
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    whereConditions.push(`fetched_at >= $${paramIndex}`)
    params.push(sevenDaysAgo.toISOString())
    paramIndex++

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 查询数据
    const query = `
      SELECT * FROM ${RAW_RSS_TABLE}
      ${whereClause}
      ORDER BY fetched_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(pageSize, offset)

    const result = await neonHelper.query(query, params)
    if (!result || !Array.isArray(result)) return []

    // 转换数据格式
    return result.map(row => ({
      id: row.raw_id,
      source: row.source,
      category: row.category,
      url: row.url,
      title: row.title,
      description: row.description,
      link: row.link,
      pubDate: row.pub_date,
      rawContent: row.raw_content,
      fetchedAt: row.fetched_at,
      status: row.status,
      processingError: row.processing_error
    }))
  } catch (error) {
    console.error('[raw-rss] Error reading from Neon database:', error)
    return []
  }
}

async function countRawFromNeon(queryParams = {}) {
  if (!NEON_CONFIGURED) return 0

  try {
    const { source, category, status, dateFrom, dateTo } = queryParams

    // 构建 WHERE 条件
    const whereConditions = []
    const params = []
    let paramIndex = 1

    if (source) {
      whereConditions.push(`source = $${paramIndex}`)
      params.push(source)
      paramIndex++
    }

    if (category) {
      whereConditions.push(`category = $${paramIndex}`)
      params.push(category)
      paramIndex++
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`)
      params.push(status)
      paramIndex++
    }

    if (dateFrom) {
      whereConditions.push(`fetched_at >= $${paramIndex}`)
      params.push(new Date(dateFrom).toISOString())
      paramIndex++
    }

    if (dateTo) {
      whereConditions.push(`fetched_at <= $${paramIndex}`)
      params.push(new Date(dateTo).toISOString())
      paramIndex++
    }

    // 添加最近7天的过滤
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    whereConditions.push(`fetched_at >= $${paramIndex}`)
    params.push(sevenDaysAgo.toISOString())
    paramIndex++

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const query = `SELECT COUNT(*) as total FROM ${RAW_RSS_TABLE} ${whereClause}`
    const result = await neonHelper.query(query, params)

    return result && result[0] ? parseInt(result[0].total) : 0
  } catch (error) {
    console.error('[raw-rss] Error counting from Neon database:', error)
    return 0
  }
}

async function writeRawToNeon(items, mode = 'append') {
  if (!NEON_CONFIGURED) {
    console.warn('[raw-rss] Neon database not configured')
    return []
  }

  try {
    const filtered = filterRecent(removeDuplicatesRaw(items), 7)

    if (mode === 'replace') {
      // 替换模式：先清空表，再插入新数据
      await neonHelper.query(`DELETE FROM ${RAW_RSS_TABLE}`)
    }

    // 批量插入数据
    if (filtered.length > 0) {
      const values = filtered.map(item => {
        const normalized = normalizeItem(item)
        return [
          normalized.id,
          normalized.source,
          normalized.category,
          normalized.url,
          normalized.title,
          normalized.description,
          normalized.link,
          new Date(normalized.pubDate),
          normalized.rawContent,
          new Date(normalized.fetchedAt),
          normalized.status,
          normalized.processingError
        ]
      })

      const query = `
        INSERT INTO ${RAW_RSS_TABLE} (
          raw_id, source, category, url, title, description, link, 
          pub_date, raw_content, fetched_at, status, processing_error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (raw_id) DO UPDATE SET
          source = EXCLUDED.source,
          category = EXCLUDED.category,
          url = EXCLUDED.url,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          link = EXCLUDED.link,
          pub_date = EXCLUDED.pub_date,
          raw_content = EXCLUDED.raw_content,
          fetched_at = EXCLUDED.fetched_at,
          status = EXCLUDED.status,
          processing_error = EXCLUDED.processing_error,
          updated_at = CURRENT_TIMESTAMP
      `

      // 使用事务批量插入
      await neonHelper.transaction(async (sql) => {
        for (const value of values) {
          await sql.query(query, value)
        }
      })
    }

    return filtered
  } catch (error) {
    console.error('[raw-rss] Error writing to Neon database:', error)
    return []
  }
}

function normalizeItem(item) {
  const safe = {
    id: String(item.id || ''),
    source: truncateString(String(item.source || ''), 100),
    category: truncateString(String(item.category || ''), 100),
    url: truncateString(String(item.url || ''), 2000),
    title: truncateString(sanitizeHtml(String(item.title || '')), 500),
    description: truncateString(sanitizeHtml(String(item.description || '')), 50000),
    link: truncateString(String(item.link || ''), 2000),
    pubDate: String(item.pubDate || new Date().toISOString()),
    rawContent: truncateString(String(item.rawContent || ''), 100000),
    fetchedAt: String(item.fetchedAt || new Date().toISOString()),
    status: item.status === 'processed' ? 'processed' : (item.status === 'error' ? 'error' : 'raw'),
    processingError: truncateString(String(item.processingError || ''), 2000),
    // Reserve enterprise fields
    companyIndustry: String(item.companyIndustry || ''),
    companyTags: Array.isArray(item.companyTags) ? item.companyTags : [],
    companyWebsite: String(item.companyWebsite || ''),
    companyDescription: String(item.companyDescription || '')
  }
  // If id missing, derive from link+source
  if (!safe.id) {
    const base = `${safe.link}|${safe.source}`.toLowerCase()
    let hash = 0
    for (let i = 0; i < base.length; i++) {
      const c = base.charCodeAt(i)
      hash = ((hash << 5) - hash) + c
      hash = hash & hash
    }
    safe.id = `raw_${Math.abs(hash).toString(36)}`
  }
  return safe
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      const { page = '1', limit = '50', source, category, status, dateFrom, dateTo } = req.query || {}
      const pageNum = Number(page) || 1
      const pageSize = Number(limit) || 50

      const startTime = Date.now()

      // 直接从 Neon 数据库读取数据，包含过滤和分页
      const items = await readRawFromNeon({ page: pageNum, limit: pageSize, source, category, status, dateFrom, dateTo })
      const total = await countRawFromNeon({ source, category, status, dateFrom, dateTo })

      const totalPages = Math.ceil(total / pageSize)
      const provider = NEON_CONFIGURED ? 'neon' : 'not-configured'

      console.log(`[raw-rss] GET: Neon database read success, ${items.length} items, total: ${total}, ${Date.now() - startTime}ms`)

      // 强制禁用缓存，确保前端刷新拿到最新数据
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-Neon-Configured', String(!!NEON_CONFIGURED))
      return res.status(200).json({ items, total, page: pageNum, pageSize, totalPages })
    }

    if (req.method === 'POST') {
      let body = req.body
      if (!body || typeof body !== 'object') {
        body = await new Promise((resolve) => {
          let data = ''
          req.on('data', chunk => { data += chunk })
          req.on('end', () => {
            try { resolve(JSON.parse(data)) } catch { resolve({}) }
          })
        })
      }
      const items = Array.isArray(body.items) ? body.items : []
      const mode = body.mode === 'replace' ? 'replace' : 'append'
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items must be a non-empty array' })
      }
      const normalized = items.map(normalizeItem)
      const startTime = Date.now()

      // 直接写入 Neon 数据库
      const written = await writeRawToNeon(normalized, mode)
      const provider = NEON_CONFIGURED ? 'neon' : 'not-configured'

      console.log(`[raw-rss] POST ${mode}: stored ${written.length} items via ${provider}, ${Date.now() - startTime}ms`)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-Neon-Configured', String(!!NEON_CONFIGURED))
      return res.status(200).json({ ok: true, stored: written.length })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('[raw-rss] handler error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

// Export internal functions for cron handlers
export {
  readRawFromNeon as readAllRawItems,
  writeRawToNeon as saveRawItems,
  countRawFromNeon
}