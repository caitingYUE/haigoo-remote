import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import { createClient } from 'redis'
import * as cheerio from 'cheerio'

// 安全加载 Vercel KV
let kv = null
try {
    const kvModule = require('@vercel/kv')
    kv = kvModule?.kv || null
} catch (e) {
    console.warn('[trusted-companies] Vercel KV module not available')
}

// HTML parser using Cheerio
function extractMetadata(html) {
    const $ = cheerio.load(html)
    const metadata = { title: '', description: '', image: '', icon: '' }

    metadata.title = $('meta[property="og:title"]').attr('content') ||
        $('title').text() || ''

    metadata.description = $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') || ''

    // Fallback description from content if missing or too short
    if (!metadata.description || metadata.description.length < 50) {
        // Try generic description classes and common content containers
        // Webflow often uses w-richtext
        const desc = $('.description, [class*="description"], main p, article p, .w-richtext p, .hero-text, .intro-text').first().text().trim()
        if (desc.length > 20) {
            metadata.description = desc.substring(0, 300) + (desc.length > 300 ? '...' : '')
        }
    }

    metadata.image = $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') || ''

    metadata.icon = $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href') || ''

    return metadata
}

// 统一环境变量解析：兼容 preview 专用前缀（pre_haigoo_*、pre_*、haigoo_* 等）
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

// Detect KV configuration (REST-only)
const KV_REST_API_URL = getEnv('KV_REST_API_URL')
const KV_REST_API_TOKEN = getEnv('KV_REST_API_TOKEN')
if (KV_REST_API_URL && !process.env.KV_REST_API_URL) process.env.KV_REST_API_URL = KV_REST_API_URL
if (KV_REST_API_TOKEN && !process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_TOKEN = KV_REST_API_TOKEN
const KV_CONFIGURED = !!(KV_REST_API_URL && KV_REST_API_TOKEN)

// Detect Upstash Redis REST configuration
const UPSTASH_REST_URL = getEnv('UPSTASH_REDIS_REST_URL', 'UPSTASH_REST_URL', 'REDIS_REST_API_URL', 'KV_REST_API_URL')
const UPSTASH_REST_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', 'UPSTASH_REST_TOKEN', 'REDIS_REST_API_TOKEN', 'KV_REST_API_TOKEN')
const UPSTASH_REST_CONFIGURED = !!(UPSTASH_REST_URL && UPSTASH_REST_TOKEN)

// Detect Redis TCP configuration
const REDIS_URL = getEnv('REDIS_URL', 'UPSTASH_REDIS_URL') || null
const REDIS_CONFIGURED = !!REDIS_URL

// 内存存储 (Fallback)
let MEMORY_STORE = globalThis.__haigoo_trusted_companies_mem || []
if (!globalThis.__haigoo_trusted_companies_mem) {
    globalThis.__haigoo_trusted_companies_mem = MEMORY_STORE
}

const STORAGE_KEY = 'haigoo:trusted_companies'

// --- Upstash Redis REST helpers ---
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
    } catch (e) {
        // ignore, try POST fallback
    }
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
    } catch (e) {
        // try JSON endpoint
    }
    const res2 = await fetch(`${UPSTASH_REST_URL}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTASH_REST_TOKEN}` },
        body: JSON.stringify({ key, value: serialized })
    })
    return res2.ok
}

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
        // Priority: Upstash REST -> Redis TCP -> KV SDK -> Memory
        if (UPSTASH_REST_CONFIGURED) {
            try {
                const data = await upstashGet(STORAGE_KEY)
                if (data) {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data
                    return Array.isArray(parsed) ? parsed : []
                }
            } catch (e) {
                console.warn('[trusted-companies] Upstash REST read failed, trying Redis TCP:', e?.message)
            }
        }

        if (REDIS_CONFIGURED) {
            const client = await getRedisClient()
            if (client) {
                const data = await client.get(STORAGE_KEY)
                if (data) return JSON.parse(data)
            }
        }

        if (KV_CONFIGURED && kv) {
            const data = await kv.get(STORAGE_KEY)
            if (data) return Array.isArray(data) ? data : []
        }
    } catch (e) {
        console.error('[trusted-companies] Read error:', e)
    }
    return MEMORY_STORE
}

async function saveAllCompanies(companies) {
    MEMORY_STORE = companies
    globalThis.__haigoo_trusted_companies_mem = companies

    try {
        // Priority: Upstash REST -> Redis TCP -> KV SDK
        if (UPSTASH_REST_CONFIGURED) {
            await upstashSet(STORAGE_KEY, JSON.stringify(companies))
            console.log('[trusted-companies] Saved to Upstash REST')
        } else if (REDIS_CONFIGURED) {
            const client = await getRedisClient()
            if (client) await client.set(STORAGE_KEY, JSON.stringify(companies))
            console.log('[trusted-companies] Saved to Redis TCP')
        } else if (KV_CONFIGURED && kv) {
            await kv.set(STORAGE_KEY, companies)
            console.log('[trusted-companies] Saved to KV SDK')
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
        // --- Action Dispatcher ---
        const { action } = req.query

        // 1. Crawl Company Info (Merged from api/crawler/company-info.js)
        if (req.method === 'GET' && action === 'crawl') {
            const { url } = req.query
            if (!url) return res.status(400).json({ error: 'URL is required' })

            try {
                let targetUrl = url
                if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`

                console.log(`[trusted-companies] Crawling: ${targetUrl}`)
                const response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    },
                    timeout: 10000
                })

                if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)

                const html = await response.text()
                const metadata = extractMetadata(html)

                // Handle relative logo URLs
                if (metadata.image && !metadata.image.startsWith('http')) {
                    const baseUrl = new URL(targetUrl)
                    if (metadata.image.startsWith('//')) {
                        metadata.image = `https:${metadata.image}`
                    } else if (metadata.image.startsWith('/')) {
                        metadata.image = `${baseUrl.origin}${metadata.image}`
                    } else {
                        metadata.image = `${baseUrl.origin}/${metadata.image}`
                    }
                }

                return res.status(200).json({
                    url: targetUrl,
                    logo: metadata.image || metadata.icon,
                    description: metadata.description,
                    title: metadata.title
                })
            } catch (error) {
                console.error('[trusted-companies] Crawl error:', error)
                return res.status(500).json({ error: 'Failed to crawl', details: error.message })
            }
        }

        // 2. Standard CRUD Operations
        if (req.method === 'GET') {
            const { resource } = req.query

            // Tag Config Resource
            if (resource === 'tags') {
                const TAG_CONFIG_KEY = 'haigoo:tag_config'
                const DEFAULT_CONFIG = {
                    jobCategories: [
                        '全栈开发', '前端开发', '后端开发', '移动开发', '算法工程师', '数据开发',
                        '服务器开发', '运维/SRE', '测试/QA', '网络安全', '操作系统/内核', '技术支持',
                        '硬件开发', '架构师', 'CTO/技术管理', '软件开发', '产品经理', '产品设计',
                        '用户研究', '项目管理', 'UI/UX设计', '平面设计', '视觉设计', '数据分析',
                        '数据科学', '商业分析', '运营', '市场营销', '销售', '客户经理', '客户服务',
                        '内容创作', '增长黑客', '人力资源', '招聘', '财务', '法务', '行政', '管理',
                        '教育培训', '咨询', '投资', '其他', '全部'
                    ],
                    companyIndustries: [
                        '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
                        '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
                        '硬件/物联网', '消费生活', '其他'
                    ],
                    companyTags: [
                        'AI+陪伴', 'AI+健康', 'AI基础设施', '医药', '远程优先', '全球招聘',
                        '初创公司', '独角兽', '外企', '出海'
                    ]
                }

                let config = null
                if (UPSTASH_REST_CONFIGURED) {
                    config = await upstashGet(TAG_CONFIG_KEY)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) config = await client.get(TAG_CONFIG_KEY)
                } else if (KV_CONFIGURED && kv) {
                    config = await kv.get(TAG_CONFIG_KEY)
                }

                if (!config) {
                    return res.status(200).json({ success: true, config: DEFAULT_CONFIG })
                }

                const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config
                return res.status(200).json({ success: true, config: parsedConfig })
            }

            // Companies Resource
            if (resource === 'companies') {
                const COMPANIES_KEY = 'haigoo:all_companies'
                const JOBS_KEY = 'haigoo:processed_jobs'
                const { id, action } = req.query

                // Helper functions for company management
                const extractCompanyFromJob = (job) => {
                    const extractUrl = (description) => {
                        if (!description) return ''
                        const urlMatch = description.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s\n]+)/i)
                        return urlMatch ? urlMatch[1].trim() : ''
                    }

                    const companyUrl = job.companyWebsite || extractUrl(job.description || '')
                    return {
                        name: job.company,
                        url: companyUrl,
                        description: '',
                        logo: undefined,
                        industry: job.companyIndustry || '其他',
                        tags: job.companyTags || [],
                        source: job.source || 'rss',
                        jobCount: 1
                    }
                }

                const normalizeUrl = (url) => {
                    if (!url) return ''
                    try {
                        const urlObj = new URL(url)
                        return urlObj.hostname.replace(/^www\./, '').toLowerCase()
                    } catch {
                        return url.toLowerCase()
                    }
                }

                const normalizeCompanyName = (name) => {
                    return (name || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[,.\-_]/g, '')
                }

                const deduplicateCompanies = (companies) => {
                    const companyMap = new Map()
                    for (const company of companies) {
                        const key = company.url ? normalizeUrl(company.url) : normalizeCompanyName(company.name)
                        if (!key) continue

                        const existing = companyMap.get(key)
                        if (existing) {
                            companyMap.set(key, {
                                ...existing,
                                description: (company.description?.length || 0) > (existing.description?.length || 0)
                                    ? company.description : existing.description,
                                logo: company.logo || existing.logo,
                                url: company.url || existing.url,
                                tags: Array.from(new Set([...(existing.tags || []), ...(company.tags || [])])),
                                jobCount: (existing.jobCount || 0) + (company.jobCount || 0),
                                updatedAt: new Date().toISOString()
                            })
                        } else {
                            companyMap.set(key, {
                                ...company,
                                id: company.id || `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                createdAt: company.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            })
                        }
                    }
                    return Array.from(companyMap.values())
                }

                // Extract companies from jobs
                if (action === 'extract') {
                    try {
                        let jobs = null
                        if (UPSTASH_REST_CONFIGURED) {
                            jobs = await upstashGet(JOBS_KEY)
                        } else if (REDIS_CONFIGURED) {
                            const client = await getRedisClient()
                            if (client) jobs = await client.get(JOBS_KEY)
                        } else if (KV_CONFIGURED && kv) {
                            jobs = await kv.get(JOBS_KEY)
                        }

                        const jobsArray = jobs ? (typeof jobs === 'string' ? JSON.parse(jobs) : jobs) : []

                        if (!Array.isArray(jobsArray) || jobsArray.length === 0) {
                            return res.status(200).json({
                                success: true,
                                companies: [],
                                message: '没有找到岗位数据'
                            })
                        }

                        const extractedCompanies = jobsArray.map(job => extractCompanyFromJob(job))
                        const deduplicated = deduplicateCompanies(extractedCompanies)

                        // Get existing companies to preserve metadata (logo, description, tags, etc.)
                        let existingCompanies = []
                        try {
                            if (UPSTASH_REST_CONFIGURED) {
                                const data = await upstashGet(COMPANIES_KEY)
                                existingCompanies = data ? (typeof data === 'string' ? JSON.parse(data) : data) : []
                            } else if (REDIS_CONFIGURED) {
                                const client = await getRedisClient()
                                if (client) {
                                    const data = await client.get(COMPANIES_KEY)
                                    existingCompanies = data ? (typeof data === 'string' ? JSON.parse(data) : data) : []
                                }
                            } else if (KV_CONFIGURED && kv) {
                                const data = await kv.get(COMPANIES_KEY)
                                existingCompanies = data || []
                            }
                        } catch (e) {
                            console.warn('[companies] Failed to load existing companies for merge:', e)
                        }

                        // Merge logic: Update existing companies with new stats, add new companies
                        const mergedCompanies = deduplicated.map(newComp => {
                            const existing = existingCompanies.find(c => c.name === newComp.name)
                            if (existing) {
                                return {
                                    ...existing,
                                    // Update fields that might change from jobs
                                    jobCount: newComp.jobCount,
                                    source: newComp.source,
                                    // Preserve existing metadata if present, otherwise use new (though new usually has none)
                                    url: existing.url || newComp.url,
                                    updatedAt: new Date().toISOString()
                                }
                            }
                            return newComp
                        })

                        // Also keep companies that exist but weren't found in current jobs? 
                        // User requirement implies "Refresh" updates from *current* jobs. 
                        // If a company has no jobs now, should it be removed?
                        // The current logic (before my change) replaced the list, so it effectively removed them.
                        // I will stick to that behavior but preserve metadata for the ones that remain.
                        // However, if we want to keep "historical" companies, we should append.
                        // Given "Extract Companies from Jobs", it implies the list should reflect current jobs.
                        // So I will only keep the ones found in jobs, but with their metadata preserved.

                        // Save to database
                        if (UPSTASH_REST_CONFIGURED) {
                            await upstashSet(COMPANIES_KEY, JSON.stringify(mergedCompanies))
                        } else if (REDIS_CONFIGURED) {
                            const client = await getRedisClient()
                            if (client) await client.set(COMPANIES_KEY, JSON.stringify(mergedCompanies))
                        } else if (KV_CONFIGURED && kv) {
                            await kv.set(COMPANIES_KEY, mergedCompanies)
                        }

                        return res.status(200).json({
                            success: true,
                            companies: deduplicated,
                            message: `成功提取 ${deduplicated.length} 个企业`
                        })
                    } catch (error) {
                        console.error('[companies] Extract error:', error)
                        return res.status(500).json({ success: false, error: 'Failed to extract companies' })
                    }
                }

                // Get companies
                let companies = null
                if (UPSTASH_REST_CONFIGURED) {
                    companies = await upstashGet(COMPANIES_KEY)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) companies = await client.get(COMPANIES_KEY)
                } else if (KV_CONFIGURED && kv) {
                    companies = await kv.get(COMPANIES_KEY)
                }

                const companiesArray = companies ? (typeof companies === 'string' ? JSON.parse(companies) : companies) : []

                // Get single company
                if (id) {
                    const company = companiesArray.find(c => c.id === id)
                    if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                    return res.status(200).json({ success: true, company })
                }

                // List all companies with pagination
                const page = parseInt(req.query.page) || 1
                const pageSize = parseInt(req.query.pageSize) || 50
                const search = req.query.search || ''
                const industry = req.query.industry || ''

                let filteredCompanies = companiesArray

                // Apply filters
                if (search) {
                    const searchLower = search.toLowerCase()
                    filteredCompanies = filteredCompanies.filter(c =>
                        c.name.toLowerCase().includes(searchLower) ||
                        (c.description || '').toLowerCase().includes(searchLower)
                    )
                }

                if (industry) {
                    filteredCompanies = filteredCompanies.filter(c => c.industry === industry)
                }

                // Sort by job count (descending)
                filteredCompanies.sort((a, b) => (b.jobCount || 0) - (a.jobCount || 0))

                // Pagination
                const total = filteredCompanies.length
                const totalPages = Math.ceil(total / pageSize)
                const startIndex = (page - 1) * pageSize
                const paginatedCompanies = filteredCompanies.slice(startIndex, startIndex + pageSize)

                // Enrich with Trusted Company data (Logo, URL, etc.)
                try {
                    const trustedCompanies = await getAllCompanies()
                    paginatedCompanies.forEach(company => {
                        const trusted = trustedCompanies.find(tc => tc.name === company.name || (tc.name.toLowerCase() === company.name.toLowerCase()))
                        if (trusted) {
                            if (!company.logo && trusted.logo) company.logo = trusted.logo
                            if (!company.url && trusted.website) company.url = trusted.website
                            if (!company.description && trusted.description) company.description = trusted.description
                            // Mark as trusted for UI if needed
                            company.isTrusted = true
                        }
                    })
                } catch (e) {
                    console.warn('Failed to enrich with trusted companies:', e)
                }

                return res.status(200).json({
                    success: true,
                    companies: paginatedCompanies,
                    total,
                    page,
                    pageSize,
                    totalPages
                })
            }

            // Company listing (trusted companies - default behavior)
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
            const { action, resource } = req.query

            // Re-classify all jobs
            if (action === 'reclassify') {
                try {
                    // Import classification service (assuming it's available)
                    // Since we're in a JS file, we'll implement a simple inline classifier
                    const JOB_STORAGE_KEY = 'haigoo:processed_jobs'

                    // Get all jobs
                    let jobs = []
                    if (UPSTASH_REST_CONFIGURED) {
                        jobs = await upstashGet(JOB_STORAGE_KEY)
                    } else if (REDIS_CONFIGURED) {
                        const client = await getRedisClient()
                        if (client) jobs = await client.get(JOB_STORAGE_KEY)
                    } else if (KV_CONFIGURED && kv) {
                        jobs = await kv.get(JOB_STORAGE_KEY)
                    } else {
                        jobs = globalThis.__haigoo_processed_jobs_mem || []
                    }

                    if (typeof jobs === 'string') jobs = JSON.parse(jobs)
                    if (!Array.isArray(jobs)) jobs = []

                    console.log(`[trusted-companies] Re-classifying ${jobs.length} jobs`)

                    // Simple classification logic (inline version)
                    const classifyJob = (title, description) => {
                        const text = (title + ' ' + description).toLowerCase()

                        // Frontend
                        if (text.match(/frontend|front-end|react|vue|angular|javascript|typescript|html|css/i)) return '前端开发'
                        // Backend
                        if (text.match(/backend|back-end|server|api|database|node\.js|python|java|php|ruby|go|rust/i)) return '后端开发'
                        // Fullstack
                        if (text.match(/fullstack|full-stack|full stack/i)) return '全栈开发'
                        // Mobile
                        if (text.match(/ios|android|mobile|flutter|react native|swift|kotlin/i)) return '移动开发'
                        // Algorithm/AI
                        if (text.match(/algorithm|machine learning|deep learning|ai|artificial intelligence|nlp|computer vision/i)) return '算法工程师'
                        // Data
                        if (text.match(/data scientist|data engineer|data analyst|analytics|bi|business intelligence/i)) return '数据分析'
                        // DevOps
                        if (text.match(/devops|infrastructure|deployment|ci\/cd|docker|kubernetes|aws|cloud|sysadmin|sre|site reliability/i)) return '运维/SRE'
                        // QA
                        if (text.match(/qa|quality assurance|tester|test engineer|testing|automation/i)) return '测试/QA'
                        // Product
                        if (text.match(/product manager|product owner|pm|product strategy/i)) return '产品经理'
                        // Design
                        if (text.match(/ui|ux|designer|design|figma|sketch/i)) return 'UI/UX设计'
                        // Marketing
                        if (text.match(/marketing|growth|seo|sem|social media|content marketing/i)) return '市场营销'
                        // Sales
                        if (text.match(/sales|account executive|business development/i)) return '销售'
                        // Customer Service
                        if (text.match(/customer service|customer support|help desk|technical support/i)) return '客户服务'

                        return '其他'
                    }

                    // Re-classify all jobs
                    let updatedCount = 0
                    jobs = jobs.map(job => {
                        const newCategory = classifyJob(job.title || '', job.description || '')
                        if (job.category !== newCategory) {
                            updatedCount++
                            return { ...job, category: newCategory }
                        }
                        return job
                    })

                    // Save back
                    const jobsStr = JSON.stringify(jobs)
                    if (UPSTASH_REST_CONFIGURED) {
                        await upstashSet(JOB_STORAGE_KEY, jobsStr)
                    } else if (REDIS_CONFIGURED) {
                        const client = await getRedisClient()
                        if (client) await client.set(JOB_STORAGE_KEY, jobsStr)
                    } else if (KV_CONFIGURED && kv) {
                        await kv.set(JOB_STORAGE_KEY, jobs)
                    } else {
                        globalThis.__haigoo_processed_jobs_mem = jobs
                    }

                    console.log(`[trusted-companies] Re-classified ${updatedCount} jobs out of ${jobs.length}`)

                    return res.status(200).json({
                        success: true,
                        message: `成功重新分类 ${updatedCount} 个岗位（共 ${jobs.length} 个）`,
                        total: jobs.length,
                        updated: updatedCount
                    })
                } catch (error) {
                    console.error('[trusted-companies] Re-classification error:', error)
                    return res.status(500).json({ success: false, error: 'Re-classification failed' })
                }
            }

            // Tag Management
            if (resource === 'tags') {
                const TAG_CONFIG_KEY = 'haigoo:tag_config'
                const DEFAULT_CONFIG = {
                    jobCategories: [
                        '全栈开发', '前端开发', '后端开发', '移动开发', '算法工程师', '数据开发',
                        '服务器开发', '运维/SRE', '测试/QA', '网络安全', '操作系统/内核', '技术支持',
                        '硬件开发', '架构师', 'CTO/技术管理', '软件开发', '产品经理', '产品设计',
                        '用户研究', '项目管理', 'UI/UX设计', '平面设计', '视觉设计', '数据分析',
                        '数据科学', '商业分析', '运营', '市场营销', '销售', '客户经理', '客户服务',
                        '内容创作', '增长黑客', '人力资源', '招聘', '财务', '法务', '行政', '管理',
                        '教育培训', '咨询', '投资', '其他', '全部'
                    ],
                    companyIndustries: [
                        '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
                        '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
                        '硬件/物联网', '消费生活', '其他'
                    ],
                    companyTags: [
                        'AI+陪伴', 'AI+健康', 'AI基础设施', '医药', '远程优先', '全球招聘',
                        '初创公司', '独角兽', '外企', '出海'
                    ]
                }

                const { action: tagAction, type, value, index } = body

                // Get current config
                let config = null
                if (UPSTASH_REST_CONFIGURED) {
                    config = await upstashGet(TAG_CONFIG_KEY)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) config = await client.get(TAG_CONFIG_KEY)
                } else if (KV_CONFIGURED && kv) {
                    config = await kv.get(TAG_CONFIG_KEY)
                }

                if (!config) {
                    config = DEFAULT_CONFIG
                } else {
                    config = typeof config === 'string' ? JSON.parse(config) : config
                }

                // Determine which array to modify
                let targetArray
                if (type === 'jobCategory') {
                    targetArray = 'jobCategories'
                } else if (type === 'companyIndustry') {
                    targetArray = 'companyIndustries'
                } else if (type === 'companyTag') {
                    targetArray = 'companyTags'
                } else {
                    return res.status(400).json({ error: 'Invalid type' })
                }

                // Perform action
                if (tagAction === 'add') {
                    if (!value || typeof value !== 'string') {
                        return res.status(400).json({ error: 'Invalid value' })
                    }
                    if (!config[targetArray].includes(value)) {
                        config[targetArray].push(value)
                    }
                } else if (tagAction === 'delete') {
                    if (typeof index !== 'number') {
                        return res.status(400).json({ error: 'Invalid index' })
                    }
                    config[targetArray].splice(index, 1)
                } else if (tagAction === 'update') {
                    if (typeof index !== 'number' || !value || typeof value !== 'string') {
                        return res.status(400).json({ error: 'Invalid parameters' })
                    }
                    config[targetArray][index] = value
                } else {
                    return res.status(400).json({ error: 'Invalid action' })
                }

                // Save updated config
                const configStr = JSON.stringify(config)
                if (UPSTASH_REST_CONFIGURED) {
                    await upstashSet(TAG_CONFIG_KEY, configStr)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) await client.set(TAG_CONFIG_KEY, configStr)
                } else if (KV_CONFIGURED && kv) {
                    await kv.set(TAG_CONFIG_KEY, config)
                }

                return res.status(200).json({ success: true, config })
            }

            // Companies Resource - POST operations
            if (resource === 'companies') {
                const COMPANIES_KEY = 'haigoo:all_companies'

                // Get current companies
                let companies = null
                if (UPSTASH_REST_CONFIGURED) {
                    companies = await upstashGet(COMPANIES_KEY)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) companies = await client.get(COMPANIES_KEY)
                } else if (KV_CONFIGURED && kv) {
                    companies = await kv.get(COMPANIES_KEY)
                }

                const companiesArray = companies ? (typeof companies === 'string' ? JSON.parse(companies) : companies) : []

                if (body.id) {
                    // Update existing company
                    const index = companiesArray.findIndex(c => c.id === body.id)
                    if (index === -1) {
                        return res.status(404).json({ success: false, error: 'Company not found' })
                    }
                    companiesArray[index] = {
                        ...companiesArray[index],
                        ...body,
                        updatedAt: new Date().toISOString()
                    }
                } else {
                    // Create new company
                    const newCompany = {
                        ...body,
                        id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                    companiesArray.push(newCompany)
                }

                // Save companies
                const companiesStr = JSON.stringify(companiesArray)
                if (UPSTASH_REST_CONFIGURED) {
                    await upstashSet(COMPANIES_KEY, companiesStr)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) await client.set(COMPANIES_KEY, companiesStr)
                } else if (KV_CONFIGURED && kv) {
                    await kv.set(COMPANIES_KEY, companiesArray)
                }

                return res.status(200).json({ success: true, message: 'Company saved successfully' })
            }

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
                    // Auto-classify if we have name or description
                    let classification = { industry: '其他', tags: [] }
                    if (metadata.title || metadata.description) {
                        try {
                            // Dynamic import for TS file in JS context might be tricky, 
                            // but since we are in Next.js API route, we might need to rely on the transpiled output or duplicate logic.
                            // For simplicity and robustness in this serverless function, let's implement a lightweight classifier here
                            // or try to import the service if transpilation allows.

                            // Let's try to import the service. If it fails, we fallback to basic defaults.
                            // Note: In Vercel serverless, src/services might not be directly importable if not built together.
                            // However, since we are using Next.js, it should handle it.
                            // But to be safe and avoid build issues with mixing JS/TS, let's use a simplified inline logic 
                            // or assume the caller (UI) will handle the classification suggestion based on the returned metadata.

                            // Actually, the requirement says "based on RSS and crawler...".
                            // Let's return the raw metadata and let the UI (which has full access to ClassificationService)
                            // suggest the industry/tags to the user before saving.
                            // This is better for "User Review" as well.
                        } catch (e) {
                            console.warn('Classification failed:', e)
                        }
                    }

                    return res.status(200).json({ success: true, metadata })
                } catch (error) {
                    console.error('[trusted-companies] Crawl error:', error)

                    // Fallback strategy for blocked sites (e.g. Whatnot returns 403)
                    // Try to guess the ATS/Career page URL based on the domain name
                    try {
                        let slug = ''
                        try {
                            const urlObj = new URL(url)
                            const hostname = urlObj.hostname.replace(/^www\./, '')
                            slug = hostname.split('.')[0]
                        } catch (e) { /* ignore */ }

                        if (slug && slug.length > 2) {
                            console.log(`[trusted-companies] Main crawl failed. Trying fallbacks for slug: ${slug}`)
                            const fallbacks = [
                                `https://jobs.ashbyhq.com/${slug}`,
                                `https://boards.greenhouse.io/${slug}`,
                                `https://jobs.lever.co/${slug}`
                            ]

                            for (const fbUrl of fallbacks) {
                                try {
                                    console.log(`[trusted-companies] Trying fallback: ${fbUrl}`)
                                    const fbRes = await fetch(fbUrl, {
                                        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                                    })

                                    if (fbRes.ok) {
                                        const fbHtml = await fbRes.text()
                                        const fbMetadata = extractMetadata(fbHtml)

                                        // If we got something useful
                                        if (fbMetadata.title || fbMetadata.description) {
                                            console.log(`[trusted-companies] Fallback success: ${fbUrl}`)

                                            // Normalize URLs
                                            if (fbMetadata.icon && !fbMetadata.icon.startsWith('http')) {
                                                const urlObj = new URL(fbUrl)
                                                fbMetadata.icon = new URL(fbMetadata.icon, urlObj.origin).toString()
                                            }
                                            if (fbMetadata.image && !fbMetadata.image.startsWith('http')) {
                                                const urlObj = new URL(fbUrl)
                                                fbMetadata.image = new URL(fbMetadata.image, urlObj.origin).toString()
                                            }

                                            // Add a note that this is from fallback
                                            fbMetadata._source = 'fallback_ats'
                                            fbMetadata._fallbackUrl = fbUrl

                                            return res.status(200).json({ success: true, metadata: fbMetadata })
                                        }
                                    }
                                } catch (e) {
                                    // Ignore fallback errors
                                }
                            }
                        }
                    } catch (fbError) {
                        console.error('[trusted-companies] Fallback error:', fbError)
                    }

                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            // Crawl Jobs Action
            if (action === 'crawl-jobs') {
                const { id, fetchDetails, maxDetails } = req.query
                if (!id) return res.status(400).json({ success: false, error: 'Company ID is required' })

                const companies = await getAllCompanies()
                const company = companies.find(c => c.id === id)
                if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                if (!company.careersPage && !company.website) return res.status(400).json({ success: false, error: 'No careers page or website URL' })

                try {
                    const { crawlCompanyJobs } = await import('../../lib/job-crawler.js')
                    const url = company.careersPage || company.website

                    // Parse options
                    const crawlOptions = {
                        fetchDetails: fetchDetails === 'true',
                        maxDetailFetches: parseInt(maxDetails || '10', 10),
                        concurrency: 3
                    }

                    console.log('[trusted-companies] Crawl options:', crawlOptions)

                    const crawlResult = await crawlCompanyJobs(company.id, url, crawlOptions)
                    const crawledJobs = crawlResult.jobs || []
                    const crawledCompany = crawlResult.company

                    // If we found company info (e.g. logo from Ashby), update the company record
                    if (crawledCompany && crawledCompany.logo && !company.logo) {
                        console.log(`[trusted-companies] Updating company logo from crawler: ${crawledCompany.logo}`)
                        company.logo = crawledCompany.logo
                        // We should persist this update
                        const allCompanies = await getAllCompanies()
                        const idx = allCompanies.findIndex(c => c.id === company.id)
                        if (idx !== -1) {
                            allCompanies[idx].logo = crawledCompany.logo
                            await saveAllCompanies(allCompanies)
                        }
                    }

                    // Enrich jobs with company name
                    const enrichedJobs = crawledJobs.map(job => ({
                        ...job,
                        company: company.name,
                        companyLogo: company.logo,
                        sourceType: 'trusted',
                        isTrusted: true,
                        canRefer: !!company.canRefer
                    }))

                    // Save to Job Storage (Accessing processed-jobs storage key directly)
                    // Note: This duplicates logic from processed-jobs.js but is necessary for cross-endpoint data manipulation
                    // in this simple serverless structure without a shared DB layer.
                    const JOB_STORAGE_KEY = 'haigoo:processed_jobs'
                    let existingJobs = []

                    // Read existing jobs (Priority: Upstash REST -> Redis TCP -> KV SDK -> Memory)
                    if (UPSTASH_REST_CONFIGURED) {
                        try {
                            const data = await upstashGet(JOB_STORAGE_KEY)
                            if (data) {
                                const parsed = typeof data === 'string' ? JSON.parse(data) : data
                                existingJobs = Array.isArray(parsed) ? parsed : []
                            }
                        } catch (e) {
                            console.warn('[trusted-companies] Upstash REST read jobs failed:', e?.message)
                        }
                    } else if (REDIS_CONFIGURED) {
                        const client = await getRedisClient()
                        if (client) {
                            const data = await client.get(JOB_STORAGE_KEY)
                            if (data) existingJobs = JSON.parse(data)
                        }
                    } else if (KV_CONFIGURED && kv) {
                        const data = await kv.get(JOB_STORAGE_KEY)
                        if (data) existingJobs = Array.isArray(data) ? data : []
                    } else {
                        existingJobs = globalThis.__haigoo_processed_jobs_mem || []
                    }

                    console.log(`[trusted-companies] Existing jobs count: ${existingJobs.length}`)

                    // Merge: Remove ALL jobs for this company (trusted OR otherwise) and add new crawled ones
                    // This ensures we don't have duplicates or stale data
                    const beforeMerge = existingJobs.length
                    const otherJobs = existingJobs.filter(j => {
                        // Remove if companyId matches
                        if (j.companyId === company.id) {
                            console.log(`[trusted-companies] Removing existing job ${j.id} for company ${company.id}`)
                            return false
                        }
                        // Also remove if company name matches (fallback for old data without companyId)
                        if (j.company === company.name) {
                            console.log(`[trusted-companies] Removing existing job ${j.id} by company name`)
                            return false
                        }
                        return true
                    })
                    console.log(`[trusted-companies] Removed ${beforeMerge - otherJobs.length} existing jobs for ${company.name}`)
                    const allJobs = [...otherJobs, ...enrichedJobs]

                    console.log(`[trusted-companies] After merge: ${allJobs.length} jobs (removed ${existingJobs.length - otherJobs.length} old, added ${enrichedJobs.length} new)`)

                    // Save back (Priority: Upstash REST -> Redis TCP -> KV SDK)
                    if (UPSTASH_REST_CONFIGURED) {
                        await upstashSet(JOB_STORAGE_KEY, JSON.stringify(allJobs))
                        console.log('[trusted-companies] Saved jobs to Upstash REST')
                    } else if (REDIS_CONFIGURED) {
                        const client = await getRedisClient()
                        if (client) await client.set(JOB_STORAGE_KEY, JSON.stringify(allJobs))
                        console.log('[trusted-companies] Saved jobs to Redis TCP')
                    } else if (KV_CONFIGURED && kv) {
                        await kv.set(JOB_STORAGE_KEY, allJobs)
                        console.log('[trusted-companies] Saved jobs to KV SDK')
                    }

                    // Update memory fallback
                    globalThis.__haigoo_processed_jobs_mem = allJobs

                    return res.status(200).json({ success: true, count: enrichedJobs.length, jobs: enrichedJobs })

                } catch (error) {
                    console.error('[trusted-companies] Job crawl error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            const { id, name, website, careersPage, linkedin, description, logo, tags, industry, canRefer } = body

            if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

            let companies = await getAllCompanies()
            const now = new Date().toISOString()

            if (id) {
                // Update
                const index = companies.findIndex(c => c.id === id)
                if (index === -1) return res.status(404).json({ success: false, error: 'Company not found' })

                companies[index] = {
                    ...companies[index],
                    name, website, careersPage, linkedin, description, logo, tags, industry,
                    canRefer: !!canRefer,
                    updatedAt: now
                }
            } else {
                // Create
                const newCompany = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name, website, careersPage, linkedin, description, logo, tags, industry,
                    createdAt: now,
                    updatedAt: now,
                    isTrusted: true,
                    canRefer: !!canRefer
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

            // IMPORTANT: Save company info BEFORE filtering
            const companyToDelete = companies.find(c => c.id === id)

            companies = companies.filter(c => c.id !== id)

            if (companies.length === initialLen) return res.status(404).json({ success: false, error: 'Company not found' })

            await saveAllCompanies(companies)

            // Also delete associated jobs
            try {
                const JOB_STORAGE_KEY = getEnv('haigoo:processed_jobs')
                let existingJobs = []

                console.log(`[trusted-companies] Attempting to delete jobs for company ID: ${id}`)

                // Read existing jobs
                if (UPSTASH_REST_CONFIGURED) {
                    const data = await upstashGet(JOB_STORAGE_KEY)
                    if (data) {
                        const parsed = typeof data === 'string' ? JSON.parse(data) : data
                        existingJobs = Array.isArray(parsed) ? parsed : []
                    }
                    console.log(`[trusted-companies] Read ${existingJobs.length} jobs from Upstash REST`)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) {
                        const data = await client.get(JOB_STORAGE_KEY)
                        if (data) existingJobs = JSON.parse(data)
                    }
                    console.log(`[trusted-companies] Read ${existingJobs.length} jobs from Redis TCP`)
                } else if (KV_CONFIGURED && kv) {
                    const data = await kv.get(JOB_STORAGE_KEY)
                    if (data) existingJobs = Array.isArray(data) ? data : []
                    console.log(`[trusted-companies] Read ${existingJobs.length} jobs from KV SDK`)
                } else {
                    existingJobs = globalThis.__haigoo_processed_jobs_mem || []
                    console.log(`[trusted-companies] Read ${existingJobs.length} jobs from memory`)
                }

                // Debug: Show sample of jobs with companyId
                if (existingJobs.length > 0) {
                    const sampleJobs = existingJobs.slice(0, 3).map(j => ({
                        id: j.id,
                        title: j.title,
                        companyId: j.companyId,
                        company: j.company
                    }))
                    console.log(`[trusted-companies] Sample jobs:`, JSON.stringify(sampleJobs))
                }

                // Filter out jobs for this company (try multiple strategies)
                const beforeCount = existingJobs.length
                const remainingJobs = existingJobs.filter(j => {
                    // Strategy 1: Match by companyId
                    if (j.companyId === id) {
                        console.log(`[trusted-companies] Removing job ${j.id} (matched companyId)`)
                        return false
                    }
                    // Strategy 2: Match by company name (fallback for old data)
                    if (companyToDelete && j.company === companyToDelete.name) {
                        console.log(`[trusted-companies] Removing job ${j.id} (matched company name)`)
                        return false
                    }
                    return true
                })
                const deletedCount = beforeCount - remainingJobs.length

                console.log(`[trusted-companies] Filtered ${deletedCount} jobs (${beforeCount} -> ${remainingJobs.length})`)

                // Save back
                if (UPSTASH_REST_CONFIGURED) {
                    await upstashSet(JOB_STORAGE_KEY, JSON.stringify(remainingJobs))
                    console.log(`[trusted-companies] Saved ${remainingJobs.length} jobs to Upstash REST`)
                } else if (REDIS_CONFIGURED) {
                    const client = await getRedisClient()
                    if (client) await client.set(JOB_STORAGE_KEY, JSON.stringify(remainingJobs))
                    console.log(`[trusted-companies] Saved ${remainingJobs.length} jobs to Redis TCP`)
                } else if (KV_CONFIGURED && kv) {
                    await kv.set(JOB_STORAGE_KEY, remainingJobs)
                    console.log(`[trusted-companies] Saved ${remainingJobs.length} jobs to KV SDK`)
                }

                globalThis.__haigoo_processed_jobs_mem = remainingJobs

                console.log(`[trusted-companies] ✅ Deleted company ${id} and ${deletedCount} associated jobs`)
            } catch (error) {
                console.error('[trusted-companies] ❌ Failed to delete associated jobs:', error)
                // Don't fail the company deletion if job cleanup fails
            }

            return res.status(200).json({ success: true, message: 'Deleted successfully' })
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' })
    } catch (error) {
        console.error('[trusted-companies] Error:', error)
        return res.status(500).json({ success: false, error: 'Server error' })
    }
}
