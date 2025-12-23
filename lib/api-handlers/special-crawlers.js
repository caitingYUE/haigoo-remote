
import * as cheerio from 'cheerio'

// Helper to clean text
const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : ''

/**
 * Specialized crawler for Red Hat (Workday)
 */
export async function crawlRedHatJobs(url) {
    console.log('[SpecialCrawler] Crawling Red Hat (Workday)...')
    try {
        // Workday API endpoint
        // URL pattern: https://redhat.wd5.myworkdayjobs.com/jobs/
        // API pattern: https://redhat.wd5.myworkdayjobs.com/wday/cxs/redhat/jobs/jobs
        
        // Extract tenant and site from URL if possible, otherwise hardcode for known Red Hat
        const apiEndpoint = 'https://redhat.wd5.myworkdayjobs.com/wday/cxs/redhat/jobs/jobs'
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                "limit": 50, // Fetch first 50
                "offset": 0,
                "searchText": ""
            })
        })

        if (!response.ok) {
            throw new Error(`Workday API error: ${response.status}`)
        }

        const data = await response.json()
        if (!data.jobPostings) return []

        return data.jobPostings.map(job => ({
            title: job.title,
            url: `https://redhat.wd5.myworkdayjobs.com/jobs${job.externalPath}`,
            location: job.locationsText || 'Remote',
            type: 'Full-time', // Workday usually implies full-time or lists it
            sourceType: 'trusted',
            isTrusted: true
        }))

    } catch (e) {
        console.error('[SpecialCrawler] Red Hat error:', e)
        return []
    }
}

/**
 * Specialized crawler for SafetyWing (Pinpoint)
 */
export async function crawlSafetyWingJobs(url) {
    console.log('[SpecialCrawler] Crawling SafetyWing (Pinpoint)...')
    try {
        // Pinpoint usually exposes /jobs.json
        // Try to construct the JSON URL from the base URL
        // Input: https://safetywing.pinpointhq.com/
        // Output: https://safetywing.pinpointhq.com/jobs.json
        
        const baseUrl = new URL(url).origin
        const jsonUrl = `${baseUrl}/jobs.json`
        
        const response = await fetch(jsonUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        if (!response.ok) {
            // Fallback: Try fetching HTML and parsing (if JSON fails)
            console.log('[SpecialCrawler] SafetyWing JSON failed, trying HTML...')
            return [] 
        }

        const data = await response.json()
        if (!data.data) return []

        return data.data.map(job => ({
            title: job.title,
            url: job.url,
            location: job.location?.name || 'Remote',
            type: job.employment_type || 'Full-time',
            description: job.description || '', // Pinpoint JSON might have HTML description
            sourceType: 'trusted',
            isTrusted: true
        }))

    } catch (e) {
        console.error('[SpecialCrawler] SafetyWing error:', e)
        return []
    }
}

/**
 * Specialized crawler for Automattic
 */
export async function crawlAutomatticJobs(url) {
    console.log('[SpecialCrawler] Crawling Automattic...')
    try {
        // Automattic jobs are on https://automattic.com/work-with-us/ usually
        // But the user provided https://automattic.com/jobs/
        // We will fetch the provided URL
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        const html = await response.text()
        const $ = cheerio.load(html)
        const jobs = []

        // Heuristic: Automattic lists jobs under specific headings or in lists
        // They often change structure. 
        // Strategy: Find all links that look like jobs (contain "Engineer", "Designer", "Wrangler")
        // and exclude common nav links.
        
        const keywords = ['Engineer', 'Designer', 'Wrangler', 'Developer', 'Lead', 'Head', 'Director', 'Support', 'Marketer']
        
        $('a').each((i, el) => {
            const $el = $(el)
            const text = cleanText($el.text())
            const href = $el.attr('href')
            
            if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
            
            // Check if text matches a job title pattern
            if (keywords.some(k => text.includes(k)) && text.length < 100) {
                 // Exclude some common false positives
                 if (text.includes('Blog') || text.includes('About') || text.includes('Contact')) return
                 
                 jobs.push({
                     title: text,
                     url: href.startsWith('http') ? href : new URL(href, url).toString(),
                     location: 'Remote', // Automattic is fully remote
                     type: 'Full-time',
                     sourceType: 'trusted',
                     isTrusted: true
                 })
            }
        })

        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] Automattic error:', e)
        return []
    }
}

/**
 * Specialized crawler for X-Team
 */
export async function crawlXTeamJobs(url) {
    console.log('[SpecialCrawler] Crawling X-Team...')
    try {
        // X-Team is a Gatsby site. 
        // Since we couldn't easily find the JSON, we will try to parse the HTML 
        // looking for any structured data or just fallback to returning an empty list 
        // with a log, or try a generic link scan.
        
        // Note: X-Team "Apply" usually goes to a form.
        // Let's try to fetch the page and look for "Open Roles" section.
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        const html = await response.text()
        const $ = cheerio.load(html)
        const jobs = []
        
        // Generic link scanner for X-Team since they use "Senior JavaScript Developer" etc in <a> tags
        $('a').each((i, el) => {
            const $el = $(el)
            const text = cleanText($el.text())
            const href = $el.attr('href')
            
            if (!href) return
            
            // X-Team roles usually contain "Developer" or "Engineer"
            if ((text.includes('Developer') || text.includes('Engineer')) && text.length < 80) {
                 jobs.push({
                     title: text,
                     url: href.startsWith('http') ? href : new URL(href, url).toString(),
                     location: 'Remote',
                     type: 'Full-time',
                     sourceType: 'trusted',
                     isTrusted: true
                 })
            }
        })
        
        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] X-Team error:', e)
        return []
    }
}

export async function dispatchSpecialCrawler(url) {
    if (url.includes('redhat.wd5.myworkdayjobs.com')) {
        return crawlRedHatJobs(url)
    }
    if (url.includes('safetywing.pinpointhq.com')) {
        return crawlSafetyWingJobs(url)
    }
    if (url.includes('automattic.com')) {
        return crawlAutomatticJobs(url)
    }
    if (url.includes('jobs.x-team.com')) {
        return crawlXTeamJobs(url)
    }
    return null
}
