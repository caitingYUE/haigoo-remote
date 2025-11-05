import { kv } from '@vercel/kv'

// Keys used in KV
const JOBS_KEY = 'haigoo:processed_jobs'
const STATS_KEY = 'haigoo:stats'
const LAST_SYNC_KEY = 'haigoo:last_sync'

// Helpers: recent filter and duplicate removal (keep last 7 days, dedupe by title+company+location)
function filterRecentJobs(jobs, maxDays = 7) {
  const cutoff = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000)
  return jobs.filter(j => new Date(j.publishedAt) >= cutoff)
}

function removeDuplicates(jobs) {
  const seen = new Set()
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}-${job.location || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function applyFilters(jobs, q) {
  let list = jobs
  if (q.source) list = list.filter(j => j.source === q.source)
  if (q.category) list = list.filter(j => j.category === q.category)
  if (q.status) list = list.filter(j => j.status === q.status)
  if (q.company) list = list.filter(j => (j.company || '').toLowerCase().includes(String(q.company).toLowerCase()))
  if (typeof q.isRemote !== 'undefined') list = list.filter(j => !!j.isRemote === (q.isRemote === true || q.isRemote === 'true'))
  if (q.location) list = list.filter(j => (j.location || '').toLowerCase().includes(String(q.location).toLowerCase()))
  if (q.type) list = list.filter(j => (j.jobType || j.type) === q.type)
  if (q.search) {
    const s = String(q.search).toLowerCase()
    list = list.filter(j => `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(s))
  }
  if (q.dateFrom || q.dateTo) {
    const from = q.dateFrom ? new Date(q.dateFrom) : null
    const to = q.dateTo ? new Date(q.dateTo) : null
    list = list.filter(j => {
      const d = new Date(j.publishedAt)
      return (!from || d >= from) && (!to || d <= to)
    })
  }
  if (Array.isArray(q.tags) && q.tags.length > 0) {
    const tagsLower = q.tags.map(t => String(t).toLowerCase())
    list = list.filter(j => Array.isArray(j.tags) && j.tags.some(t => tagsLower.includes(String(t).toLowerCase())))
  }
  if (Array.isArray(q.skills) && q.skills.length > 0) {
    const skillsLower = q.skills.map(t => String(t).toLowerCase())
    list = list.filter(j => Array.isArray(j.tags) && j.tags.some(t => skillsLower.includes(String(t).toLowerCase())))
  }
  // Sort by publishedAt desc
  return list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

function paginate(jobs, pageNum, pageSize) {
  const total = jobs.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (pageNum - 1) * pageSize
  const end = start + pageSize
  const items = jobs.slice(start, end)
  return { items, total, totalPages }
}

async function readJobsFromKV() {
  const data = await kv.get(JOBS_KEY)
  if (!data) return []
  const jobs = Array.isArray(data) ? data : JSON.parse(typeof data === 'string' ? data : '[]')
  return jobs
}

async function writeJobsToKV(jobs) {
  const recent = filterRecentJobs(jobs)
  const unique = removeDuplicates(recent)
  await kv.set(JOBS_KEY, unique)
  await kv.set(LAST_SYNC_KEY, new Date().toISOString())
  await kv.set(STATS_KEY, {
    totalJobs: unique.length,
    storageSize: JSON.stringify(unique).length,
    lastSync: new Date().toISOString(),
    provider: 'vercel-kv'
  })
  return unique
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
      const {
        page = '1',
        limit = '20',
        source,
        category,
        status,
        dateFrom,
        dateTo,
        company,
        isRemote,
        search,
        location,
        type,
        tags,
        skills
      } = req.query || {}

      const pageNum = Number(page) || 1
      const pageSize = Number(limit) || 20

      const jobs = await readJobsFromKV()
      const filtered = applyFilters(jobs, {
        source,
        category,
        status,
        dateFrom,
        dateTo,
        company,
        isRemote,
        search,
        location,
        type,
        tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? [tags] : []),
        skills: Array.isArray(skills) ? skills : (typeof skills === 'string' ? [skills] : [])
      })

      const { items, total, totalPages } = paginate(filtered, pageNum, pageSize)

      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return res.status(200).json({
        jobs: items,
        total,
        page: pageNum,
        pageSize,
        totalPages
      })
    }

    if (req.method === 'POST') {
      let body = req.body
      if (!body || typeof body !== 'object') {
        // Raw body fallback
        body = await new Promise((resolve) => {
          let data = ''
          req.on('data', chunk => data += chunk)
          req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
          })
        })
      }

      const { jobs = [], mode: bodyMode } = body || {}
      const mode = (bodyMode || req.query?.mode || 'replace').toString()
      if (!Array.isArray(jobs)) {
        return res.status(400).json({ error: 'jobs must be an array' })
      }

      // Normalize minimal required fields
      const normalized = jobs.map(j => ({
        id: j.id || `${(j.title || 'job')}-${(j.company || 'unknown')}-${(j.url || Math.random().toString(36).slice(2))}`,
        title: j.title,
        company: j.company || 'Unknown Company',
        location: j.location || 'Remote',
        description: j.description || '',
        url: j.url,
        publishedAt: j.publishedAt || new Date().toISOString(),
        source: j.source || 'unknown',
        category: j.category || '其他',
        salary: j.salary || null,
        jobType: j.jobType || 'full-time',
        experienceLevel: j.experienceLevel || 'Mid',
        tags: Array.isArray(j.tags) ? j.tags : [],
        requirements: Array.isArray(j.requirements) ? j.requirements : [],
        benefits: Array.isArray(j.benefits) ? j.benefits : [],
        isRemote: typeof j.isRemote === 'boolean' ? j.isRemote : true,
        status: j.status || 'active',
        createdAt: j.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))

      let toWrite = normalized
      if (mode === 'append') {
        const existing = await readJobsFromKV()
        toWrite = [...existing, ...normalized]
      }

      const saved = await writeJobsToKV(toWrite)
      return res.status(200).json({ success: true, saved: saved.length, mode })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('processed-jobs API error:', error)
    return res.status(500).json({ error: 'Failed to process jobs', message: error?.message || String(error) })
  }
}