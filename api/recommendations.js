import { kv } from '@vercel/kv'

// Detect KV config; only consider REST pair present as configured
const KV_CONFIGURED = Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN)
if (!globalThis.__haigoo_rec_store) {
  globalThis.__haigoo_rec_store = new Map()
}
const REC_MEM = globalThis.__haigoo_rec_store

export default async function handler(req, res) {
  // 基础CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      const { date, uuid = 'default' } = req.query
      if (!date) {
        return res.status(400).json({ success: false, error: 'date is required' })
      }
      const key = `rec:${uuid}:${date}`
      let provider = 'vercel-kv'
      let data = null
      if (KV_CONFIGURED) {
        try {
          data = await kv.get(key)
        } catch (e) {
          console.warn('KV 获取推荐失败，使用内存:', e?.message || e)
          data = REC_MEM.get(key) || null
          provider = 'memory'
        }
      } else {
        data = REC_MEM.get(key) || null
        provider = 'memory'
      }
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Storage-Provider', provider)
      return res.status(200).json({ success: true, data: data || null })
    }

    if (req.method === 'POST') {
      let body = req.body
      if (!body || typeof body !== 'object') {
        body = await new Promise((resolve) => {
          let data = ''
          req.on('data', chunk => data += chunk)
          req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
          })
        })
      }

      const { date, jobs, uuid = 'default' } = body || {}
      if (!date || !Array.isArray(jobs)) {
        return res.status(400).json({ success: false, error: 'date and jobs are required' })
      }

      const key = `rec:${uuid}:${date}`
      const payload = { date, uuid, jobs, timestamp: Date.now() }
      let provider = 'vercel-kv'
      if (KV_CONFIGURED) {
        try {
          await kv.set(key, payload)
        } catch (e) {
          console.warn('KV 保存推荐失败，写入内存:', e?.message || e)
          REC_MEM.set(key, payload)
          provider = 'memory'
        }
      } else {
        REC_MEM.set(key, payload)
        provider = 'memory'
      }
      res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED))
      res.setHeader('X-Storage-Provider', provider)
      return res.status(200).json({ success: true, data: payload, provider })
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' })
  } catch (error) {
    console.error('/api/recommendations error:', error)
    try { res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED)) } catch {}
    return res.status(500).json({ success: false, error: error?.message || 'internal error' })
  }
}