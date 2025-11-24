import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { createClient } from 'redis'

// 安全加载 Vercel KV
let kv = null
try {
    const kvModule = require('@vercel/kv')
    kv = kvModule?.kv || null
} catch (e) {
    console.warn('[trusted-companies] Vercel KV module not available')
}

// Simple HTML parser using regex
function extractMetadata(html) {
    const metadata = { title: '', description: '', image: '', icon: '' }
    const getMeta = (prop) => {
        const regex = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)["']`, 'i')
        const match = html.match(regex)
        return match ? match[1] : ''
    }
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    metadata.title = getMeta('og:title') || (titleMatch ? titleMatch[1] : '')
    metadata.description = getMeta('og:description') || getMeta('description')
    metadata.image = getMeta('og:image')
    const iconMatch = html.match(/<link\\s+rel=["'](?:shortcut )?icon["']\\s+href=["']([^"']*)["']/i)
    metadata.icon = iconMatch ? iconMatch[1] : ''
    return metadata
}

// 环境变量
const REDIS_URL = process.env.REDIS_URL || process.env.haigoo_REDIS_URL || process.env.HAIGOO_REDIS_URL || null
const REDIS_CONFIGURED = !!REDIS_URL
const KV_CONFIGURED = !!kv

// 内存存储 (Fallback)
let MEMORY_STORE = globalThis.__haigoo_trusted_companies_mem || []
if (!globalThis.__haigoo_trusted_companies_mem) {
    globalThis.__haigoo_trusted_companies_mem = MEMORY_STORE
}

const STORAGE_KEY = 'haigoo:trusted_companies'

// Redis Client Helper
let __redisClient = globalThis.__haigoo_redis_client || null
async function getRedisClient() {
    if (!REDIS_CONFIGURED) return null
    if (__redisClient) return __redisClient
    try {
        const client = createClient({ url: REDIS_URL })
        client.on('error', err => console.error('[trusted-companies] Redis error:', err))
        await client.connect()
        __redisClient = client
        globalThis.__haigoo_redis_client = client
        return client
    } catch (error) {
        console.error('[trusted-companies] Redis connection failed:', error.message)
        return null
    }
}

// Data Access Layer
async function getAllCompanies() {
    try {
        // 1. Redis
        if (REDIS_CONFIGURED) {
            const client = await getRedisClient()
            if (client) {
                const data = await client.get(STORAGE_KEY)
                if (data) return JSON.parse(data)
            }
        }
        // 2. KV
        if (KV_CONFIGURED) {
            const data = await kv.get(STORAGE_KEY)
            if (data) return Array.isArray(data) ? data : []
        }
    } catch (e) {
        console.error('[trusted-companies] Read error:', e)
    }
    // 3. Memory
    return MEMORY_STORE
}

async function saveAllCompanies(companies) {
    MEMORY_STORE = companies
    globalThis.__haigoo_trusted_companies_mem = companies

    try {
        // 1. Redis
        if (REDIS_CONFIGURED) {
            const client = await getRedisClient()
            if (client) await client.set(STORAGE_KEY, JSON.stringify(companies))
        }
        // 2. KV
        if (KV_CONFIGURED) {
            await kv.set(STORAGE_KEY, companies)
        }
    } catch (e) {
        console.error('[trusted-companies] Write error:', e)
    }
}

// Handler
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') return res.status(200).end()

    try {
        // GET: List all companies
        if (req.method === 'GET') {
            const companies = await getAllCompanies()
            const { id } = req.query

            if (id) {
                const company = companies.find(c => c.id === id)
                if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                return res.status(200).json({ success: true, company })
            }

            return res.status(200).json({ success: true, companies })
        }

        // Auth Check for Write Operations
        const token = extractToken(req)
        const payload = verifyToken(token)
        if (!payload) return res.status(401).json({ success: false, error: 'Unauthorized' })

        // POST: Add, Update, or Crawl
        if (req.method === 'POST') {
            const body = req.body || {}
            const { action } = req.query

            // Crawl Action
            if (action === 'crawl') {
                const { url } = body
                if (!url) return res.status(400).json({ success: false, error: 'URL is required' })
                try {
                    console.log(`[trusted-companies] Crawling: ${url}`)
                    const response = await fetch(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    })
                    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`)
                    const html = await response.text()
                    const metadata = extractMetadata(html)
                    // Normalize URLs
                    if (metadata.icon && !metadata.icon.startsWith('http')) {
                        const urlObj = new URL(url)
                        metadata.icon = new URL(metadata.icon, urlObj.origin).toString()
                    }
                    if (metadata.image && !metadata.image.startsWith('http')) {
                        const urlObj = new URL(url)
                        metadata.image = new URL(metadata.image, urlObj.origin).toString()
                    }
                    return res.status(200).json({ success: true, metadata })
                } catch (error) {
                    console.error('[trusted-companies] Crawl error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            // Crawl Jobs Action
            if (action === 'crawl-jobs') {
                const { id } = req.query
                if (!id) return res.status(400).json({ success: false, error: 'Company ID is required' })

                const companies = await getAllCompanies()
                const company = companies.find(c => c.id === id)
                if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                if (!company.careersPage && !company.website) return res.status(400).json({ success: false, error: 'No careers page or website URL' })

                try {
                    const { crawlCompanyJobs } = await import('../../api/crawler/job-crawler.js')
                    const url = company.careersPage || company.website
                    const crawledJobs = await crawlCompanyJobs(company.id, url)

                    // Enrich jobs with company name
                    const enrichedJobs = crawledJobs.map(job => ({
                        ...job,
                        company: company.name,
                        companyLogo: company.logo,
                        sourceType: 'trusted',
                        isTrusted: true
                    }))

                    // Save to Job Storage (Accessing processed-jobs storage key directly)
                    // Note: This duplicates logic from processed-jobs.js but is necessary for cross-endpoint data manipulation
                    // in this simple serverless structure without a shared DB layer.
                    const JOB_STORAGE_KEY = 'haigoo:processed_jobs'
                    let existingJobs = []

                    // Read existing jobs
                    if (REDIS_CONFIGURED) {
                        const client = await getRedisClient()
                        if (client) {
                            const data = await client.get(JOB_STORAGE_KEY)
                            if (data) existingJobs = JSON.parse(data)
                        }
                    } else if (KV_CONFIGURED) {
                        const data = await kv.get(JOB_STORAGE_KEY)
                        if (data) existingJobs = Array.isArray(data) ? data : []
                    } else {
                        // Fallback to memory (shared global if possible, but likely separate in serverless)
                        existingJobs = globalThis.__haigoo_processed_jobs_mem || []
                    }

                    // Merge: Remove old crawled jobs for this company and add new ones
                    const otherJobs = existingJobs.filter(j => j.companyId !== company.id || j.sourceType !== 'trusted')
                    const allJobs = [...otherJobs, ...enrichedJobs]

                    // Save back
                    if (REDIS_CONFIGURED) {
                        const client = await getRedisClient()
                        if (client) await client.set(JOB_STORAGE_KEY, JSON.stringify(allJobs))
                    } else if (KV_CONFIGURED) {
                        await kv.set(JOB_STORAGE_KEY, allJobs)
                    }

                    // Update memory fallback
                    globalThis.__haigoo_processed_jobs_mem = allJobs

                    return res.status(200).json({ success: true, count: enrichedJobs.length, jobs: enrichedJobs })

                } catch (error) {
                    console.error('[trusted-companies] Job crawl error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            const { id, name, website, careersPage, linkedin, description, logo, tags } = body

            if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

            let companies = await getAllCompanies()
            const now = new Date().toISOString()

            if (id) {
                // Update
                const index = companies.findIndex(c => c.id === id)
                if (index === -1) return res.status(404).json({ success: false, error: 'Company not found' })

                companies[index] = {
                    ...companies[index],
                    name, website, careersPage, linkedin, description, logo, tags,
                    updatedAt: now
                }
            } else {
                // Create
                const newCompany = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name, website, careersPage, linkedin, description, logo, tags,
                    createdAt: now,
                    updatedAt: now,
                    isTrusted: true
                }
                companies.push(newCompany)
            }

            await saveAllCompanies(companies)
            return res.status(200).json({ success: true, message: 'Saved successfully' })
        }

        // DELETE
        if (req.method === 'DELETE') {
            const { id } = req.query
            if (!id) return res.status(400).json({ success: false, error: 'ID is required' })

            let companies = await getAllCompanies()
            const initialLen = companies.length
            companies = companies.filter(c => c.id !== id)

            if (companies.length === initialLen) return res.status(404).json({ success: false, error: 'Company not found' })

            await saveAllCompanies(companies)
            return res.status(200).json({ success: true, message: 'Deleted successfully' })
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' })
    } catch (error) {
        console.error('[trusted-companies] Error:', error)
        return res.status(500).json({ success: false, error: 'Server error' })
    }
}
