// 安全加载 Vercel KV：避免顶层导入在本地环境报错
let kv = null
try {
  const kvModule = require('@vercel/kv')
  kv = kvModule?.kv || null
} catch (e) {
  console.warn('[raw-rss] Vercel KV module not available, will use fallbacks')
}

// 统一环境变量解析
function getEnv(...names) {
  const variants = (name) => [
    name,
    `haigoo_${name}`,
    `HAIGOO_${name}`,
    `pre_${name}`,
    `PRE_${name}`,
    `pre_haigoo_${name}`,
    `PRE_HAIGOO_${name}`
  ]
  for (const base of names) {
    for (const key of variants(base)) {
      if (process.env[key]) return process.env[key]
    }
  }
  return null
}

// Upstash Redis REST
const UPSTASH_REST_URL = getEnv('UPSTASH_REDIS_REST_URL', 'UPSTASH_REST_URL', 'REDIS_REST_API_URL')
const UPSTASH_REST_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REST_TOKEN', 'REDIS_REST_API_TOKEN')
const UPSTASH_REST_CONFIGURED = !!(UPSTASH_REST_URL && UPSTASH_REST_TOKEN)

// Redis TCP
const REDIS_URL = getEnv('REDIS_URL', 'UPSTASH_REDIS_URL') || null
const REDIS_CONFIGURED = !!REDIS_URL
let __redisClient = globalThis.__haigoo_redis_client || null

// Memory fallback
if (!globalThis.__haigoo_raw_rss_mem) {
  globalThis.__haigoo_raw_rss_mem = []
}
const MEM = globalThis.__haigoo_raw_rss_mem

// Keys
const RAW_KEY = 'haigoo:raw_rss'
const STATS_KEY = 'haigoo:raw_stats'
const LAST_SYNC_KEY = 'haigoo:raw_last_sync'

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
  const key = `${(item.link||'').toLowerCase()}|${(item.title||'').toLowerCase()}|${(item.source||'').toLowerCase()}`
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

// Reader helpers
async function upstashGet(key) {
  if (!UPSTASH_REST_CONFIGURED) throw new Error('Upstash REST not configured')
  try {
    const res = await fetch(`${UPSTASH_REST_URL}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${UPSTASH_REST_TOKEN}` }
    })
    if (res.ok) {
      const json = await res.json().catch(() => null)
      if (json && typeof json.result !== 'undefined') return json.result
    }
  } catch (e) {}
  const res2 = await fetch(`${UPSTASH_REST_URL}/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
    body: JSON.stringify({ key })
  })
  const json2 = await res2.json().catch(() => null)
  return json2?.result ?? null
}

async function upstashSet(key, value) {
  if (!UPSTASH_REST_CONFIGURED) throw new Error('Upstash REST not configured')
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  try {
    const res = await fetch(`${UPSTASH_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_REST_TOKEN}` }
    })
    if (res.ok) return true
  } catch (e) {}
  const res2 = await fetch(`${UPSTASH_REST_URL}/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
    body: JSON.stringify({ key, value: serialized })
  })
  return res2.ok
}

async function readRawFromUpstashREST() {
  const data = await upstashGet(RAW_KEY)
  if (!data) return []
  const items = Array.isArray(data) ? data : JSON.parse(typeof data === 'string' ? data : '[]')
  return items
}

async function writeRawToUpstashREST(items) {
  const filtered = filterRecent(removeDuplicatesRaw(items), 7)
  await upstashSet(RAW_KEY, JSON.stringify(filtered))
  await upstashSet(STATS_KEY, JSON.stringify({
    totalRaw: filtered.length,
    storageSize: JSON.stringify(filtered).length,
    lastSync: new Date().toISOString(),
    provider: 'upstash-rest'
  }))
  await upstashSet(LAST_SYNC_KEY, new Date().toISOString())
  return filtered
}

async function readRawFromKV() {
  if (!kv) return []
  const data = await kv.get(RAW_KEY)
  if (!data) return []
  const items = Array.isArray(data) ? data : JSON.parse(typeof data === 'string' ? data : '[]')
  return items
}

async function writeRawToKV(items) {
  if (!kv) return []
  const filtered = filterRecent(removeDuplicatesRaw(items), 7)
  await kv.set(RAW_KEY, JSON.stringify(filtered))
  await kv.set(STATS_KEY, JSON.stringify({
    totalRaw: filtered.length,
    storageSize: JSON.stringify(filtered).length,
    lastSync: new Date().toISOString(),
    provider: 'vercel-kv'
  }))
  await kv.set(LAST_SYNC_KEY, new Date().toISOString())
  return filtered
}

async function getRedisClient() {
  if (!REDIS_CONFIGURED) throw new Error('Redis not configured')
  if (__redisClient && __redisClient.status === 'ready') return __redisClient
  const Redis = require('ioredis')
  __redisClient = new Redis(REDIS_URL)
  globalThis.__haigoo_redis_client = __redisClient
  return __redisClient
}

async function readRawFromRedis() {
  const client = await getRedisClient()
  const raw = await client.get(RAW_KEY)
  const items = raw ? JSON.parse(raw) : []
  return items
}

async function writeRawToRedis(items) {
  const client = await getRedisClient()
  const filtered = filterRecent(removeDuplicatesRaw(items), 7)
  await client.set(RAW_KEY, JSON.stringify(filtered))
  await client.set(STATS_KEY, JSON.stringify({
    totalRaw: filtered.length,
    storageSize: JSON.stringify(filtered).length,
    lastSync: new Date().toISOString(),
    provider: 'redis'
  }))
  await client.set(LAST_SYNC_KEY, new Date().toISOString())
  return filtered
}

function readRawFromMemory() {
  return Array.isArray(MEM) ? MEM : []
}

function writeRawToMemory(items) {
  const filtered = filterRecent(removeDuplicatesRaw(items), 7)
  MEM.splice(0, MEM.length, ...filtered)
  return filtered
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
    processingError: truncateString(String(item.processingError || ''), 2000)
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

function applyFilters(items, q) {
  let list = items
  if (q.source) list = list.filter(i => i.source === q.source)
  if (q.category) list = list.filter(i => i.category === q.category)
  if (q.status) list = list.filter(i => i.status === q.status)
  if (q.dateFrom || q.dateTo) {
    const from = q.dateFrom ? new Date(q.dateFrom) : null
    const to = q.dateTo ? new Date(q.dateTo) : null
    list = list.filter(i => {
      const d = new Date(i.fetchedAt || i.pubDate)
      return (!from || d >= from) && (!to || d <= to)
    })
  }
  return list.sort((a, b) => new Date(b.fetchedAt || b.pubDate) - new Date(a.fetchedAt || a.pubDate))
}

function paginate(items, pageNum, pageSize) {
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (pageNum - 1) * pageSize
  const end = start + pageSize
  const slice = items.slice(start, end)
  return { items: slice, total, totalPages }
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

      let items = []
      let provider = 'memory'
      const startTime = Date.now()
      if (UPSTASH_REST_CONFIGURED) {
        try {
          items = await readRawFromUpstashREST()
          provider = 'upstash-rest'
          console.log(`[raw-rss] GET: Upstash REST read success, ${items.length} items, ${Date.now() - startTime}ms`)
        } catch (e) {
          console.warn('[raw-rss] GET Upstash REST failed, fallback to Redis:', e?.message || e)
          if (REDIS_CONFIGURED) {
            try {
              items = await readRawFromRedis()
              provider = 'redis'
            } catch (er) {
              console.warn('[raw-rss] GET Redis failed, fallback to KV:', er?.message || er)
              if (kv) {
                try {
                  items = await readRawFromKV()
                  provider = 'vercel-kv'
                } catch (err2) {
                  console.warn('[raw-rss] GET KV failed, use memory:', err2?.message || err2)
                  items = readRawFromMemory()
                  provider = 'memory'
                }
              } else {
                items = readRawFromMemory(); provider = 'memory'
              }
            }
          } else if (kv) {
            try { items = await readRawFromKV(); provider = 'vercel-kv' } catch { items = readRawFromMemory(); provider = 'memory' }
          } else { items = readRawFromMemory(); provider = 'memory' }
        }
      } else if (REDIS_CONFIGURED) {
        try { items = await readRawFromRedis(); provider = 'redis' } catch (e) { console.warn('[raw-rss] GET Redis failed:', e?.message || e); if (kv) { try { items = await readRawFromKV(); provider = 'vercel-kv' } catch { items = readRawFromMemory(); provider='memory' } } else { items = readRawFromMemory(); provider='memory'} }
      } else if (kv) {
        try { items = await readRawFromKV(); provider = 'vercel-kv' } catch (e) { console.warn('[raw-rss] GET KV failed:', e?.message || e); items = readRawFromMemory(); provider='memory' }
      } else { items = readRawFromMemory(); provider='memory' }

      let filtered = []
      try {
        filtered = applyFilters(items, { source, category, status, dateFrom, dateTo })
      } catch (e) {
        console.warn('过滤异常，返回未过滤数据：', e?.message || e)
        filtered = Array.isArray(items) ? items : []
      }
      const paged = paginate(filtered, pageNum, pageSize)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      res.setHeader('X-Diag-Redis-Configured', String(!!REDIS_CONFIGURED))
      res.setHeader('X-Diag-Upstash-REST-Configured', String(!!UPSTASH_REST_CONFIGURED))
      return res.status(200).json({ items: paged.items, total: paged.total, page: pageNum, pageSize, totalPages: paged.totalPages })
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
      let current = []
      let provider = 'memory'
      if (mode === 'append') {
        if (UPSTASH_REST_CONFIGURED) {
          try {
            current = await readRawFromUpstashREST()
            provider = 'upstash-rest'
          } catch (e) {
            console.warn('[raw-rss] POST read Upstash failed, fallback', e?.message || e)
            if (REDIS_CONFIGURED) {
              try {
                current = await readRawFromRedis()
                provider = 'redis'
              } catch (er) {
                console.warn('[raw-rss] POST read Redis failed, fallback', er?.message || er)
                if (kv) {
                  try {
                    current = await readRawFromKV()
                    provider = 'vercel-kv'
                  } catch (err2) {
                    console.warn('[raw-rss] POST read KV failed, use memory', err2?.message || err2)
                    current = readRawFromMemory()
                    provider = 'memory'
                  }
                } else {
                  current = readRawFromMemory()
                  provider = 'memory'
                }
              }
            } else if (kv) {
              try {
                current = await readRawFromKV()
                provider = 'vercel-kv'
              } catch (err3) {
                console.warn('[raw-rss] POST read KV failed, use memory', err3?.message || err3)
                current = readRawFromMemory()
                provider = 'memory'
              }
            } else {
              current = readRawFromMemory()
              provider = 'memory'
            }
          }
        } else if (REDIS_CONFIGURED) {
          try {
            current = await readRawFromRedis()
            provider = 'redis'
          } catch (e) {
            console.warn('[raw-rss] POST read Redis failed, fallback', e?.message || e)
            if (kv) {
              try {
                current = await readRawFromKV()
                provider = 'vercel-kv'
              } catch (er) {
                console.warn('[raw-rss] POST read KV failed, use memory', er?.message || er)
                current = readRawFromMemory()
                provider = 'memory'
              }
            } else {
              current = readRawFromMemory()
              provider = 'memory'
            }
          }
        } else if (kv) {
          try {
            current = await readRawFromKV()
            provider = 'vercel-kv'
          } catch (e) {
            console.warn('[raw-rss] POST read KV failed, use memory', e?.message || e)
            current = readRawFromMemory()
            provider = 'memory'
          }
        } else {
          current = readRawFromMemory()
          provider = 'memory'
        }
      }
      const toWrite = mode === 'append' ? [...current, ...normalized] : [...normalized]
      let written = []
      // 优先 Upstash REST -> Redis -> KV -> 内存
      if (UPSTASH_REST_CONFIGURED) {
        try { written = await writeRawToUpstashREST(toWrite); provider = 'upstash-rest' } catch (e) { console.warn('[raw-rss] POST write Upstash failed, fallback:', e?.message || e); if (REDIS_CONFIGURED) { try { written = await writeRawToRedis(toWrite); provider='redis' } catch (er) { console.warn('[raw-rss] POST write Redis failed:', er?.message || er); if (kv) { try { written = await writeRawToKV(toWrite); provider='vercel-kv' } catch (err2) { console.warn('[raw-rss] POST write KV failed:', err2?.message || err2); written = writeRawToMemory(toWrite); provider='memory' } } else { written = writeRawToMemory(toWrite); provider='memory' } } } else if (REDIS_CONFIGURED) { try { written = await writeRawToRedis(toWrite); provider='redis' } catch (e) { console.warn('[raw-rss] POST write Redis failed:', e?.message || e); if (kv) { try { written = await writeRawToKV(toWrite); provider='vercel-kv' } catch (er) { console.warn('[raw-rss] POST write KV failed:', er?.message || er); written = writeRawToMemory(toWrite); provider='memory' } } else { written = writeRawToMemory(toWrite); provider='memory' } } } else if (kv) { try { written = await writeRawToKV(toWrite); provider='vercel-kv' } catch (e) { console.warn('[raw-rss] POST write KV failed:', e?.message || e); written = writeRawToMemory(toWrite); provider='memory' } } else { written = writeRawToMemory(toWrite); provider='memory' }
      console.log(`[raw-rss] POST ${mode}: stored ${written.length} items via ${provider}, ${Date.now() - startTime}ms`)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Storage-Provider', provider)
      return res.status(200).json({ ok: true, stored: written.length })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error) {
    console.error('[raw-rss] handler error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}