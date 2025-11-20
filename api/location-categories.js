// 地址分类管理 API（支持 KV/Redis/内存）
let kv = null
try { kv = require('@vercel/kv')?.kv || null } catch {}

function getEnv(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n]
    if (process.env[`HAIGOO_${n}`]) return process.env[`HAIGOO_${n}`]
    if (process.env[`pre_${n}`]) return process.env[`pre_${n}`]
    if (process.env[`PRE_${n}`]) return process.env[`PRE_${n}`]
  }
  return null
}

const UPSTASH_REDIS_REST_URL = getEnv('UPSTASH_REDIS_REST_URL', 'UPSTASH_REST_URL')
const UPSTASH_REDIS_REST_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REST_TOKEN')
const UPSTASH_REST_CONFIGURED = !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN)

const KEY = 'haigoo:location_categories'
const MEM = (globalThis.__haigoo_location_categories = globalThis.__haigoo_location_categories || null)

const DEFAULT_CATEGORIES = {
  domesticKeywords: ['china', '中国', 'cn', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'nanjing', 'chengdu', 'chongqing', 'apac', 'asia', 'east asia', 'greater china', 'asia/shanghai', 'utc+8', 'gmt+8', '北京', '上海', '深圳', '广州', '杭州', '不限地点'],
  overseasKeywords: ['europe', 'emea', 'americas', 'latam', 'north america', 'south america', 'usa', 'us', 'uk', 'canada', 'australia', 'new zealand', 'oceania', 'eu', 'germany', 'france', 'spain', 'italy'],
  globalKeywords: ['anywhere', 'everywhere', 'worldwide', 'remote', 'no location', 'global', 'any location', '不限地点']
}

async function upstashGet(key) {
  if (!UPSTASH_REST_CONFIGURED) return null
  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
    })
    const json = await res.json().catch(() => null)
    return json?.result ?? null
  } catch { return null }
}

async function upstashSet(key, value) {
  if (!UPSTASH_REST_CONFIGURED) return false
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify({ key, value: serialized })
  })
  return res.ok
}

async function readCategories() {
  // 优先 Upstash -> 其次 KV -> 最后内存/默认
  const raw = await upstashGet(KEY)
  if (raw) {
    try { const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; return parsed || DEFAULT_CATEGORIES } catch { }
  }
  if (kv) {
    const data = await kv.get(KEY)
    if (data) return Array.isArray(data) ? DEFAULT_CATEGORIES : (typeof data === 'string' ? JSON.parse(data) : data)
  }
  return MEM || DEFAULT_CATEGORIES
}

async function writeCategories(payload) {
  const next = { ...DEFAULT_CATEGORIES, ...payload }
  await upstashSet(KEY, next).catch(() => {})
  if (kv) { try { await kv.set(KEY, next) } catch { } }
  globalThis.__haigoo_location_categories = next
  return next
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    if (req.method === 'GET') {
      const cats = await readCategories()
      return res.status(200).json({ success: true, categories: cats })
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body
      if (!body || typeof body !== 'object') {
        body = await new Promise((resolve) => {
          let data = ''
          req.on('data', chunk => data += chunk)
          req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
        })
      }
      const next = await writeCategories(body)
      return res.status(200).json({ success: true, categories: next })
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('[location-categories] error:', e)
    return res.status(500).json({ success: false, error: 'server error' })
  }
}