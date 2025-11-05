import { kv } from '@vercel/kv'

const JOBS_KEY = 'haigoo:processed_jobs'
const STATS_KEY = 'haigoo:stats'
const LAST_SYNC_KEY = 'haigoo:last_sync'
const KV_CONFIGURED = Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let provider = 'vercel-kv'
    let jobsCount = 0
    let storageSize = 0
    let lastSync = null
    if (KV_CONFIGURED) {
      try {
        const stats = await kv.get(STATS_KEY)
        lastSync = await kv.get(LAST_SYNC_KEY)
        if (!stats) {
          const jobs = await kv.get(JOBS_KEY)
          const arr = Array.isArray(jobs) ? jobs : (typeof jobs === 'string' ? JSON.parse(jobs) : [])
          jobsCount = Array.isArray(arr) ? arr.length : 0
          storageSize = JSON.stringify(arr).length
        } else {
          jobsCount = stats.totalJobs || 0
          storageSize = stats.storageSize || 0
        }
      } catch (e) {
        console.warn('KV 读取统计失败，使用空回退:', e?.message || e)
        provider = 'memory'
      }
    } else {
      provider = 'memory'
    }

    res.setHeader('X-Storage-Provider', provider)
    try { res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED)) } catch {}
    return res.status(200).json({
      provider,
      totalJobs: jobsCount,
      storageSize,
      lastSync
    })
  } catch (error) {
    console.error('storage-stats API error:', error)
    try { res.setHeader('X-Diag-KV-Configured', String(!!KV_CONFIGURED)) } catch {}
    return res.status(500).json({ error: 'Failed to fetch storage stats', message: error?.message || String(error) })
  }
}