import * as XLSX from 'xlsx'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import existing functions from trusted-companies handler
import { getAllCompanies, saveAllCompanies } from '../lib/api-handlers/trusted-companies.js'

// Helper function to normalize industry names
function normalizeIndustry(industry) {
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

    return '互联网/软件' // Default
}

// Helper function to extract tags from company data
function extractTags(company) {
    const tags = []

    // Check if remote-first
    if (company['Where You Can Work']?.toLowerCase().includes('worldwide')) {
        tags.push('远程优先')
        tags.push('全球招聘')
    }

    // Check employee growth
    if (company['Employee Growth']) {
        const growth = company['Employee Growth']
        if (growth.includes('growth') || growth.includes('YoY')) {
            // Growing company
        }
    }

    // Check reviews/ratings
    if (company['Reviews']) {
        const rating = parseFloat(company['Reviews'])
        if (rating >= 4.0) {
            // High rated company
        }
    }

    return tags
}

// Helper function to crawl company metadata
async function crawlCompanyMetadata(url) {
    try {
        if (!url || !url.startsWith('http')) {
            return null
        }

        console.log(`[batch-import] Crawling metadata for: ${url}`)

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 10000
        })

        if (!response.ok) {
            console.warn(`[batch-import] Failed to fetch ${url}: ${response.status}`)
            return null
        }

        const html = await response.text()

        // Simple metadata extraction (reuse logic from trusted-companies.js)
        const titleMatch = html.match(/<title>(.*?)<\/title>/i)
        const ogImageMatch = html.match(/<meta property="og:image" content="(.*?)"/i)
        const iconMatch = html.match(/<link rel="(?:icon|shortcut icon)" href="(.*?)"/i)

        const baseUrl = new URL(url)
        const resolveUrl = (u) => {
            if (!u) return ''
            if (u.startsWith('http')) return u
            if (u.startsWith('//')) return `https:${u}`
            if (u.startsWith('/')) return `${baseUrl.origin}${u}`
            return `${baseUrl.origin}/${u}`
        }

        return {
            title: titleMatch ? titleMatch[1] : '',
            logo: iconMatch ? resolveUrl(iconMatch[1]) : '',
            coverImage: ogImageMatch ? resolveUrl(ogImageMatch[1]) : ''
        }
    } catch (error) {
        console.error(`[batch-import] Crawl error for ${url}:`, error.message)
        return null
    }
}

// Delay helper to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }

    try {
        // Verify authentication
        const token = extractToken(req)
        const payload = verifyToken(token)
        if (!payload) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        const { action, filePath, crawlMetadata = true } = req.body

        if (action === 'import-from-file') {
            // Import from the Excel file
            const excelPath = filePath || join(__dirname, '../docs/The Remote companies.xlsx')

            console.log(`[batch-import] Reading Excel file: ${excelPath}`)

            // Read and parse Excel file
            const fileBuffer = readFileSync(excelPath)
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const excelData = XLSX.utils.sheet_to_json(worksheet)

            console.log(`[batch-import] Found ${excelData.length} companies in Excel`)

            // Get existing companies to avoid duplicates
            const existingCompanies = await getAllCompanies()
            const existingNames = new Set(existingCompanies.map(c => c.name.toLowerCase()))
            const existingWebsites = new Set(existingCompanies.map(c => c.website?.toLowerCase()).filter(Boolean))

            // Transform Excel data to TrustedCompany format
            const newCompanies = []
            const skippedCompanies = []

            for (const row of excelData) {
                const companyName = row['Company']
                const website = row['Site']

                if (!companyName || !website) {
                    console.warn(`[batch-import] Skipping row with missing name or website:`, row)
                    skippedCompanies.push({ name: companyName, reason: 'Missing required fields' })
                    continue
                }

                // Check for duplicates
                if (existingNames.has(companyName.toLowerCase()) || existingWebsites.has(website.toLowerCase())) {
                    console.log(`[batch-import] Skipping duplicate: ${companyName}`)
                    skippedCompanies.push({ name: companyName, reason: 'Duplicate' })
                    continue
                }

                const company = {
                    id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: companyName,
                    website: website,
                    careersPage: row['Career Page'] || website,
                    description: row['Description'] || '',
                    industry: normalizeIndustry(row['Industry']),
                    tags: extractTags(row),
                    isTrusted: true,
                    canRefer: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    // Store additional metadata
                    _rawData: {
                        whereYouCanWork: row['Where You Can Work'],
                        employeeGrowth: row['Employee Growth'],
                        reviews: row['Reviews']
                    }
                }

                newCompanies.push(company)
            }

            console.log(`[batch-import] Prepared ${newCompanies.length} new companies for import`)

            // Save companies first (without metadata)
            const allCompanies = [...existingCompanies, ...newCompanies]
            const saved = await saveAllCompanies(allCompanies)

            if (!saved) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save companies to database'
                })
            }

            console.log(`[batch-import] Saved ${newCompanies.length} companies to database`)

            // Crawl metadata if requested
            let crawledCount = 0
            let failedCrawls = []

            if (crawlMetadata && newCompanies.length > 0) {
                console.log(`[batch-import] Starting metadata crawl for ${newCompanies.length} companies...`)

                for (let i = 0; i < newCompanies.length; i++) {
                    const company = newCompanies[i]

                    try {
                        const metadata = await crawlCompanyMetadata(company.website)

                        if (metadata) {
                            company.logo = metadata.logo || company.logo
                            company.coverImage = metadata.coverImage || company.coverImage
                            crawledCount++
                            console.log(`[batch-import] Crawled ${i + 1}/${newCompanies.length}: ${company.name}`)
                        } else {
                            failedCrawls.push(company.name)
                        }

                        // Add delay to avoid rate limiting (500ms between requests)
                        if (i < newCompanies.length - 1) {
                            await delay(500)
                        }
                    } catch (error) {
                        console.error(`[batch-import] Failed to crawl ${company.name}:`, error.message)
                        failedCrawls.push(company.name)
                    }
                }

                // Save updated companies with metadata
                const updatedAllCompanies = [...existingCompanies, ...newCompanies]
                await saveAllCompanies(updatedAllCompanies)

                console.log(`[batch-import] Crawled metadata for ${crawledCount}/${newCompanies.length} companies`)
            }

            return res.status(200).json({
                success: true,
                message: `Successfully imported ${newCompanies.length} companies`,
                imported: newCompanies.length,
                skipped: skippedCompanies.length,
                crawled: crawledCount,
                failedCrawls: failedCrawls.length,
                details: {
                    skippedCompanies: skippedCompanies.slice(0, 10), // First 10
                    failedCrawls: failedCrawls.slice(0, 10) // First 10
                }
            })
        }

        return res.status(400).json({ success: false, error: 'Invalid action' })

    } catch (error) {
        console.error('[batch-import] Error:', error)
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        })
    }
}
