import * as cheerio from 'cheerio'

/**
 * Ashby Job Board Parser
 * Extracts job listings from Ashby-hosted career pages (e.g., jobs.ashbyhq.com)
 */

// Helper to clean text
const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : ''

// Helper to clean multiline text (preserve newlines for descriptions)
const cleanMultilineText = (text) => {
    if (!text) return ''
    return text
        .replace(/[ \t\f\v]+/g, ' ') // Collapse horizontal whitespace
        .replace(/(\n\s*){2,}/g, '\n\n') // Normalize paragraphs
        .trim()
}

// Helper to extract description from HTML string
const extractDescription = (content) => {
    if (!content) return ''

    // If content doesn't look like HTML, just clean it
    if (!/<[a-z][\s\S]*>/i.test(content)) {
        return cleanMultilineText(content)
    }

    try {
        const $ = cheerio.load(content, null, false)

        // Pre-processing
        $('script, style, noscript, svg').remove()
        $('br').replaceWith('\n')
        $('p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article').after('\n')
        $('li').prepend('• ')

        return cleanMultilineText($.text())
    } catch (e) {
        return cleanMultilineText(content)
    }
}

/**
 * Extract window.__appData from HTML
 */
function extractAppData(html) {
    try {
        // Match window.__appData = {...};
        const appDataMatch = html.match(/window\.__appData\s*=\s*({[^;]+});/)
        if (appDataMatch && appDataMatch[1]) {
            return JSON.parse(appDataMatch[1])
        }
    } catch (error) {
        console.error('[ashby-parser] Failed to parse __appData:', error.message)
    }
    return null
}

/**
 * Fetch job description via Ashby GraphQL API
 * @param {string} organizationName - e.g., 'kraken.com'
 * @param {string} jobPostingId - The job UUID
 * @returns {Promise<string|null>} - The description HTML or null
 */
export async function fetchAshbyJobDescription(organizationName, jobPostingId) {
    try {
        console.log(`[ashby-parser] Fetching description for org=${organizationName}, job=${jobPostingId}`)
        const response = await fetch('https://jobs.ashbyhq.com/api/non-user-graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                operationName: 'apiJobPosting',
                variables: {
                    organizationHostedJobsPageName: organizationName,
                    jobPostingId: jobPostingId
                },
                query: `query apiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
                    jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
                        id
                        title
                        descriptionHtml
                        locationName
                        workplaceType
                        employmentType
                        departmentName
                    }
                }`
            })
        })

        console.log(`[ashby-parser] Response status: ${response.status}`)
        if (!response.ok) {
            console.log(`[ashby-parser] GraphQL request failed: ${response.status}`)
            return null
        }

        const data = await response.json()
        // Log any errors in the response
        if (data.errors) {
            console.log(`[ashby-parser] GraphQL errors:`, JSON.stringify(data.errors))
        }
        // Log the structure of the response
        console.log(`[ashby-parser] Response has data:`, !!data.data, 'has jobPosting:', !!data?.data?.jobPosting)

        const descHtml = data?.data?.jobPosting?.descriptionHtml
        console.log(`[ashby-parser] Got description: ${descHtml ? descHtml.length + ' chars' : 'null'}`)
        return descHtml || null
    } catch (error) {
        console.error('[ashby-parser] Failed to fetch job description:', error.message, error.stack)
        return null
    }
}

/**
 * Map Ashby department to JobCategory
 */
function categorizeFromDepartment(department, team, title) {
    const text = `${department} ${team} ${title}`.toLowerCase()

    // 技术类
    if (text.includes('frontend') || text.includes('前端') || text.includes('react') || text.includes('vue')) {
        return '前端开发'
    }
    if (text.includes('backend') || text.includes('后端') || text.includes('api') || text.includes('server')) {
        return '后端开发'
    }
    if (text.includes('fullstack') || text.includes('full stack') || text.includes('全栈')) {
        return '全栈开发'
    }
    if (text.includes('mobile') || text.includes('ios') || text.includes('android') || text.includes('移动')) {
        return '移动开发'
    }
    if (text.includes('devops') || text.includes('infrastructure') || text.includes('cloud') || text.includes('sre')) {
        return 'DevOps'
    }
    if (text.includes('data') && (text.includes('scientist') || text.includes('science') || text.includes('科学'))) {
        return '数据科学'
    }
    if (text.includes('data') && (text.includes('analyst') || text.includes('analytics') || text.includes('分析'))) {
        return '数据分析'
    }
    if (text.includes('ai') || text.includes('machine learning') || text.includes('ml') || text.includes('人工智能')) {
        return '人工智能'
    }
    if (text.includes('qa') || text.includes('quality') || text.includes('test') || text.includes('质量')) {
        return '质量保证'
    }
    if (text.includes('security') || text.includes('安全')) {
        return '网络安全'
    }
    if (text.includes('engineer') || text.includes('developer') || text.includes('开发')) {
        return '软件开发'
    }

    // 设计类
    if (text.includes('design') || text.includes('设计')) {
        if (text.includes('ui') || text.includes('ux') || text.includes('product')) {
            return 'UI/UX设计'
        }
        if (text.includes('graphic') || text.includes('平面')) {
            return '平面设计'
        }
        return '产品设计'
    }

    // 产品/项目管理
    if (text.includes('product') && text.includes('manager')) {
        return '产品管理'
    }
    if (text.includes('project') && text.includes('manager')) {
        return '项目管理'
    }
    if (text.includes('business') && text.includes('analyst')) {
        return '商业分析'
    }

    // 市场营销
    if (text.includes('marketing') || text.includes('市场')) {
        return '市场营销'
    }
    if (text.includes('sales') || text.includes('销售')) {
        return '销售'
    }
    if (text.includes('content') || text.includes('writer') || text.includes('写作')) {
        return '内容写作'
    }

    // 客户服务
    if (text.includes('support') || text.includes('customer') || text.includes('客户')) {
        return '客户支持'
    }

    // 人力资源
    if (text.includes('hr') || text.includes('human resource') || text.includes('人力')) {
        return '人力资源'
    }
    if (text.includes('recruit') || text.includes('talent') || text.includes('招聘')) {
        return '招聘'
    }

    // 财务法律
    if (text.includes('finance') || text.includes('财务')) {
        return '财务'
    }
    if (text.includes('legal') || text.includes('法律')) {
        return '法律'
    }
    if (text.includes('account') || text.includes('会计')) {
        return '会计'
    }

    // 运营
    if (text.includes('operation') || text.includes('运营')) {
        return '运营'
    }
    if (text.includes('business development') || text.includes('商务')) {
        return '商务拓展'
    }
    if (text.includes('consult') || text.includes('咨询')) {
        return '咨询'
    }
    if (text.includes('education') || text.includes('training') || text.includes('教育')) {
        return '教育培训'
    }

    return '其他'
}

/**
 * Determine experience level from title
 */
function determineExperienceLevel(title) {
    const text = title.toLowerCase()

    if (text.includes('senior') || text.includes('sr.') || text.includes('lead') || text.includes('高级')) {
        return 'Senior'
    }
    if (text.includes('junior') || text.includes('jr.') || text.includes('entry') || text.includes('初级')) {
        return 'Entry'
    }
    if (text.includes('principal') || text.includes('staff') || text.includes('architect') || text.includes('资深')) {
        return 'Lead'
    }
    if (text.includes('director') || text.includes('vp') || text.includes('cto') || text.includes('ceo') || text.includes('总监')) {
        return 'Executive'
    }

    return 'Mid'
}

/**
 * Map Ashby employmentType to platform jobType
 */
function mapEmploymentType(employmentType) {
    if (!employmentType) return 'full-time'

    const type = employmentType.toLowerCase()
    if (type.includes('full') || type.includes('全职')) return 'full-time'
    if (type.includes('part') || type.includes('兼职')) return 'part-time'
    if (type.includes('contract') || type.includes('合同')) return 'contract'
    if (type.includes('freelance') || type.includes('自由')) return 'freelance'
    if (type.includes('intern') || type.includes('实习')) return 'internship'

    return 'full-time'
}

/**
 * Determine if job is remote based on location and workplace type
 */
function isRemoteJob(locationName, workplaceType) {
    const location = (locationName || '').toLowerCase()
    const workplace = (workplaceType || '').toLowerCase()

    return workplace.includes('remote') ||
        workplace.includes('远程') ||
        location.includes('remote') ||
        location.includes('anywhere') ||
        location.includes('worldwide')
}

/**
 * Extract tags from job data
 */
function extractTags(title, department, team, description = '') {
    const tags = []
    const text = `${title} ${department} ${team} ${description}`.toLowerCase()

    // Tech stack keywords
    const techKeywords = [
        'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'python', 'java',
        'go', 'golang', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'flutter', 'react native',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'jenkins',
        'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
        'ai', 'ml', 'machine learning', 'deep learning', 'nlp', 'computer vision'
    ]

    techKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
            tags.push(keyword)
        }
    })

    // Add department and team as tags if meaningful
    if (department && department.length > 2 && department.length < 30) {
        tags.push(department)
    }
    if (team && team.length > 2 && team.length < 30 && team !== department) {
        tags.push(team)
    }

    return [...new Set(tags)] // Remove duplicates
}

/**
 * Map Ashby job to standard platform format
 */
function mapAshbyJobToStandard(ashbyJob, baseUrl, companyId, descriptionHtml = null) {
    const title = ashbyJob.title || ''
    const department = ashbyJob.departmentName || ''
    const team = ashbyJob.teamName || ''
    const location = ashbyJob.locationName || 'Remote'
    const workplaceType = ashbyJob.workplaceType || ''
    const employmentType = ashbyJob.employmentType || 'Full-time'

    // Construct job URL
    const jobUrl = `${baseUrl}/${ashbyJob.id}`

    // Generate unique ID
    const jobId = `ashby_${companyId}_${ashbyJob.id}`

    // Determine category
    const category = categorizeFromDepartment(department, team, title)

    // Build location string
    const locationStr = workplaceType
        ? `${location} (${workplaceType})`
        : location

    // Extract description - prefer full HTML, fallback to metadata
    let description = `${employmentType} | ${workplaceType || 'Onsite'}`
    if (descriptionHtml) {
        description = extractDescription(descriptionHtml)
    }

    // Extract tags (include description in tag extraction if available)
    const tags = extractTags(title, department, team, descriptionHtml || '')

    return {
        id: jobId,
        title,
        location: locationStr,
        type: mapEmploymentType(employmentType),
        url: jobUrl,
        description,
        category,
        experienceLevel: determineExperienceLevel(title),
        isRemote: isRemoteJob(location, workplaceType),
        tags,
        sourceType: 'trusted',
        isTrusted: true,
        publishedAt: ashbyJob.publishedDate || new Date().toISOString(),
        // Additional Ashby-specific data
        ashbyData: {
            department,
            team,
            workplaceType,
            employmentType,
            originalLocation: location
        }
    }
}

/**
 * Extract company info from appData
 */
function extractCompanyInfo(appData) {
    if (!appData || !appData.organization) return null

    const org = appData.organization

    // Check theme for logos if standard logo fields are missing
    let logo = org.logoUrl || org.logo
    if (!logo && org.theme) {
        logo = org.theme.logoSquareImageUrl || org.theme.logoWordmarkImageUrl
    }

    // Try to find a better description
    let description = ''
    if (org.jobBoardTopDescriptionHtml) {
        description = extractDescription(org.jobBoardTopDescriptionHtml)
    } else if (org.jobBoardBottomDescriptionHtml) {
        description = extractDescription(org.jobBoardBottomDescriptionHtml)
    }

    // If description is just a privacy notice (common in Ashby), try to clean it or look elsewhere
    // But for now, we take what we can get. 
    // If the description is very short or looks like a privacy notice, we might want to flag it, 
    // but the crawler logic handles merging/updating.

    return {
        name: org.name,
        logo: logo,
        description: description,
        domain: org.domain
    }
}

/**
 * Parse Ashby jobs from HTML (basic version - no descriptions)
 */
export function parseAshbyJobs(html, baseUrl, companyId) {
    const result = {
        jobs: [],
        company: null
    }

    try {
        const appData = extractAppData(html)

        if (!appData) {
            console.log('[ashby-parser] No __appData found in HTML')
            return result
        }

        // Extract company info
        result.company = extractCompanyInfo(appData)

        const jobPostings = appData.jobBoard?.jobPostings || []

        if (jobPostings.length === 0) {
            console.log('[ashby-parser] No job postings found in __appData')
            return result
        }

        console.log(`[ashby-parser] Found ${jobPostings.length} job postings in __appData`)

        jobPostings.forEach(ashbyJob => {
            // Only include listed jobs
            if (ashbyJob.isListed) {
                const job = mapAshbyJobToStandard(ashbyJob, baseUrl, companyId)
                result.jobs.push(job)
            }
        })

        console.log(`[ashby-parser] Parsed ${result.jobs.length} listed jobs`)

    } catch (error) {
        console.error('[ashby-parser] Error parsing Ashby jobs:', error.message)
    }

    return result
}

/**
 * Parse Ashby jobs with full descriptions (async version)
 * Fetches job descriptions via GraphQL API
 * @param {string} html - The HTML content
 * @param {string} baseUrl - Base URL (e.g., https://jobs.ashbyhq.com/kraken.com)
 * @param {string} companyId - Company ID for job ID generation
 * @param {Object} options - Options
 * @param {number} options.maxJobs - Max number of jobs to fetch descriptions for (default: 50)
 * @param {number} options.delayMs - Delay between API calls in ms (default: 100)
 */
export async function parseAshbyJobsWithDescriptions(html, baseUrl, companyId, options = {}) {
    const { maxJobs = 50, delayMs = 100 } = options

    const result = {
        jobs: [],
        company: null
    }

    try {
        const appData = extractAppData(html)

        if (!appData) {
            console.log('[ashby-parser] No __appData found in HTML')
            return result
        }

        // Extract company info
        result.company = extractCompanyInfo(appData)

        const jobPostings = appData.jobBoard?.jobPostings || []
        const listedJobs = jobPostings.filter(job => job.isListed)

        if (listedJobs.length === 0) {
            console.log('[ashby-parser] No listed job postings found')
            return result
        }

        console.log(`[ashby-parser] Found ${listedJobs.length} listed jobs, fetching descriptions...`)

        // Extract organization name from baseUrl (e.g., kraken.com from https://jobs.ashbyhq.com/kraken.com)
        const orgName = baseUrl.split('/').pop()

        // Limit jobs to fetch
        const jobsToProcess = listedJobs.slice(0, maxJobs)

        // Fetch descriptions in parallel with batching
        const batchSize = 5
        for (let i = 0; i < jobsToProcess.length; i += batchSize) {
            const batch = jobsToProcess.slice(i, i + batchSize)

            const batchResults = await Promise.all(
                batch.map(async (ashbyJob) => {
                    const descriptionHtml = await fetchAshbyJobDescription(orgName, ashbyJob.id)
                    return mapAshbyJobToStandard(ashbyJob, baseUrl, companyId, descriptionHtml)
                })
            )

            result.jobs.push(...batchResults)

            // Rate limiting delay between batches
            if (i + batchSize < jobsToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs))
            }
        }

        console.log(`[ashby-parser] Parsed ${result.jobs.length} jobs with descriptions`)

    } catch (error) {
        console.error('[ashby-parser] Error parsing Ashby jobs with descriptions:', error.message)
    }

    return result
}

/**
 * Detect if URL is an Ashby job board
 */
export function isAshbyJobBoard(url) {
    return url.includes('ashbyhq.com') || url.includes('jobs.ashby')
}

