
import { JSDOM } from 'jsdom'

// Helper to clean text
const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : ''

// Heuristic Job Parser
async function parseJobsFromHtml(html, baseUrl) {
    const dom = new JSDOM(html)
    const doc = dom.window.document
    const jobs = []

    // Strategy 1: Schema.org JobPosting (High Confidence)
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
    scripts.forEach(script => {
        try {
            const json = JSON.parse(script.textContent)
            const items = Array.isArray(json) ? json : [json]

            items.forEach(item => {
                if (item['@type'] === 'JobPosting') {
                    jobs.push({
                        title: item.title,
                        location: item.jobLocation?.address?.addressLocality || item.jobLocation?.address?.addressRegion || 'Remote',
                        type: item.employmentType || 'Full-time',
                        url: item.url || baseUrl, // Sometimes URL is not in schema, use page URL or try to find it
                        description: item.description,
                        sourceType: 'trusted',
                        isTrusted: true
                    })
                }
            })
        } catch (e) {
            // Ignore parse errors
        }
    })

    if (jobs.length > 0) return jobs

    // Strategy 2: Common Job Board Patterns (Greenhouse, Lever, Ashby, Workable)
    // These usually have specific class names or structures

    // Greenhouse
    const greenhouseJobs = doc.querySelectorAll('.opening')
    if (greenhouseJobs.length > 0) {
        greenhouseJobs.forEach(el => {
            const link = el.querySelector('a')
            const location = el.querySelector('.location')
            if (link) {
                jobs.push({
                    title: cleanText(link.textContent),
                    url: link.href.startsWith('http') ? link.href : new URL(link.href, baseUrl).toString(),
                    location: cleanText(location?.textContent) || 'Remote',
                    type: 'Full-time', // Assumption
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })
        if (jobs.length > 0) return jobs
    }

    // Generic Fallback: Look for "Apply" links or list items with job-like keywords
    // This is risky and might produce noise, so we'll be conservative.
    // We'll look for <a> tags that contain "Engineer", "Developer", "Manager", "Designer" inside a list
    const potentialLinks = doc.querySelectorAll('a')
    const keywords = ['Engineer', 'Developer', 'Manager', 'Designer', 'Specialist', 'Analyst', 'Director', 'Head of']

    potentialLinks.forEach(link => {
        const text = cleanText(link.textContent)
        if (keywords.some(k => text.includes(k)) && text.length < 100) {
            // Check if it looks like a job title
            jobs.push({
                title: text,
                url: link.href.startsWith('http') ? link.href : new URL(link.href, baseUrl).toString(),
                location: 'Remote', // Default for this platform
                type: 'Full-time',
                sourceType: 'trusted',
                isTrusted: true
            })
        }
    })

    // Deduplicate by URL
    const uniqueJobs = []
    const seenUrls = new Set()
    jobs.forEach(job => {
        if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url)
            uniqueJobs.push(job)
        }
    })

    return uniqueJobs
}

export async function crawlCompanyJobs(companyId, careersUrl) {
    if (!careersUrl) throw new Error('No careers URL provided')

    console.log(`[JobCrawler] Crawling ${careersUrl} for company ${companyId}`)

    try {
        const response = await fetch(careersUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        if (!response.ok) throw new Error(`Failed to fetch career page: ${response.status}`)

        const html = await response.text()
        const jobs = await parseJobsFromHtml(html, careersUrl)

        console.log(`[JobCrawler] Found ${jobs.length} jobs for ${companyId}`)

        // Enrich with companyId
        return jobs.map(job => ({
            ...job,
            companyId,
            id: `crawled_${companyId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            postedAt: new Date().toISOString()
        }))

    } catch (error) {
        console.error(`[JobCrawler] Error crawling ${careersUrl}:`, error)
        throw error
    }
}
