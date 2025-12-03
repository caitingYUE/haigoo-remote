import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import * as cheerio from 'cheerio'
import neonHelper from '../../server-utils/dal/neon-helper.js'

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

    metadata.coverImage = $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') || ''

    metadata.icon = $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href') || ''

    // If no icon found but we have an image, and that image seems small or square (hard to tell without downloading), 
    // we might just keep them separate. The UI will handle fallbacks.

    // Address extraction
    metadata.address = ''

    // 1. Schema.org Organization
    const scripts = $('script[type="application/ld+json"]')
    scripts.each((i, el) => {
        try {
            const json = JSON.parse($(el).text())
            const items = Array.isArray(json) ? json : [json]
            for (const item of items) {
                if (item['@type'] === 'Organization' || item['@type'] === 'Corporation') {
                    if (item.address) {
                        if (typeof item.address === 'string') {
                            metadata.address = item.address
                        } else if (typeof item.address === 'object') {
                            const parts = []
                            if (item.address.addressCountry) parts.push(item.address.addressCountry)
                            if (item.address.addressLocality) parts.push(item.address.addressLocality)
                            if (parts.length > 0) metadata.address = parts.join(', ')
                        }
                    }
                }
            }
        } catch (e) { }
    })

    // 2. Meta Tags
    if (!metadata.address) {
        const country = $('meta[property="og:country-name"]').attr('content') ||
            $('meta[name="geo.region"]').attr('content')
        const locality = $('meta[property="og:locality"]').attr('content') ||
            $('meta[name="geo.placename"]').attr('content')

        if (country && locality) {
            metadata.address = `${country}, ${locality}`
        } else if (country) {
            metadata.address = country
        } else if (locality) {
            metadata.address = locality
        }
    }

    return metadata
}

// Detect Neon database configuration
const NEON_CONFIGURED = !!neonHelper?.isConfigured


// Data Access Layer
export async function getAllCompanies() {
    try {
        if (NEON_CONFIGURED) {
            const result = await neonHelper.query('SELECT * FROM trusted_companies ORDER BY name')
            if (result) {
                // Convert database rows to company objects
                return result.map(row => ({
                    id: row.company_id,
                    name: row.name,
                    website: row.website,
                    description: row.description,
                    logo: row.logo,
                    coverImage: row.cover_image,
                    industry: row.industry,
                    tags: row.tags || [],
                    source: row.source,
                    jobCount: row.job_count || 0,
                    canRefer: row.can_refer || false,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }))
            }
        }
    } catch (e) {
        console.error('[trusted-companies] Read error:', e)
    }
    return []
}

export async function saveAllCompanies(companies, mode = 'upsert') {
    if (!NEON_CONFIGURED) {
        console.error('[trusted-companies] Neon database not configured')
        return false
    }

    try {
        // Use transaction to ensure data consistency
        await neonHelper.transaction(async (client) => {
            // Clear existing data ONLY if mode is replace
            if (mode === 'replace') {
                await client.query('DELETE FROM trusted_companies')
            }

            // Insert new companies
            for (const company of companies) {
                await client.query(`
                    INSERT INTO trusted_companies 
                    (company_id, name, website, description, logo, cover_image, industry, tags, source, job_count, can_refer, status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (company_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        website = EXCLUDED.website,
                        description = EXCLUDED.description,
                        logo = EXCLUDED.logo,
                        cover_image = EXCLUDED.cover_image,
                        industry = EXCLUDED.industry,
                        tags = EXCLUDED.tags,
                        source = EXCLUDED.source,
                        job_count = EXCLUDED.job_count,
                        can_refer = EXCLUDED.can_refer,
                        updated_at = EXCLUDED.updated_at
                `, [
                    company.id,
                    company.name,
                    company.website || '',
                    company.description || '',
                    company.logo || '',
                    company.coverImage || '',
                    company.industry || '其他',
                    JSON.stringify(company.tags || []),
                    company.source || 'manual',
                    company.jobCount || 0,
                    company.canRefer || false,
                    'active',
                    company.createdAt || new Date().toISOString(),
                    company.updatedAt || new Date().toISOString()
                ])
            }
        })
        console.log(`[trusted-companies] Saved ${companies.length} companies to Neon database (mode: ${mode})`)
        return true
    } catch (e) {
        console.error('[trusted-companies] Failed to save to Neon database:', e)
        return false
    }
}

// Helper functions for company management (moved to top level for reusability)
export const normalizeUrl = (url) => {
    if (!url) return ''
    try {
        const urlObj = new URL(url)
        return urlObj.hostname.replace(/^www\./, '').toLowerCase()
    } catch {
        return url.toLowerCase()
    }
}

export const extractCompanyFromJob = (job) => {
    // Helper to extract URL from description
    const extractUrl = (description) => {
        if (!description) return ''
        // 1. Try explicit URL field pattern
        const explicitMatch = description.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s\n]+)/i)
        if (explicitMatch) return explicitMatch[1].trim()

        // 2. Try common website patterns
        const websiteMatch = description.match(/(?:Website|Site|Web):\s*(https?:\/\/[^\s\n]+)/i)
        if (websiteMatch) return websiteMatch[1].trim()

        // 3. Try Markdown links (often the company name is linked)
        const markdownMatch = description.match(/\[.*?\]\((https?:\/\/[^)]+)\)/)
        if (markdownMatch) return markdownMatch[1].trim()

        return ''
    }

    // Determine Company Name
    let companyName = job.company
    // Fallback: Try to extract company from title if missing or generic
    if (!companyName || companyName === 'Unknown Company' || companyName === 'Unknown') {
        if (job.title) {
            if (job.title.includes(':')) {
                companyName = job.title.split(':')[0].trim()
            } else if (job.title.includes(' at ')) {
                const parts = job.title.split(' at ')
                if (parts.length > 1) companyName = parts[parts.length - 1].trim()
            } else if (job.title.includes(' | ')) {
                const parts = job.title.split(' | ')
                if (parts.length > 1) companyName = parts[parts.length - 1].trim()
            }
        }
    }

    // If still no name, return null (will be filtered out)
    if (!companyName || companyName === 'Unknown Company' || companyName === 'Unknown') {
        return { name: null }
    }

    // Try to get URL from various sources
    let companyUrl = job.companyWebsite || extractUrl(job.description || '')

    // Fallback: if no URL found, try to infer from job link (if it looks like a main domain)
    if (!companyUrl && job.url) {
        try {
            const urlObj = new URL(job.url)
            const hostname = urlObj.hostname.toLowerCase()
            // Skip common ATS/Job board domains to avoid setting ATS link as company website
            const isAts = hostname.includes('greenhouse') ||
                hostname.includes('lever') ||
                hostname.includes('ashby') ||
                hostname.includes('workable') ||
                hostname.includes('linkedin') ||
                hostname.includes('indeed') ||
                hostname.includes('glassdoor') ||
                hostname.includes('wellfound') ||
                hostname.includes('ycombinator') ||
                hostname.includes('remoteok') ||
                hostname.includes('weworkremotely') ||
                hostname.includes('himalayas')

            if (!isAts) {
                // Use the hostname as the company URL (e.g. https://stripe.com)
                companyUrl = `https://${hostname}`
            }
        } catch (e) { }
    }

    return {
        name: companyName,
        url: companyUrl,
        description: '',
        logo: undefined,
        coverImage: undefined,
        industry: job.companyIndustry || '其他',
        tags: job.companyTags || [],
        source: job.source || 'rss',
        jobCount: 1
    }
}

export const normalizeCompanyName = (name) => {
    return (name || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[,.\-_]/g, '')
}

export const deduplicateCompanies = (companies) => {
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
                coverImage: company.coverImage || existing.coverImage,
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

                // Handle relative URLs
                const baseUrl = new URL(targetUrl)
                const resolveUrl = (u) => {
                    if (!u) return ''
                    if (u.startsWith('http')) return u
                    if (u.startsWith('//')) return `https:${u}`
                    if (u.startsWith('/')) return `${baseUrl.origin}${u}`
                    return `${baseUrl.origin}/${u}`
                }

                if (metadata.coverImage) metadata.coverImage = resolveUrl(metadata.coverImage)
                if (metadata.icon) metadata.icon = resolveUrl(metadata.icon)

                return res.status(200).json({
                    url: targetUrl,
                    logo: metadata.icon, // Prefer icon for logo
                    coverImage: metadata.coverImage, // New field
                    address: metadata.address, // New field
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
            const { target, action } = req.query
            console.log(`[trusted-companies] GET request. Target: ${target}, Action: ${action}`)

            // Default GET: Return all trusted companies if no target specified
            if (!target && !req.query.action) {
                const companies = await getAllCompanies()
                return res.status(200).json({ success: true, companies })
            }

            // Tag Config Target
            if (target === 'tags') {
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

                // 从数据库获取配置
                let config = null
                try {
                    const result = await neonHelper.query('SELECT config_data FROM tag_config WHERE config_type = $1', [TAG_CONFIG_KEY])
                    if (result && result.length > 0) {
                        config = result[0].config_data
                    }
                } catch (e) {
                    console.warn('[trusted-companies] Failed to read config from database:', e)
                }

                if (!config) {
                    return res.status(200).json({ success: true, config: DEFAULT_CONFIG })
                }

                const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config
                return res.status(200).json({ success: true, config: parsedConfig })
            }

            // Sync Trusted Company Data to Jobs
            if (action === 'sync-jobs') {
                console.log('[sync-jobs] Starting synchronization...')
                const JOBS_KEY = 'haigoo:jobs'
                // Use the correct key for trusted companies (same as getAllCompanies)
                const COMPANIES_KEY = 'haigoo:trusted_companies'

                try {
                    // 1. Get All Trusted Companies
                    let trustedCompanies = []
                    if (NEON_CONFIGURED) {
                        // Fetch minimal fields needed for matching
                        const result = await neonHelper.query('SELECT company_id, name, website, logo, description, industry, tags FROM trusted_companies ORDER BY name')
                        if (result && result.length > 0) {
                            trustedCompanies = result.map(row => ({
                                id: row.company_id,
                                name: row.name,
                                website: row.website,
                                description: row.description,
                                logo: row.logo,
                                industry: row.industry,
                                tags: row.tags || []
                            }))
                        }
                    }

                    if (!trustedCompanies || trustedCompanies.length === 0) {
                        console.log('[sync-jobs] No trusted companies found')
                        return res.status(200).json({ success: true, message: 'No trusted companies found', updatedCount: 0 })
                    }
                    console.log(`[sync-jobs] Loaded ${trustedCompanies.length} trusted companies`)

                    // Prepare normalization helper
                    const normalize = (name) => {
                        if (!name) return ''
                        return name.toLowerCase()
                            .replace(/[,.]/g, '') // Remove punctuation
                            .replace(/\s+/g, ' ') // Normalize spaces
                            .replace(/\b(inc|ltd|llc|corp|corporation|co|limited|company)\b/g, '') // Remove suffixes
                            .trim()
                    }

                    // Pre-compute normalized names for faster matching
                    const trustedMap = new Map() // exact name -> company
                    const normalizedTrustedMap = new Map() // normalized name -> company

                    trustedCompanies.forEach(c => {
                        if (c.name) {
                            trustedMap.set(c.name, c)
                            const norm = normalize(c.name)
                            if (norm) normalizedTrustedMap.set(norm, c)
                        }
                    })

                    // 2. Process Jobs in Batches
                    let totalUpdatedCount = 0
                    const BATCH_SIZE = 500

                    // Get total count first
                    const countResult = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active'")
                    const totalJobs = parseInt(countResult[0].count || 0)
                    console.log(`[sync-jobs] Found ${totalJobs} active jobs to process`)

                    for (let offset = 0; offset < totalJobs; offset += BATCH_SIZE) {
                        console.log(`[sync-jobs] Processing batch ${offset} - ${offset + BATCH_SIZE}...`)

                        // Fetch batch
                        const jobsResult = await neonHelper.query(
                            `SELECT job_id, title, company, company_id, company_logo, company_website, 
                                    company_description, industry, company_tags 
                             FROM jobs 
                             WHERE status = 'active' 
                             ORDER BY created_at DESC 
                             LIMIT ${BATCH_SIZE} OFFSET ${offset}`
                        )

                        if (!jobsResult || jobsResult.length === 0) break

                        const jobsArray = jobsResult.map(row => ({
                            id: row.job_id,
                            company: row.company,
                            companyId: row.company_id,
                            companyLogo: row.company_logo,
                            companyWebsite: row.company_website,
                            companyDescription: row.company_description,
                            companyIndustry: row.industry,
                            companyTags: row.company_tags || []
                        }))

                        // Match and collect updates
                        const updates = [] // Array of { jobId, companyId }

                        for (const job of jobsArray) {
                            if (!job.company) continue

                            let matchedCompany = null

                            // Strategy 1: Exact match
                            if (trustedMap.has(job.company)) {
                                matchedCompany = trustedMap.get(job.company)
                            }

                            // Strategy 2: Normalized match
                            if (!matchedCompany) {
                                const normJob = normalize(job.company)
                                if (normalizedTrustedMap.has(normJob)) {
                                    matchedCompany = normalizedTrustedMap.get(normJob)
                                } else {
                                    // Strategy 3: Partial match (careful!)
                                    // Only if job company name is long enough to avoid false positives
                                    if (normJob.length > 3) {
                                        for (const [normTrusted, company] of normalizedTrustedMap.entries()) {
                                            if (normTrusted.length > 3 && normJob.includes(normTrusted)) {
                                                matchedCompany = company
                                                break
                                            }
                                        }
                                    }
                                }
                            }

                            if (matchedCompany) {
                                // Check if update is needed (optimization: skip if already linked correctly)
                                // But requirement says "sync", implying we overwrite to ensure latest data
                                // We'll just push to updates
                                updates.push({
                                    job_id: job.id,
                                    company_id: matchedCompany.id
                                })
                            }
                        }

                        // Bulk Update
                        if (updates.length > 0) {
                            try {
                                // Construct VALUES list: ('job1', 'comp1'), ('job2', 'comp2')...
                                const valuesList = updates.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
                                const params = updates.flatMap(u => [u.job_id, u.company_id])

                                const updateQuery = `
                                    UPDATE jobs AS j
                                    SET company_id = v.company_id, 
                                        is_trusted = true, 
                                        updated_at = NOW()
                                    FROM (VALUES ${valuesList}) AS v(job_id, company_id)
                                    WHERE j.job_id = v.job_id
                                `

                                await neonHelper.query(updateQuery, params)
                                totalUpdatedCount += updates.length
                                console.log(`[sync-jobs] Updated ${updates.length} jobs in this batch`)
                            } catch (err) {
                                console.error(`[sync-jobs] Failed to update batch:`, err)
                            }
                        }
                    }

                    console.log(`[sync-jobs] Synced total ${totalUpdatedCount} jobs`)
                    return res.status(200).json({
                        success: true,
                        message: `Synced ${totalUpdatedCount} jobs with company data`,
                        updatedCount: totalUpdatedCount
                    })
                } catch (error) {
                    console.error('[sync-jobs] Error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            // Extract companies from jobs (works with any target or no target)
            if (action === 'extract') {
                console.log('[companies] Starting extraction...')
                try {

                    let jobsArray = []
                    if (NEON_CONFIGURED) {
                        console.log('[companies] Fetching from Neon database...')
                        const result = await neonHelper.query('SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC', ['active'])
                        console.log(`[companies] DB Query result length: ${result ? result.length : 'null'}`)
                        if (result && result.length > 0) {
                            jobsArray = result.map(row => ({
                                id: row.job_id,
                                title: row.title,
                                company: row.company,
                                companyId: row.company_id,
                                companyLogo: row.company_logo,
                                companyWebsite: row.company_website,
                                companyDescription: row.company_description,
                                companyIndustry: row.industry,
                                companyTags: row.company_tags || [],
                                location: row.location,
                                description: row.description,
                                url: row.url,
                                source: row.source,
                                tags: row.tags || [],
                                salary: row.salary,
                                remote: row.is_remote,
                                createdAt: row.created_at,
                                updatedAt: row.updated_at
                            }))
                        }
                    } else {
                        console.warn('[companies] No database configured for jobs extraction')
                    }

                    if (!Array.isArray(jobsArray)) {
                        console.warn('[companies] Jobs data is not an array:', typeof jobsArray)
                        jobsArray = []
                    }

                    console.log(`[companies] Found ${jobsArray.length} jobs to process`)

                    // DEBUG: Log first job
                    if (jobsArray.length > 0) {
                        console.log('[companies] First job sample:', JSON.stringify(jobsArray[0]))
                    }

                    if (jobsArray.length === 0) {
                        return res.status(200).json({
                            success: true,
                            companies: [],
                            message: '没有找到岗位数据'
                        })
                    }

                    const extractedCompanies = jobsArray.map(job => extractCompanyFromJob(job))
                    console.log(`[companies] Extracted ${extractedCompanies.length} companies (before filtering)`)

                    // Filter out companies with null names
                    const validCompanies = extractedCompanies.filter(c => c.name != null)
                    console.log(`[companies] Valid companies (with names): ${validCompanies.length}`)

                    // DEBUG: Log first extracted
                    if (validCompanies.length > 0) {
                        console.log('[companies] First extracted sample:', JSON.stringify(validCompanies[0]))
                    } else if (extractedCompanies.length > 0) {
                        console.log('[companies] First extracted sample (invalid):', JSON.stringify(extractedCompanies[0]))
                    }

                    const deduplicated = deduplicateCompanies(validCompanies)
                    console.log(`[companies] Extracted ${deduplicated.length} unique companies`)

                    // Get existing companies to preserve metadata (logo, description, tags, etc.)
                    let existingCompanies = []
                    try {
                        if (NEON_CONFIGURED) {
                            const result = await neonHelper.query('SELECT * FROM extracted_companies ORDER BY name')
                            if (result && result.length > 0) {
                                existingCompanies = result.map(row => ({
                                    id: row.company_id,
                                    name: row.name,
                                    url: row.url,
                                    description: row.description,
                                    logo: row.logo,
                                    coverImage: row.cover_image,
                                    industry: row.industry,
                                    tags: row.tags || [],
                                    source: row.source,
                                    jobCount: row.job_count || 0,
                                    createdAt: row.created_at,
                                    updatedAt: row.updated_at
                                }))
                            }
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

                    // Final deduplication by ID to ensure no duplicates before insertion
                    // This handles cases where multiple extracted entries (e.g. one with URL, one without) 
                    // matched the same existing company
                    const uniqueMergedCompanies = Array.from(
                        new Map(mergedCompanies.map(c => [c.id, c])).values()
                    )
                    console.log(`[companies] Merged ${mergedCompanies.length} companies -> ${uniqueMergedCompanies.length} unique companies`)

                    // Save to database
                    try {
                        if (NEON_CONFIGURED) {
                            await neonHelper.transaction(async (client) => {
                                // Clear existing extracted companies
                                await client.query('DELETE FROM extracted_companies')

                                // Insert new extracted companies
                                for (const company of uniqueMergedCompanies) {
                                    await client.query(`
                                            INSERT INTO extracted_companies 
                                            (company_id, name, url, description, logo, cover_image, industry, tags, source, job_count, created_at, updated_at)
                                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                                        `, [
                                        company.id,
                                        company.name,
                                        company.url || '',
                                        company.description || '',
                                        company.logo || '',
                                        company.coverImage || '',
                                        company.industry || '其他',
                                        JSON.stringify(company.tags || []),
                                        company.source || 'extracted',
                                        company.jobCount || 0,
                                        company.createdAt || new Date().toISOString(),
                                        company.updatedAt || new Date().toISOString()
                                    ])
                                }
                            })
                        }
                        console.log('[companies] Saved merged companies to database')
                    } catch (e) {
                        console.error('[companies] Failed to save merged companies:', e)
                        throw new Error('Failed to save companies data')
                    }

                    return res.status(200).json({
                        success: true,
                        companies: deduplicated,
                        message: `成功提取 ${deduplicated.length} 个企业`
                    })
                } catch (error) {
                    console.error('[companies] Extract error:', error)
                    return res.status(500).json({
                        success: false,
                        error: `Failed to extract companies: ${error.message || 'Unknown error'}`
                    })
                }
            }

            // Companies Target (Listing)
            if (target === 'companies') {
                const { id } = req.query
                const page = parseInt(req.query.page) || 1
                const pageSize = parseInt(req.query.pageSize) || 50
                const search = req.query.search || ''
                const industry = req.query.industry || ''

                // Get companies from database
                let companiesArray = []
                if (NEON_CONFIGURED) {
                    try {

                        // Fetch queries sequentially to avoid potential connection/concurrency issues
                        console.log('[trusted-companies] Fetching trusted_companies...');
                        const trustedResult = await neonHelper.query('SELECT * FROM trusted_companies ORDER BY name');

                        console.log('[trusted-companies] Fetching extracted_companies...');
                        const extractedResult = await neonHelper.query('SELECT * FROM extracted_companies ORDER BY name');

                        console.log(`[trusted-companies] GET: Trusted=${trustedResult ? trustedResult.length : 'null'}, Extracted=${extractedResult ? extractedResult.length : 'null'}`)

                        const trustedCompanies = (trustedResult || []).map(row => ({
                            id: row.company_id,
                            name: row.name,
                            url: row.website,
                            description: row.description,
                            logo: row.logo,
                            coverImage: row.cover_image,
                            industry: row.industry,
                            tags: row.tags || [],
                            source: row.source,
                            jobCount: row.job_count || 0,
                            isTrusted: true,
                            canRefer: row.can_refer || false,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        }))

                        const extractedCompanies = (extractedResult || []).map(row => ({
                            id: row.company_id,
                            name: row.name,
                            url: row.url,
                            description: row.description,
                            logo: row.logo,
                            coverImage: row.cover_image,
                            industry: row.industry,
                            tags: row.tags || [],
                            source: row.source,
                            jobCount: row.job_count || 0,
                            isTrusted: false,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        }))

                        // Merge lists (Trusted companies take precedence)
                        const companyMap = new Map()

                        // Add extracted first
                        let extractedCount = 0
                        extractedCompanies.forEach(c => {
                            // Use a more robust key if name is empty
                            if (c.name) {
                                companyMap.set(normalizeCompanyName(c.name), c)
                                extractedCount++
                            }
                        })
                        console.log(`[trusted-companies] Merged ${extractedCount} extracted companies`)

                        // Add/Overwrite with trusted
                        let trustedCount = 0
                        trustedCompanies.forEach(c => {
                            if (c.name) {
                                const key = normalizeCompanyName(c.name)
                                const existing = companyMap.get(key)
                                if (existing) {
                                    // Merge stats from extracted if needed, but keep trusted metadata
                                    companyMap.set(key, {
                                        ...c,
                                        jobCount: Math.max(c.jobCount || 0, existing.jobCount || 0)
                                    })
                                } else {
                                    companyMap.set(key, c)
                                }
                                trustedCount++
                            }
                        })
                        console.log(`[trusted-companies] Merged ${trustedCount} trusted companies. Total map size: ${companyMap.size}`)

                        companiesArray = Array.from(companyMap.values())
                        console.log(`[trusted-companies] GET: Merged total=${companiesArray.length}`)
                    } catch (e) {
                        console.error('[trusted-companies] GET error:', e)
                        // Fallback to trusted only
                        const result = await neonHelper.query('SELECT * FROM trusted_companies ORDER BY name')
                        if (result && result.length > 0) {
                            companiesArray = result.map(row => ({
                                id: row.company_id,
                                name: row.name,
                                url: row.website,
                                description: row.description,
                                logo: row.logo,
                                coverImage: row.cover_image,
                                industry: row.industry,
                                tags: row.tags || [],
                                source: row.source,
                                jobCount: row.job_count || 0,
                                isTrusted: true,
                                canRefer: row.can_refer || false,
                                createdAt: row.created_at,
                                updatedAt: row.updated_at
                            }))
                        }
                    }
                }

                // Get single company
                if (id) {
                    const company = companiesArray.find(c => c.id === id)
                    if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                    return res.status(200).json({ success: true, company })
                }

                // List all companies with pagination
                // Using variables defined at the start of this block

                // Disable cache to ensure fresh data after migration
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

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
            const { action, target } = req.query
            console.log(`[trusted-companies] POST request received. Action: ${action}, Target: ${target}`)

            // Initialize Tags Action
            if (action === 'init-tags') {
                const TAG_CONFIG_KEY = 'haigoo:tag_config'
                const INITIAL_CONFIG = {
                    jobCategories: [
                        '前端开发', '后端开发', '全栈开发', '移动开发',
                        '算法工程师', '数据开发', '数据分析', '服务器开发',
                        '运维/SRE', '网络安全', '操作系统/内核', '技术支持',
                        '硬件开发', '架构师', 'CTO/技术管理', '软件开发',
                        '产品经理', '产品设计', '用户研究', '项目管理',
                        'UI/UX设计', '平面设计', '视觉设计', '商业分析',
                        '运营', '市场营销', '销售', '客户经理', '客户服务',
                        '内容创作', '增长黑客', '人力资源', '招聘', '财务',
                        '法务', '行政', '管理', '教育培训', '咨询', '投资',
                        '其他'
                    ],
                    companyIndustries: [
                        '人工智能', 'Web3/区块链', '企业服务/SaaS', '金融/Fintech',
                        '电子商务', '游戏/娱乐', '大健康/医疗', '教育',
                        '硬件/物联网', '互联网/软件', '其他'
                    ],
                    companyTags: [
                        'AI+陪伴', 'AI+健康', 'AI基础设施', 'AI Agent',
                        '远程优先', '全球招聘', '初创公司', '独角兽', '出海',
                        'SaaS', 'Software', 'Fintech', 'E-commerce', 'Gaming',
                        'Healthcare', 'EdTech', 'Web3', 'Blockchain', 'Data'
                    ]
                }

                try {
                    if (NEON_CONFIGURED) {
                        const configStr = JSON.stringify(INITIAL_CONFIG)
                        await neonHelper.query(`
                            INSERT INTO tag_config (config_type, config_data, updated_at)
                            VALUES ($1, $2, NOW())
                            ON CONFLICT (config_type) 
                            DO UPDATE SET config_data = EXCLUDED.config_data, updated_at = NOW()
                        `, [TAG_CONFIG_KEY, configStr])
                        console.log('[trusted-companies] Initialized tag config')
                        return res.status(200).json({ success: true, message: 'Tag configuration initialized', config: INITIAL_CONFIG })
                    } else {
                        return res.status(500).json({ success: false, error: 'Database not configured' })
                    }
                } catch (error) {
                    console.error('[trusted-companies] Init tags error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            // Re-classify all jobs
            if (action === 'reclassify') {
                try {
                    // Import classification service
                    const { classifyJob } = await import('../../lib/services/classification-service.js')

                    // Get all jobs from database
                    let jobs = []
                    if (NEON_CONFIGURED) {
                        const result = await neonHelper.query('SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC', ['active'])
                        if (result && result.length > 0) {
                            jobs = result.map(row => ({
                                id: row.job_id,
                                title: row.title,
                                company: row.company,
                                description: row.description,
                                category: row.category,
                                tags: row.tags || []
                            }))
                        }
                    }

                    console.log(`[trusted-companies] Re-classifying ${jobs.length} jobs`)

                    // Re-classify all jobs
                    let updatedCount = 0
                    const updates = []

                    for (const job of jobs) {
                        const newCategory = classifyJob(job.title || '', job.description || '')
                        if (job.category !== newCategory) {
                            updatedCount++
                            updates.push({
                                id: job.id,
                                category: newCategory
                            })
                        }
                    }

                    // Batch update in transaction
                    if (updates.length > 0 && NEON_CONFIGURED) {
                        await neonHelper.transaction(async (client) => {
                            for (const update of updates) {
                                await client.query('UPDATE jobs SET category = $1 WHERE job_id = $2', [update.category, update.id])
                            }
                        })
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
                    return res.status(500).json({ success: false, error: 'Re-classification failed: ' + error.message })
                }
            }

            // Sync Jobs Action (Global Sync)
            if (action === 'sync-jobs') {
                console.log('[trusted-companies] Starting global job sync...')
                try {
                    let jobs = []

                    // 1. Load Jobs from database
                    if (NEON_CONFIGURED) {
                        const result = await neonHelper.query('SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC', ['active'])
                        if (result && result.length > 0) {
                            jobs = result.map(row => ({
                                id: row.job_id,
                                title: row.title,
                                company: row.company,
                                companyId: row.company_id,
                                companyLogo: null, // jobs表没有这些字段
                                companyWebsite: null,
                                companyDescription: null,
                                companyIndustry: null,
                                companyTags: [],
                                location: row.location,
                                description: row.description,
                                url: row.url,
                                source: row.source,
                                tags: row.tags || [],
                                salary: row.salary,
                                remote: row.is_remote,
                                createdAt: row.created_at,
                                updatedAt: row.updated_at
                            }))
                        }
                    }

                    // 2. Load Companies
                    const companies = await getAllCompanies()

                    // 3. Enrich Jobs
                    let updatedCount = 0
                    const enrichedJobs = jobs.map(job => {
                        // Find matching company
                        // Priority: companyId match -> Exact name match -> Case-insensitive name match
                        let company = null
                        if (job.companyId) {
                            company = companies.find(c => c.id === job.companyId)
                        }
                        if (!company && job.company) {
                            const jobCompName = job.company.toLowerCase().trim()
                            company = companies.find(c => c.name.toLowerCase().trim() === jobCompName)
                        }

                        if (company) {
                            // Check if anything needs updating
                            const needsUpdate =
                                job.companyLogo !== company.logo ||
                                job.industry !== company.industry ||
                                job.companyDescription !== company.description ||
                                job.isTrusted !== true ||
                                job.companyId !== company.id;

                            if (needsUpdate) {
                                updatedCount++
                                return {
                                    ...job,
                                    company: company.name, // Normalize name
                                    companyId: company.id,
                                    companyLogo: company.logo,
                                    companyDescription: company.description,
                                    companyWebsite: company.website,
                                    industry: company.industry,
                                    tags: Array.from(new Set([...(job.tags || []), ...(company.tags || [])])),
                                    isTrusted: true,
                                    canRefer: !!company.canRefer,
                                    sourceType: 'trusted' // Mark as trusted source
                                }
                            }
                        }
                        return job
                    })

                    if (updatedCount > 0 && NEON_CONFIGURED) {
                        // 4. Save back to database
                        await neonHelper.transaction(async (client) => {
                            for (const job of enrichedJobs) {
                                await client.query(`
                                    UPDATE jobs 
                                    SET company_id = $1, 
                                        company_logo = $2, 
                                        company_website = $3,
                                        company_description = $4,
                                        industry = $5,
                                        company_tags = $6,
                                        tags = $7,
                                        is_trusted = $8, 
                                        can_refer = $9, 
                                        source_type = $10,
                                        updated_at = $11
                                    WHERE job_id = $12
                                `, [
                                    job.companyId || null,
                                    job.companyLogo || '',
                                    job.companyWebsite || '',
                                    job.companyDescription || '',
                                    job.industry || '其他',
                                    JSON.stringify(job.companyTags || []),
                                    JSON.stringify(job.tags || []),
                                    job.isTrusted || false,
                                    job.canRefer || false,
                                    job.sourceType || 'trusted',
                                    new Date().toISOString(),
                                    job.id
                                ])
                            }
                        })
                        console.log(`[trusted-companies] Synced ${updatedCount} jobs with company metadata`)
                    } else {
                        console.log('[trusted-companies] No jobs needed syncing')
                    }

                    return res.status(200).json({
                        success: true,
                        message: `成功同步 ${updatedCount} 个岗位的数据`,
                        total: jobs.length,
                        updated: updatedCount
                    })

                } catch (error) {
                    console.error('[trusted-companies] Sync jobs error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            // Tag Management
            if (target === 'tags') {
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

                // CRITICAL FIX: Load current config from database first (same as GET handler)
                let config = DEFAULT_CONFIG
                if (NEON_CONFIGURED) {
                    try {
                        const result = await neonHelper.query('SELECT config_data FROM tag_config WHERE config_type = $1', [TAG_CONFIG_KEY])
                        if (result && result.length > 0) {
                            const dbConfig = result[0].config_data
                            config = typeof dbConfig === 'string' ? JSON.parse(dbConfig) : dbConfig
                            console.log('[trusted-companies] Loaded existing config from database')
                        } else {
                            console.log('[trusted-companies] No existing config found, using defaults')
                        }
                    } catch (e) {
                        console.warn('[trusted-companies] Failed to load config from database, using defaults:', e)
                    }
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

                if (NEON_CONFIGURED) {
                    try {
                        await neonHelper.query(`
                            INSERT INTO tag_config (config_type, config_data, updated_at)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (config_type) DO UPDATE 
                            SET config_data = $2, updated_at = $3
                        `, [TAG_CONFIG_KEY, configStr, new Date().toISOString()])

                        console.log('[trusted-companies] Tag config saved to database')
                    } catch (e) {
                        console.error('[trusted-companies] Failed to save tag config:', e)
                        return res.status(500).json({ success: false, error: 'Failed to save configuration' })
                    }
                }

                // CRITICAL FIX: Return success response
                return res.status(200).json({
                    success: true,
                    config,
                    message: 'Tag configuration updated successfully'
                })
            }

            // Companies Target - POST operations
            if (target === 'companies') {
                // Get current companies from database
                let companiesArray = []
                if (NEON_CONFIGURED) {
                    const result = await neonHelper.query('SELECT * FROM extracted_companies ORDER BY name')
                    if (result && result.length > 0) {
                        companiesArray = result.map(row => ({
                            id: row.company_id,
                            name: row.name,
                            url: row.url,
                            description: row.description,
                            logo: row.logo,
                            coverImage: row.cover_image,
                            industry: row.industry,
                            tags: row.tags || [],
                            source: row.source,
                            jobCount: row.job_count || 0,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        }))
                    }
                }

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

                // Save companies to database
                if (NEON_CONFIGURED) {
                    await neonHelper.transaction(async (client) => {
                        // Clear existing extracted companies
                        await client.query('DELETE FROM extracted_companies')

                        // Insert updated companies
                        for (const company of companiesArray) {
                            await client.query(`
                                INSERT INTO extracted_companies 
                                (company_id, name, url, description, logo, cover_image, industry, tags, source, job_count, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                            `, [
                                company.id,
                                company.name,
                                company.url || '',
                                company.description || '',
                                company.logo || '',
                                company.coverImage || '',
                                company.industry || '其他',
                                JSON.stringify(company.tags || []),
                                company.source || 'manual',
                                company.jobCount || 0,
                                company.createdAt || new Date().toISOString(),
                                company.updatedAt || new Date().toISOString()
                            ])
                        }
                    })
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
            // Aggregate Companies from Jobs Action
            if (action === 'aggregate-companies') {
                console.log('[aggregate-companies] Starting aggregation...')
                try {

                    // 1. Get all jobs
                    console.log('[aggregate-companies] Fetching jobs...')
                    const jobs = await neonHelper.query('SELECT * FROM jobs ORDER BY created_at DESC')

                    if (!jobs || jobs.length === 0) {
                        console.log('[aggregate-companies] No jobs found')
                        return res.status(200).json({ success: true, message: 'No jobs found to aggregate' })
                    }
                    console.log(`[aggregate-companies] Found ${jobs.length} jobs`)

                    // 2. Extract companies
                    const companyMap = new Map()
                    let skippedCount = 0

                    // Helper to normalize job object for extraction
                    const normalizeJob = (row) => ({
                        id: row.job_id,
                        title: row.title,
                        company: row.company,
                        companyId: row.company_id,
                        companyLogo: row.company_logo,
                        companyWebsite: row.company_website,
                        companyDescription: row.company_description,
                        companyIndustry: row.industry,
                        companyTags: row.company_tags || [],
                        location: row.location,
                        description: row.description,
                        url: row.url,
                        source: row.source,
                        tags: row.tags || [],
                        salary: row.salary,
                        remote: row.is_remote,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    })

                    for (const row of jobs) {
                        const job = normalizeJob(row)
                        const extracted = extractCompanyFromJob(job)

                        if (!extracted || !extracted.name || extracted.name === 'Unknown Company') {
                            skippedCount++
                            continue
                        }

                        const key = normalizeCompanyName(extracted.name)
                        if (!key) continue

                        const existing = companyMap.get(key)
                        if (existing) {
                            companyMap.set(key, {
                                ...existing,
                                description: (extracted.description?.length || 0) > (existing.description?.length || 0)
                                    ? extracted.description : existing.description,
                                logo: extracted.logo || existing.logo,
                                coverImage: extracted.coverImage || existing.coverImage,
                                url: extracted.url || existing.url,
                                tags: Array.from(new Set([...(existing.tags || []), ...(extracted.tags || [])])),
                                jobCount: (existing.jobCount || 0) + (extracted.jobCount || 0),
                                updatedAt: new Date().toISOString()
                            })
                        } else {
                            companyMap.set(key, {
                                ...extracted,
                                id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            })
                        }
                    }

                    console.log(`[aggregate-companies] Extracted ${companyMap.size} unique companies (skipped ${skippedCount} jobs)`)

                    const companies = Array.from(companyMap.values())

                    // 3. Save to extracted_companies
                    if (companies.length > 0) {
                        await neonHelper.transaction(async (client) => {
                            await client.query('DELETE FROM extracted_companies')
                            for (const company of companies) {
                                await client.query(`
                                    INSERT INTO extracted_companies 
                                    (company_id, name, url, description, logo, cover_image, industry, tags, source, job_count, created_at, updated_at)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                                `, [
                                    company.id, company.name, company.url, company.description,
                                    company.logo, company.coverImage, company.industry,
                                    JSON.stringify(company.tags), company.source, company.jobCount,
                                    company.createdAt, company.updatedAt
                                ])
                            }
                        })
                        console.log('[aggregate-companies] Saved to database')
                    }

                    return res.status(200).json({
                        success: true,
                        count: companies.length,
                        message: `Successfully aggregated ${companies.length} companies`
                    })
                } catch (e) {
                    console.error('[aggregate-companies] Failed:', e)
                    return res.status(500).json({ success: false, error: e.message })
                }
            }
            // Batch Import from Excel Action
            if (action === 'batch-import') {
                try {
                    const xlsxModule = await import('xlsx')
                    const XLSX = xlsxModule.default || xlsxModule

                    // Get file buffer from request body
                    const { fileBuffer, crawlMetadata = true } = req.body

                    if (!fileBuffer) {
                        return res.status(400).json({
                            success: false,
                            error: 'No file provided. Please upload an Excel file.'
                        })
                    }

                    console.log(`[batch-import] Parsing Excel file from upload`)
                    console.log(`[batch-import] NEON_CONFIGURED: ${NEON_CONFIGURED}`)

                    // Parse Excel file from buffer
                    const buffer = Buffer.from(fileBuffer, 'base64')
                    const workbook = XLSX.read(buffer, { type: 'buffer' })
                    const sheetName = workbook.SheetNames[0]
                    const worksheet = workbook.Sheets[sheetName]
                    const excelData = XLSX.utils.sheet_to_json(worksheet)

                    console.log(`[batch-import] Found ${excelData.length} companies in Excel`)
                    if (excelData.length > 0) {
                        console.log(`[batch-import] First row sample:`, JSON.stringify(excelData[0]))
                    }

                    // Get existing companies from Trusted Table ONLY to avoid duplicates
                    // We allow "Extracted" companies to be imported as "Trusted" (effectively upgrading them)
                    console.log(`[batch-import] Fetching existing trusted companies...`)
                    const trustedCompanies = await getAllCompanies()
                    console.log(`[batch-import] Found ${trustedCompanies.length} existing trusted companies`)

                    // We do NOT check extracted_companies for duplicates during import
                    // This allows users to "import" companies that were previously just extracted from jobs

                    const existingNames = new Set(trustedCompanies.map(c => normalizeCompanyName(c.name)))
                    const existingWebsites = new Set(trustedCompanies.map(c => normalizeUrl(c.website)).filter(Boolean))

                    // Helper: normalize industry
                    const normalizeIndustry = (industry) => {
                        if (!industry) return '其他'
                        const industryMap = {
                            'Technology, Information and Internet': '互联网/软件',
                            'Software Development': '互联网/软件',
                            'IT Services': '互联网/软件',
                            'Financial Services': '金融/Fintech',
                            'Healthcare': '大健康/医疗',
                            'Education': '教育',
                            'E-commerce': '电子商务',
                            'Gaming': '游戏',
                            'Media': '媒体/娱乐',
                            'Entertainment': '媒体/娱乐',
                            'SaaS': '企业服务/SaaS',
                            'Enterprise Software': '企业服务/SaaS',
                            'AI': '人工智能',
                            'Artificial Intelligence': '人工智能',
                            'Blockchain': 'Web3/区块链',
                            'Web3': 'Web3/区块链',
                            'Hardware': '硬件/物联网',
                            'IoT': '硬件/物联网'
                        }
                        for (const [key, value] of Object.entries(industryMap)) {
                            if (industry.includes(key)) return value
                        }
                        return '互联网/软件'
                    }

                    // Helper: extract tags
                    const extractTags = (company) => {
                        const tags = []
                        if (company['Where You Can Work']?.toLowerCase().includes('worldwide')) {
                            tags.push('远程优先')
                            tags.push('全球招聘')
                        }
                        return tags
                    }

                    // Transform Excel data to TrustedCompany format
                    const newCompanies = []
                    const skippedCompanies = []

                    for (const row of excelData) {
                        const companyName = row['Company Name'] || row['Company']  // Support both formats
                        const website = row['Website'] || row['Site']  // Support both formats

                        if (!companyName || !website) {
                            skippedCompanies.push({ name: companyName || 'Unknown', reason: 'Missing required fields' })
                            continue
                        }

                        // Check for duplicates
                        const normName = normalizeCompanyName(companyName)
                        const normUrl = normalizeUrl(website)

                        if (existingNames.has(normName) || (normUrl && existingWebsites.has(normUrl))) {
                            skippedCompanies.push({ name: companyName, reason: 'Duplicate' })
                            continue
                        }

                        const company = {
                            id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            name: companyName,
                            website: website,
                            careersPage: row['Career Page'] || row['Careers Page'] || website,
                            description: row['Description'] || '',
                            industry: normalizeIndustry(row['Industry']),
                            tags: extractTags(row),
                            isTrusted: true,
                            canRefer: false,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }

                        newCompanies.push(company)
                    }

                    console.log(`[batch-import] Prepared ${newCompanies.length} new companies for import`)
                    console.log(`[batch-import] Skipped ${skippedCompanies.length} companies`)
                    if (skippedCompanies.length > 0) {
                        console.log(`[batch-import] Skip reasons:`, skippedCompanies.slice(0, 5))
                    }

                    // Save companies first (without metadata)
                    const allCompanies = [...trustedCompanies, ...newCompanies]
                    console.log(`[batch-import] Total companies to save: ${allCompanies.length} (${trustedCompanies.length} existing + ${newCompanies.length} new)`)
                    console.log(`[batch-import] Calling saveAllCompanies...`)
                    const saved = await saveAllCompanies(allCompanies)
                    console.log(`[batch-import] saveAllCompanies returned: ${saved}`)

                    if (!saved) {
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to save companies to database'
                        })
                    }

                    console.log(`[batch-import] Saved ${newCompanies.length} companies to database`)

                    // Skip metadata crawling during batch import to avoid timeout
                    // Users can use the "Auto Crawl" feature later to fetch metadata
                    console.log(`[batch-import] Skipping metadata crawl to avoid timeout. Use Auto Crawl feature later.`)

                    return res.status(200).json({
                        success: true,
                        message: `Successfully imported ${newCompanies.length} companies`,
                        imported: newCompanies.length,
                        skipped: skippedCompanies.length,
                        crawled: crawledCount,
                        failedCrawls: failedCrawls.length,
                        details: {
                            skippedCompanies: skippedCompanies.slice(0, 10),
                            failedCrawls: failedCrawls.slice(0, 10)
                        }
                    })
                } catch (error) {
                    console.error('[batch-import] Error:', error)
                    return res.status(500).json({
                        success: false,
                        error: error.message || 'Internal server error'
                    })
                }
            }

            // Batch Export to Excel Action
            if (action === 'batch-export') {
                try {
                    const xlsxModule = await import('xlsx')
                    const XLSX = xlsxModule.default || xlsxModule

                    // Get all companies
                    const companies = await getAllCompanies()

                    // Prepare data for Excel
                    const excelData = companies.map(company => ({
                        '企业名称': company.name,
                        '官网链接': company.website,
                        '招聘页链接': company.careersPage,
                        'LinkedIn': company.linkedin,
                        '行业': company.industry,
                        '标签': company.tags ? company.tags.join(', ') : '',
                        '描述': company.description ? company.description.substring(0, 32700) : '', // Truncate to avoid Excel cell limit
                        '地址': company.address,
                        'Logo链接': company.logo,
                        '封面图链接': company.coverImage,
                        '是否可信': company.isTrusted ? '是' : '否',
                        '可内推': company.canRefer ? '是' : '否',
                        '创建时间': company.createdAt ? new Date(company.createdAt).toLocaleString('zh-CN') : '',
                        '更新时间': company.updatedAt ? new Date(company.updatedAt).toLocaleString('zh-CN') : ''
                    }))

                    // Create workbook and worksheet
                    const workbook = XLSX.utils.book_new()
                    const worksheet = XLSX.utils.json_to_sheet(excelData)

                    // Set column widths for better readability
                    const colWidths = [
                        { wch: 25 }, // 企业名称
                        { wch: 30 }, // 官网链接
                        { wch: 30 }, // 招聘页链接
                        { wch: 30 }, // LinkedIn
                        { wch: 15 }, // 行业
                        { wch: 20 }, // 标签
                        { wch: 40 }, // 描述
                        { wch: 25 }, // 地址
                        { wch: 30 }, // Logo链接
                        { wch: 30 }, // 封面图链接
                        { wch: 10 }, // 是否可信
                        { wch: 10 }, // 可内推
                        { wch: 20 }, // 创建时间
                        { wch: 20 }  // 更新时间
                    ]
                    worksheet['!cols'] = colWidths

                    XLSX.utils.book_append_sheet(workbook, worksheet, '企业列表')

                    // Generate Excel buffer
                    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
                    const base64Data = excelBuffer.toString('base64')

                    console.log(`[batch-export] Exported ${companies.length} companies to Excel`)

                    return res.status(200).json({
                        success: true,
                        message: `成功导出 ${companies.length} 个企业数据`,
                        count: companies.length,
                        fileData: base64Data,
                        fileName: `企业库_${new Date().toISOString().split('T')[0]}.xlsx`
                    })
                } catch (error) {
                    console.error('[batch-export] Error:', error)
                    return res.status(500).json({
                        success: false,
                        error: error.message || '导出失败'
                    })
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
                    if (crawledCompany) {
                        let updated = false
                        const allCompanies = await getAllCompanies()
                        const idx = allCompanies.findIndex(c => c.id === company.id)

                        if (idx !== -1) {
                            if (crawledCompany.logo && !allCompanies[idx].logo) {
                                console.log(`[trusted-companies] Updating company logo from crawler: ${crawledCompany.logo}`)
                                allCompanies[idx].logo = crawledCompany.logo
                                company.logo = crawledCompany.logo
                                updated = true
                            }
                            if (crawledCompany.address && !allCompanies[idx].address) {
                                console.log(`[trusted-companies] Updating company address from crawler: ${crawledCompany.address}`)
                                allCompanies[idx].address = crawledCompany.address
                                company.address = crawledCompany.address
                                updated = true
                            }

                            if (updated) {
                                await saveAllCompanies(allCompanies)
                            }
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

                    // Read existing jobs from database
                    let existingJobs = []
                    if (NEON_CONFIGURED) {
                        const result = await neonHelper.query('SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC', ['active'])
                        if (result && result.length > 0) {
                            existingJobs = result.map(row => ({
                                id: row.job_id,
                                title: row.title,
                                company: row.company,
                                companyId: row.company_id,
                                companyLogo: null,
                                companyWebsite: null,
                                companyDescription: null,
                                companyIndustry: null,
                                companyTags: [],
                                location: row.location,
                                description: row.description,
                                url: row.url,
                                source: row.source,
                                tags: row.tags || [],
                                salary: row.salary,
                                remote: row.is_remote,
                                createdAt: row.created_at,
                                updatedAt: row.updated_at
                            }))
                        }
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

                    // Save back to database
                    if (NEON_CONFIGURED) {
                        await neonHelper.transaction(async (client) => {
                            // Delete existing jobs for this company
                            await client.query('DELETE FROM jobs WHERE company_id = $1', [company.id])

                            // Insert new jobs
                            for (const job of allJobs) {
                                await client.query(`
                                    INSERT INTO jobs 
                                    (job_id, title, company, company_id, location, description, url, 
                                     source, tags, salary, is_remote, status, created_at, updated_at)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                                `, [
                                    job.id,
                                    job.title,
                                    job.company,
                                    job.companyId,
                                    job.location,
                                    job.description,
                                    job.url,
                                    job.source || 'crawled',
                                    JSON.stringify(job.tags || []),
                                    job.salary,
                                    job.remote || false,
                                    'active',
                                    job.createdAt || new Date().toISOString(),
                                    job.updatedAt || new Date().toISOString()
                                ])
                            }
                        })
                    }



                    return res.status(200).json({ success: true, count: enrichedJobs.length, jobs: enrichedJobs })

                } catch (error) {
                    console.error('[trusted-companies] Job crawl error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            const { id, name, website, careersPage, linkedin, description, logo, coverImage, tags, industry, canRefer } = body

            if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

            let companies = await getAllCompanies()
            const now = new Date().toISOString()

            if (id) {
                // Update
                const index = companies.findIndex(c => c.id === id)
                if (index === -1) return res.status(404).json({ success: false, error: 'Company not found' })

                companies[index] = {
                    ...companies[index],
                    name, website, careersPage, linkedin, description, logo, coverImage, tags, industry,
                    canRefer: !!canRefer,
                    updatedAt: now
                }
            } else {
                // Create
                const newCompany = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name, website, careersPage, linkedin, description, logo, coverImage, tags, industry,
                    createdAt: now,
                    updatedAt: now,
                    isTrusted: true,
                    canRefer: !!canRefer
                }
                companies.push(newCompany)
            }

            const success = await saveAllCompanies(companies)
            if (!success) {
                return res.status(500).json({ success: false, error: 'Failed to save company data to persistent storage' })
            }
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

            const success = await saveAllCompanies(companies)
            if (!success) {
                return res.status(500).json({ success: false, error: 'Failed to save company deletion to persistent storage' })
            }

            // Also delete associated jobs
            try {
                console.log(`[trusted-companies] Attempting to delete jobs for company ID: ${id}`)

                if (NEON_CONFIGURED) {
                    await neonHelper.transaction(async (client) => {
                        // Delete jobs by company_id
                        const resultId = await client.query('DELETE FROM jobs WHERE company_id = $1', [id])
                        console.log(`[trusted-companies] Deleted ${resultId.rowCount || 0} jobs by company_id`)

                        // Also delete by name if available (for jobs that might not be linked by ID yet)
                        if (companyToDelete && companyToDelete.name) {
                            const resultName = await client.query(
                                'DELETE FROM jobs WHERE company = $1 AND (company_id IS NULL OR company_id != $2)',
                                [companyToDelete.name, id]
                            )
                            console.log(`[trusted-companies] Deleted ${resultName.rowCount || 0} jobs by company name`)
                        }
                    })
                }

                console.log(`[trusted-companies] ✅ Deleted associated jobs`)
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
