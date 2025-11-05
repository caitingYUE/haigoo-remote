import { kv } from '@vercel/kv'

const JOBS_KEY = 'haigoo:processed_jobs'
const STATS_KEY = 'haigoo:stats'
const LAST_SYNC_KEY = 'haigoo:last_sync'

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
    const stats = await kv.get(STATS_KEY)
    const lastSync = await kv.get(LAST_SYNC_KEY)
    let jobsCount = 0
    let storageSize = 0

    if (!stats) {
      const jobs = await kv.get(JOBS_KEY)
      const arr = Array.isArray(jobs) ? jobs : (typeof jobs === 'string' ? JSON.parse(jobs) : [])
      jobsCount = Array.isArray(arr) ? arr.length : 0
      storageSize = JSON.stringify(arr).length
    } else {
      jobsCount = stats.totalJobs || 0
      storageSize = stats.storageSize || 0
    }

    return res.status(200).json({
      provider: 'vercel-kv',
      totalJobs: jobsCount,
      storageSize,
      lastSync: typeof lastSync === 'string' ? lastSync : (stats?.lastSync || null)
    })
  } catch (error) {
    console.error('storage-stats API error:', error)
    return res.status(500).json({ error: 'Failed to fetch storage stats', message: error?.message || String(error) })
  }
}