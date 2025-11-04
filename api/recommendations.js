import { kv } from '@vercel/kv'

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
      const data = await kv.get(key)
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
      await kv.set(key, payload)
      return res.status(200).json({ success: true, data: payload })
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' })
  } catch (error) {
    console.error('/api/recommendations error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'internal error' })
  }
}