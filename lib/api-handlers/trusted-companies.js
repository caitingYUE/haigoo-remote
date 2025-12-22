import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import * as cheerio from 'cheerio'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { translateText } from '../services/translation-service.cjs'
import { writeJobsToNeon } from './processed-jobs.js'

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
                    careersPage: row.careers_page,
                    linkedin: row.linkedin,
                    description: row.description,
                    logo: row.logo,
                    coverImage: row.cover_image,
                    industry: row.industry,
                    tags: row.tags || [],
                    source: row.source,
                    jobCount: row.job_count || 0,
                    canRefer: row.can_refer || false,
                    lastCrawledAt: row.last_crawled_at,
                    translations: row.translations,
                    address: row.address,
                    employeeCount: row.employee_count,
                    foundedYear: row.founded_year,
                    specialties: row.specialties || [],
                    aliases: row.aliases || [],
                    companyRating: row.company_rating,
                    ratingSource: row.rating_source,
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

export async function getCompaniesPaginated({ page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'desc', industry, search, canRefer, isTrusted }) {
    try {
        if (NEON_CONFIGURED) {
            const offset = (page - 1) * limit
            let query = 'SELECT * FROM trusted_companies'
            let countQuery = 'SELECT COUNT(*) FROM trusted_companies'
            const params = []
            const conditions = []
            let paramIndex = 1

            if (industry && industry !== 'all') {
                conditions.push(`industry = $${paramIndex}`)
                params.push(industry)
                paramIndex++
            }

            if (search) {
                // Fix: Parameter placeholder index was missing $ sign for the first condition
                conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`)
                params.push(`%${search}%`)
                paramIndex++
            }
            
            if (canRefer && canRefer !== 'all') {
                conditions.push(`can_refer = $${paramIndex}`)
                params.push(canRefer === 'yes')
                paramIndex++
            }

            // Filter for Trusted Companies (source != 'extracted')
            if (isTrusted === 'yes' || isTrusted === true) {
                conditions.push(`source != 'extracted'`)
            } else if (isTrusted === 'no' || isTrusted === false) {
                conditions.push(`source = 'extracted'`)
            }

            if (conditions.length > 0) {
                const whereClause = ' WHERE ' + conditions.join(' AND ')
                query += whereClause
                countQuery += whereClause
            }

            // Safe sort columns
            const allowedSorts = {
                'jobCount': 'job_count',
                'updatedAt': 'updated_at',
                'createdAt': 'created_at',
                'name': 'name',
                'lastCrawledAt': 'last_crawled_at'
            }
            const sortColumn = allowedSorts[sortBy] || 'updated_at'
            const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

            query += ` ORDER BY ${sortColumn} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
            
            // Execute count query first
            const countResult = await neonHelper.query(countQuery, params)
            const total = parseInt(countResult[0]?.count || 0)

            // Execute data query
            params.push(limit, offset)
            const result = await neonHelper.query(query, params)
            
            const companies = result ? result.map(row => ({
                id: row.company_id,
                name: row.name,
                website: row.website,
                careersPage: row.careers_page,
                linkedin: row.linkedin,
                description: row.description,
                logo: row.logo,
                coverImage: row.cover_image,
                address: row.address,
                employeeCount: row.employee_count,
                foundedYear: row.founded_year,
                specialties: row.specialties || [],
                companyRating: row.company_rating,
                ratingSource: row.rating_source,
                industry: row.industry,
                tags: row.tags || [],
                source: row.source,
                jobCount: row.job_count || 0,
                canRefer: row.can_refer || false,
                lastCrawledAt: row.last_crawled_at,
                translations: row.translations,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            })) : []

            return {
                companies,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit)
            }
        }
    } catch (e) {
        console.error('[trusted-companies] Paginated read error:', e)
    }
    return { companies: [], total: 0, page: 1, totalPages: 0 }
}

// 获取带职位统计信息的公司列表（后端联表查询）
export async function getCompaniesWithJobStats({ page = 1, limit = 20, sortBy = 'job_count', sortOrder = 'desc', industry, search, canRefer, region }) {
    try {
        if (NEON_CONFIGURED) {
            const offset = (page - 1) * limit
            
            // 构建主查询：联表查询 trusted_companies 和 jobs
            let query = `
                SELECT 
                    tc.*,
                    jsonb_agg(DISTINCT jsonb_build_object(
                        'category', j.category,
                        'title', j.title
                    )) FILTER (WHERE j.job_id IS NOT NULL) as job_samples
                FROM trusted_companies tc
                LEFT JOIN jobs j ON tc.company_id = j.company_id 
            `
            
            let countQuery = `
                SELECT COUNT(DISTINCT tc.company_id) as count
                FROM trusted_companies tc
                LEFT JOIN jobs j ON tc.company_id = j.company_id
            `
            const params = []
            const conditions = []
            let paramIndex = 1

            // 添加筛选条件
            if (industry && industry !== 'all') {
                conditions.push(`tc.industry = $${paramIndex}`)
                params.push(industry)
                paramIndex++
            }

            if (search) {
                conditions.push(`(tc.name ILIKE $${paramIndex} OR tc.description ILIKE $${paramIndex} OR j.title ILIKE $${paramIndex})`)
                params.push(`%${search}%`)
                paramIndex++
            }
            
            if (canRefer && canRefer !== 'all') {
                conditions.push(`tc.can_refer = $${paramIndex}`)
                params.push(canRefer === 'yes')
                paramIndex++
            }

            if (region) {
                conditions.push(`tc.address ILIKE $${paramIndex}`)
                params.push(`%${region}%`)
                paramIndex++
            }

            if (conditions.length > 0) {
                const whereClause = ' WHERE ' + conditions.join(' AND ')
                query += whereClause
                countQuery += whereClause
            }

            // 按公司分组
            query += ' GROUP BY tc.company_id, tc.id'

            // 安全排序字段
            const allowedSorts = {
                'jobCount': 'tc.job_count',
                'updatedAt': 'tc.updated_at',
                'createdAt': 'tc.created_at',
                'name': 'tc.name',
                'lastCrawledAt': 'tc.last_crawled_at'
            }
            const sortColumn = allowedSorts[sortBy] || 'tc.job_count'
            const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

            query += ` ORDER BY ${sortColumn} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
            
            // 执行计数查询
            const countResult = await neonHelper.query(countQuery, params)
            const total = parseInt(countResult?.[0]?.count || '0')
            
            
            // 执行数据查询
            params.push(limit, offset)
            const result = await neonHelper.query(query, params)

            console.log(`[trusted-companies, getCompaniesWithJobStats] countQuery = ${countQuery}, total = ${total}, query = ${query}, result.length = ${result?.length}`)
            
            const companies = result ? result.map(row => {
                // 处理职位样本数据
                const jobSamples = row.job_samples || []
                const categories = {}
                jobSamples.forEach(job => {
                    if (job.category) {
                        categories[job.category] = (categories[job.category] || 0) + 1
                    }
                })

                return {
                    id: row.company_id,
                    name: row.name,
                    website: row.website,
                    careersPage: row.careers_page,
                    linkedin: row.linkedin,
                    description: row.description,
                    logo: row.logo,
                    coverImage: row.cover_image,
                    address: row.address,
                    employeeCount: row.employee_count,
                    foundedYear: row.founded_year,
                    specialties: row.specialties || [],
                    companyRating: row.company_rating,
                    ratingSource: row.rating_source,
                    industry: row.industry,
                    tags: row.tags || [],
                    source: row.source,
                    jobCount: row.job_count || 0,
                    jobCategories: categories,
                    canRefer: row.can_refer || false,
                    lastCrawledAt: row.last_crawled_at,
                    translations: row.translations,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }
            }) : []

            return {
                companies,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit)
            }
        }
    } catch (e) {
        console.error('[trusted-companies] Companies with job stats read error:', e)
    }
    return { companies: [], total: 0, page: 1, totalPages: 0 }
}

export async function saveAllCompanies(companies, mode = 'upsert') {
    if (!NEON_CONFIGURED) {
        console.error('[trusted-companies] Neon database not configured')
        return false
    }

    // Use transaction to ensure data consistency
    await neonHelper.transaction(async (client) => {
        // Clear existing data ONLY if mode is replace
        if (mode === 'replace') {
            await client.query('DELETE FROM trusted_companies')
        }

        // Insert new companies
        for (const company of companies) {
            // Remove 'aliases' and 'rating_source' from insert if they don't exist in DDL (rating_source exists, aliases doesn't)
            // But rating_source was added in DDL: 139→ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS rating_source VARCHAR(100);
            // Aliases was removed.
            // Also need to check if 'culture', 'founder_intro' etc exist. DDL doesn't show them.
            // So we must remove them from update/insert.
            
            await client.query(`
                INSERT INTO trusted_companies 
                (company_id, name, website, careers_page, linkedin, description, logo, cover_image, industry, tags, source, job_count, can_refer, status, translations, created_at, updated_at, last_crawled_at, address, employee_count, founded_year, specialties, company_rating, rating_source)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                ON CONFLICT (company_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    website = EXCLUDED.website,
                    careers_page = EXCLUDED.careers_page,
                    linkedin = EXCLUDED.linkedin,
                    description = EXCLUDED.description,
                    logo = EXCLUDED.logo,
                    cover_image = EXCLUDED.cover_image,
                    industry = EXCLUDED.industry,
                    tags = EXCLUDED.tags,
                    source = EXCLUDED.source,
                    job_count = EXCLUDED.job_count,
                    can_refer = EXCLUDED.can_refer,
                    translations = EXCLUDED.translations,
                    updated_at = EXCLUDED.updated_at,
                    last_crawled_at = EXCLUDED.last_crawled_at,
                    address = EXCLUDED.address,
                    employee_count = EXCLUDED.employee_count,
                    founded_year = EXCLUDED.founded_year,
                    specialties = EXCLUDED.specialties,
                    company_rating = EXCLUDED.company_rating,
                    rating_source = EXCLUDED.rating_source
            `, [
                company.id,
                company.name,
                company.website || '',
                company.careersPage || '',
                company.linkedin || '',
                company.description || '',
                company.logo || '',
                company.coverImage || '',
                company.industry || '其他',
                JSON.stringify(company.tags || []),
                company.source || 'manual',
                company.jobCount || 0,
                company.canRefer || false,
                'active',
                JSON.stringify(company.translations || {}),
                company.createdAt || new Date().toISOString(),
                company.updatedAt || new Date().toISOString(),
                company.lastCrawledAt || null,
                company.address || null,
                company.employeeCount || null,
                company.foundedYear || null,
                JSON.stringify(company.specialties || []),
                company.companyRating || null,
                company.ratingSource || null
            ])
        }
    })
    console.log(`[trusted-companies] Saved ${companies.length} companies to Neon database (mode: ${mode})`)
    return true
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

    // Global Debug Log
    console.log(`[trusted-companies] Request Method: ${req.method}, Target: ${req.query.target}, Action: ${req.query.action}`)
    if (req.method === 'POST') {
        console.log('[trusted-companies] Request Body Summary:', {
            hasBody: !!req.body,
            id: req.body?.id,
            name: req.body?.name,
            isTrusted: req.body?.isTrusted
        })
    }

    try {
        // Security Check for Write Operations
        if (req.method === 'POST' || req.method === 'DELETE') {
            const token = extractToken(req)
            const payload = token ? verifyToken(token) : null
            const requester = payload?.userId ? await userHelper.getUserById(payload.userId) : null
            const isAdmin = !!(requester?.roles?.admin || requester?.email === 'caitlinyct@gmail.com')
            
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
            }
        }

        // --- Action Dispatcher ---
        const { action } = req.query

        // 1. Crawl Company Info (Merged from api/crawler/company-info.js)
        if (req.method === 'GET' && action === 'crawl') {
            const { url, translate } = req.query
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
                if (metadata.cultureImage) metadata.cultureImage = resolveUrl(metadata.cultureImage)
                if (metadata.icon) metadata.icon = resolveUrl(metadata.icon)

                // Translate description if requested
                let translations = null;
                if (translate === 'true' && metadata.description) {
                    try {
                        const translatedDesc = await translateText(metadata.description, 'zh', 'auto');
                        translations = {
                            description: translatedDesc,
                            updatedAt: new Date().toISOString()
                        };
                    } catch (e) {
                        console.warn('Translation failed during crawl:', e);
                    }
                }

                return res.status(200).json({
                    url: targetUrl,
                    logo: metadata.icon, // Prefer icon for logo
                    coverImage: metadata.coverImage, // New field
                    address: metadata.address, // New field
                    description: metadata.description,
                    translations: translations,
                    title: metadata.title,
                    culture: metadata.culture,
                    founder: metadata.founder,
                    cultureImage: metadata.cultureImage
                })
            } catch (error) {
                console.error('[trusted-companies] Crawl error:', error)
                return res.status(500).json({ error: 'Failed to crawl', details: error.message })
            }
        }

        // 2. Standard CRUD Operations
        if (req.method === 'GET') {
            const { target, action, page, limit, sortBy, sortOrder, industry, search, canRefer, isTrusted } = req.query
            console.log(`[trusted-companies] GET request. Target: ${target}, Action: ${action}`)

            // Default GET: Return all trusted companies if no target specified OR target is companies
            if ((!target && !req.query.action) || target === 'companies') {
                // If pagination params are present, use paginated fetch
                if (page || limit) {
                     const result = await getCompaniesPaginated({ 
                        page: page || 1, 
                        limit: limit || 20, 
                        sortBy, 
                        sortOrder, 
                        industry, 
                        search,
                        canRefer,
                        isTrusted
                    })
                    return res.status(200).json({ success: true, ...result })
                }

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

                // Get single company
                if (id) {
                    if (NEON_CONFIGURED) {
                        try {
                            const result = await neonHelper.query('SELECT * FROM trusted_companies WHERE company_id = $1', [id])
                            if (result && result.length > 0) {
                                const row = result[0]
                                const company = {
                                    id: row.company_id,
                                    name: row.name,
                                    website: row.website,
                                    careersPage: row.careers_page,
                                    linkedin: row.linkedin,
                                    description: row.description,
                                    logo: row.logo,
                                    coverImage: row.cover_image,
                                    address: row.address,
                                    employeeCount: row.employee_count,
                                    foundedYear: row.founded_year,
                                    specialties: row.specialties || [],
                                    companyRating: row.company_rating,
                                    ratingSource: row.rating_source,
                                    industry: row.industry,
                                    tags: row.tags || [],
                                    source: row.source,
                                    jobCount: row.job_count || 0,
                                    isTrusted: true,
                                    canRefer: row.can_refer || false,
                                    createdAt: row.created_at,
                                    updatedAt: row.updated_at,
                                    translations: row.translations
                                }
                                return res.status(200).json({ success: true, company })
                            }
                        } catch (e) {
                            console.error('[trusted-companies] Get single company error:', e)
                        }
                    }
                    return res.status(404).json({ success: false, error: 'Company not found' })
                }

                // List all companies with pagination (Strictly from trusted_companies)
                const page = parseInt(req.query.page) || 1
                const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 20
                const sortBy = req.query.sortBy || 'jobCount'
                const sortOrder = req.query.sortOrder || 'desc'
                const search = req.query.search || ''
                const industry = req.query.industry || ''
                const canRefer = req.query.canRefer || ''

                // Disable cache to ensure fresh data
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

                try {
                    const result = await getCompaniesPaginated({
                        page,
                        limit,
                        sortBy,
                        sortOrder,
                        industry,
                        search,
                        canRefer
                    })
                    
                    return res.status(200).json({
                        success: true,
                        ...result,
                        pageSize: limit // Include pageSize for compatibility
                    })
                } catch (e) {
                    console.error('[trusted-companies] Pagination error:', e)
                    return res.status(500).json({ success: false, error: 'Failed to fetch companies' })
                }
            }

            // Company listing (trusted companies - default behavior)
            const companies = await getAllCompanies()
            const { id } = req.query

            if (id) {
                const company = companies.find(c => String(c.id) === String(id))
                if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                return res.status(200).json({ success: true, company })
            }

            // New target: trusted_companies_with_jobs_info
            if (target === 'trusted_companies_with_jobs_info') {
                try {
                    const { page = 1, limit = 20, sortBy = 'job_count', sortOrder = 'desc', industry, search, canRefer, region } = req.query
                    const result = await getCompaniesWithJobStats({
                        page: parseInt(page),
                        limit: parseInt(limit),
                        sortBy,
                        sortOrder,
                        industry,
                        search,
                        canRefer,
                        region
                    })
                    return res.status(200).json(result)
                } catch (error) {
                    console.error('[trusted-companies] Error fetching companies with job stats:', error)
                    return res.status(500).json({ error: 'Failed to fetch companies with job information' })
                }
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
                console.log('[trusted-companies] Starting global job sync (SQL-based)...')
                try {
                    if (!NEON_CONFIGURED) {
                        throw new Error('Database not configured')
                    }

                    // 1. Update jobs table using SQL JOIN with trusted_companies
                    // This replaces the memory-heavy JS logic with efficient database operations
                    console.log('[trusted-companies] Updating jobs from trusted_companies...')
                    
                    const updateJobsResult = await neonHelper.query(`
                        UPDATE jobs j
                        SET 
                            is_trusted = true,
                            company_id = tc.company_id,
                            company_logo = tc.logo,
                            company_website = tc.website,
                            company_description = tc.description,
                            industry = tc.industry,
                            company_tags = tc.tags,
                            can_refer = tc.can_refer,
                            source_type = 'official', -- Linked to trusted_companies => Official Website Jobs
                            updated_at = NOW()
                        FROM trusted_companies tc
                        WHERE 
                            (j.company_id = tc.company_id OR LOWER(TRIM(j.company)) = LOWER(TRIM(tc.name)))
                            AND tc.status = 'active'
                            AND (
                                j.is_trusted IS DISTINCT FROM true OR
                                j.company_id IS DISTINCT FROM tc.company_id OR
                                j.company_logo IS DISTINCT FROM tc.logo OR
                                j.industry IS DISTINCT FROM tc.industry OR
                                j.can_refer IS DISTINCT FROM tc.can_refer OR
                                j.source_type IS DISTINCT FROM 'official'
                            )
                    `)
                    
                    const updatedCount = updateJobsResult?.rowCount || 0
                    console.log(`[trusted-companies] Synced ${updatedCount} jobs with company metadata`)

                    // 2. Update Job Counts in trusted_companies
                    console.log('[trusted-companies] Recalculating job counts...')
                    
                    // 2.1 Update counts for companies that have jobs
                    await neonHelper.query(`
                        UPDATE trusted_companies tc
                        SET job_count = sub.count, updated_at = NOW(), last_crawled_at = NOW()
                        FROM (
                            SELECT company_id, COUNT(*) as count 
                            FROM jobs 
                            WHERE status = 'active' AND company_id IS NOT NULL 
                            GROUP BY company_id
                        ) sub
                        WHERE tc.company_id = sub.company_id
                        AND tc.job_count IS DISTINCT FROM sub.count
                    `)
                    
                    // 2.2 Reset counts to 0 for companies with no active jobs
                    await neonHelper.query(`
                        UPDATE trusted_companies 
                        SET job_count = 0 
                        WHERE company_id NOT IN (
                            SELECT DISTINCT company_id 
                            FROM jobs 
                            WHERE status = 'active' AND company_id IS NOT NULL
                        )
                        AND job_count > 0
                    `)
                    
                    console.log('[trusted-companies] Job counts recalculated')

                    return res.status(200).json({
                        success: true,
                        message: `成功同步 ${updatedCount} 个岗位的数据，并重新计算了企业岗位数量`,
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
                // 1. Handle Trusted Companies (Authoritative)
                if (body.isTrusted) {
                    if (NEON_CONFIGURED) {
                        try {
                            // Generate ID if missing (for new companies)
                            const companyId = body.id || `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                            await neonHelper.transaction(async (client) => {
                                await client.query(`
                                    INSERT INTO trusted_companies 
                                    (company_id, name, website, careers_page, linkedin, description, logo, cover_image, industry, tags, source, job_count, can_refer, status, translations, updated_at, address, employee_count, founded_year, specialties, company_rating, rating_source)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                                    ON CONFLICT (company_id) DO UPDATE SET
                                        name = EXCLUDED.name,
                                        website = EXCLUDED.website,
                                        careers_page = EXCLUDED.careers_page,
                                        linkedin = EXCLUDED.linkedin,
                                        description = EXCLUDED.description,
                                        logo = EXCLUDED.logo,
                                        cover_image = EXCLUDED.cover_image,
                                        industry = EXCLUDED.industry,
                                        tags = EXCLUDED.tags,
                                        source = EXCLUDED.source,
                                        job_count = EXCLUDED.job_count,
                                        can_refer = EXCLUDED.can_refer,
                                        translations = EXCLUDED.translations,
                                        updated_at = EXCLUDED.updated_at,
                                        address = EXCLUDED.address,
                                        employee_count = EXCLUDED.employee_count,
                                        founded_year = EXCLUDED.founded_year,
                                        specialties = EXCLUDED.specialties,
                                        company_rating = EXCLUDED.company_rating,
                                        rating_source = EXCLUDED.rating_source
                                `, [
                                    companyId,
                                    body.name,
                                    body.url || body.website || '', // Map url to website
                                    body.careersPage || '',
                                    body.linkedin || '',
                                    body.description || '',
                                    body.logo || '',
                                    body.coverImage || '',
                                    body.industry || '其他',
                                    JSON.stringify(body.tags || []),
                                    body.source || 'manual',
                                    body.jobCount || 0,
                                    body.canRefer || false,
                                    'active',
                                    JSON.stringify(body.translations || {}),
                                    new Date().toISOString(),
                                    body.address || null,
                                    body.employeeCount || null,
                                    body.foundedYear || null,
                                    JSON.stringify(body.specialties || []),
                                    body.companyRating || null,
                                    body.ratingSource || null
                                ])
                            })
                            console.log(`[trusted-companies] Saved trusted company: ${body.name} (ID: ${companyId})`)
                            return res.status(200).json({ success: true, message: 'Trusted company saved' })
                        } catch (e) {
                            console.error('[trusted-companies] Failed to save trusted company:', e)
                            return res.status(500).json({ success: false, error: 'Failed to save trusted company: ' + e.message })
                        }
                    } else {
                        return res.status(500).json({ success: false, error: 'Database not configured' })
                    }
                }

                // 2. Handle Extracted Companies (Default/Fallback)
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
                            translations: row.translations,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at
                        }))
                    }
                }

                if (body.id) {
                    // Check if it's an update to a non-trusted company
                    const index = companiesArray.findIndex(c => c.id === body.id)
                    if (index !== -1) {
                        companiesArray[index] = {
                            ...companiesArray[index],
                            ...body,
                            updatedAt: new Date().toISOString()
                        }
                    } else if (!body.isTrusted) {
                        // Not found in extracted, and not marked trusted? Maybe new manual entry?
                        // Add to extracted
                        companiesArray.push({
                            ...body,
                            id: body.id,
                            updatedAt: new Date().toISOString(),
                            createdAt: new Date().toISOString()
                        })
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

                // Save companies to database (Extracted)
                if (NEON_CONFIGURED) {
                    await neonHelper.transaction(async (client) => {
                        // FIX: Use UPSERT instead of DELETE + INSERT to prevent data loss
                        // await client.query('DELETE FROM extracted_companies')

                        // Insert updated companies
                        for (const company of companiesArray) {
                            await client.query(`
                                INSERT INTO extracted_companies 
                                (company_id, name, url, description, logo, cover_image, industry, tags, source, job_count, translations, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                                ON CONFLICT (company_id) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    url = EXCLUDED.url,
                                    description = EXCLUDED.description,
                                    logo = EXCLUDED.logo,
                                    cover_image = EXCLUDED.cover_image,
                                    industry = EXCLUDED.industry,
                                    tags = EXCLUDED.tags,
                                    source = EXCLUDED.source,
                                    job_count = EXCLUDED.job_count,
                                    translations = EXCLUDED.translations,
                                    updated_at = EXCLUDED.updated_at
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
                                JSON.stringify(company.translations || {}),
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
                const company = companies.find(c => String(c.id) === String(id))
                if (!company) return res.status(404).json({ success: false, error: 'Company not found' })
                
                // Strict check: Must have careersPage
                if (!company.careersPage) {
                    // 如果未配置 careersPage，视为无岗位，清空现有数据
                    console.log(`[trusted-companies] Company ${company.name} has no careersPage, clearing jobs...`)
                    
                    if (NEON_CONFIGURED) {
                        try {
                            await neonHelper.transaction(async (client) => {
                                // 1. Delete existing jobs
                                await client.query('DELETE FROM jobs WHERE company_id = $1', [company.id])
                                if (company.name) {
                                    await client.query('DELETE FROM jobs WHERE company = $1 AND company_id IS NULL', [company.name])
                                }
                                
                                // 2. Update company status
                                await client.query(`
                                    UPDATE trusted_companies 
                                    SET job_count = 0, updated_at = NOW(), last_crawled_at = NOW()
                                    WHERE company_id = $1
                                `, [company.id])
                            })
                            return res.status(200).json({ 
                                success: true, 
                                count: 0, 
                                jobs: [], 
                                message: '未配置招聘链接，已清空该企业岗位数据' 
                            })
                        } catch (e) {
                            console.error('[trusted-companies] Failed to clear jobs:', e)
                            return res.status(500).json({ success: false, error: 'Failed to clear jobs' })
                        }
                    } else {
                        return res.status(200).json({ success: true, count: 0, jobs: [] })
                    }
                }

                try {
                    const { crawlCompanyJobs } = await import('../../lib/job-crawler.js')
                    const url = company.careersPage

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
                        canRefer: !!company.canRefer,
                        publishedAt: job.publishedAt || job.createdAt || new Date().toISOString()
                    }))

                    console.log(`[trusted-companies] Crawled ${enrichedJobs.length} jobs for ${company.name}`)

                    // Save back to database
                    if (NEON_CONFIGURED) {
                        await neonHelper.transaction(async (client) => {
                            // 1. Delete existing jobs for this company (by ID)
                            await client.query('DELETE FROM jobs WHERE company_id = $1 AND (source != \'manual\') AND (is_manually_edited IS NOT TRUE)', [company.id])
                            
                            // 2. Also delete by name if company_id is missing (cleanup old data)
                            if (company.name) {
                                await client.query('DELETE FROM jobs WHERE company = $1 AND company_id IS NULL AND (source != \'manual\') AND (is_manually_edited IS NOT TRUE)', [company.name])
                            }

                            // 3. Insert new jobs
                            await writeJobsToNeon(enrichedJobs, 'upsert', true)

                            // 4. UPDATE JOB COUNT IN TRUSTED COMPANIES TABLE
                            await client.query(`
                                UPDATE trusted_companies 
                                SET job_count = $1, updated_at = NOW(), last_crawled_at = NOW()
                                WHERE company_id = $2
                            `, [enrichedJobs.length, company.id])
                        })
                        
                        console.log(`[trusted-companies] Updated job_count to ${enrichedJobs.length} for company ${company.id}`)
                    }



                    return res.status(200).json({ success: true, count: enrichedJobs.length, jobs: enrichedJobs })

                } catch (error) {
                    console.error('[trusted-companies] Job crawl error:', error)
                    return res.status(500).json({ success: false, error: error.message })
                }
            }

            const { id, name, website, careersPage, linkedin, description, logo, coverImage, tags, industry, canRefer } = body

            if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

            if (!NEON_CONFIGURED) {
                return res.status(500).json({ success: false, error: 'Database not configured' })
            }

            const now = new Date().toISOString()
            let companyToSave

            if (id) {
                // Update: Fetch existing to preserve other fields
                const existingResult = await neonHelper.query('SELECT * FROM trusted_companies WHERE company_id = $1', [id])
                if (!existingResult || existingResult.length === 0) {
                    return res.status(404).json({ success: false, error: 'Company not found' })
                }
                const existing = existingResult[0]

                companyToSave = {
                    id,
                    name,
                    website: website !== undefined ? website : existing.website,
                    careersPage: careersPage !== undefined ? careersPage : existing.careers_page,
                    linkedin: linkedin !== undefined ? linkedin : existing.linkedin,
                    description: description !== undefined ? description : existing.description,
                    logo: logo !== undefined ? logo : existing.logo,
                    coverImage: coverImage !== undefined ? coverImage : existing.cover_image,
                    culture: body.culture !== undefined ? body.culture : existing.culture,
                    founderIntro: body.founderIntro !== undefined ? body.founderIntro : existing.founder_intro,
                    cultureImage: body.cultureImage !== undefined ? body.cultureImage : existing.culture_image,
                    showCultureOnHome: body.showCultureOnHome !== undefined ? body.showCultureOnHome : existing.show_culture_on_home,
                    industry: industry !== undefined ? industry : existing.industry,
                    tags: tags !== undefined ? tags : existing.tags,
                    canRefer: canRefer !== undefined ? !!canRefer : existing.can_refer,
                    address: body.address !== undefined ? body.address : existing.address,
                    employeeCount: body.employeeCount !== undefined ? body.employeeCount : existing.employee_count,
                    foundedYear: body.foundedYear !== undefined ? body.foundedYear : existing.founded_year,
                    specialties: body.specialties !== undefined ? body.specialties : existing.specialties,
                    companyRating: body.companyRating !== undefined ? body.companyRating : existing.company_rating,
                    ratingSource: body.ratingSource !== undefined ? body.ratingSource : existing.rating_source,

                    // Preserve system fields
                    isTrusted: true,
                    source: existing.source,
                    jobCount: existing.job_count,
                    createdAt: existing.created_at,
                    updatedAt: now
                }
            } else {
                // Create
                companyToSave = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    name, website, careersPage, linkedin, description, logo, coverImage, tags, industry,
                    culture: body.culture,
                    founderIntro: body.founderIntro,
                    cultureImage: body.cultureImage,
                    showCultureOnHome: body.showCultureOnHome || false,
                    canRefer: !!canRefer,
                    createdAt: now,
                    updatedAt: now,
                    isTrusted: true,
                    source: 'manual',
                    jobCount: 0
                }
            }

            try {
                await saveAllCompanies([companyToSave], companyToSave.id ? 'upsert' : 'insert')
                return res.status(200).json({ success: true, message: 'Saved successfully' })
            } catch (e) {
                console.error('[trusted-companies] Save failed:', e)
                return res.status(500).json({ success: false, error: e.message || 'Failed to save company data' })
            }
        }

        // DELETE
        if (req.method === 'DELETE') {
            const { id } = req.query
            if (!id) return res.status(400).json({ success: false, error: 'ID is required' })

            if (!NEON_CONFIGURED) {
                return res.status(500).json({ success: false, error: 'Database not configured' })
            }

            try {
                console.log(`[trusted-companies] Deleting company ID: ${id}`)

                // Get company name first for job deletion
                const companyResult = await neonHelper.query('SELECT name FROM trusted_companies WHERE company_id = $1', [id])
                const companyName = companyResult && companyResult.length > 0 ? companyResult[0].name : null

                await neonHelper.transaction(async (client) => {
                    // 1. Delete from trusted_companies
                    const deleteResult = await client.query('DELETE FROM trusted_companies WHERE company_id = $1', [id])
                    if (deleteResult.rowCount === 0) {
                        // Try to delete from extracted_companies as fallback if not found in trusted
                        await client.query('DELETE FROM extracted_companies WHERE company_id = $1', [id])
                    }

                    // 2. Delete associated jobs
                    console.log(`[trusted-companies] Deleting jobs for company ID: ${id}`)
                    // Delete jobs by company_id
                    await client.query('DELETE FROM jobs WHERE company_id = $1', [id])

                    // Also delete by name if available
                    if (companyName) {
                        await client.query(
                            'DELETE FROM jobs WHERE company = $1 AND (company_id IS NULL OR company_id != $2)',
                            [companyName, id]
                        )
                    }
                })

                return res.status(200).json({ success: true, message: 'Deleted successfully' })
            } catch (error) {
                console.error('[trusted-companies] Delete failed:', error)
                return res.status(500).json({ success: false, error: 'Delete failed: ' + error.message })
            }
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' })
    } catch (error) {
        console.error('[trusted-companies] Error:', error)
        return res.status(500).json({ success: false, error: 'Server error' })
    }
}
