
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
                "limit": 20, // Reduced from 50 to match working debug payload
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
        // We will fetch the provided URL, and if no jobs found, try /work-with-us/
        
        const urlsToTry = [url];
        if (!url.includes('work-with-us')) {
            urlsToTry.push('https://automattic.com/work-with-us/');
        }

        const jobs = [];
        const seenUrls = new Set();

        for (const targetUrl of urlsToTry) {
            console.log(`[SpecialCrawler] Fetching ${targetUrl}...`);
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })

            if (!response.ok) continue;
            
            const html = await response.text()
            const $ = cheerio.load(html)

            // Automattic often puts job links in encoded HTML entities inside the body or scripts
            // Example: href="https://automattic.com/work-with-us/job/..." or with escaped slashes
            // We search for this specific pattern in the raw HTML
            const rawJobMatches = html.matchAll(/automattic\.com\\?\/work-with-us\\?\/job\\?\/([^"&]+)/g);
            for (const match of rawJobMatches) {
                 const slug = match[1];
                 // Construct clean URL
                 const fullUrl = `https://automattic.com/work-with-us/job/${slug.replace(/\\/g, '')}`;
                 
                 if (!seenUrls.has(fullUrl)) {
                     seenUrls.add(fullUrl);
                     // Extract title from slug
                     let title = slug.replace(/\\/g, '').replace(/\/$/, '').replace(/-/g, ' ');
                     title = title.charAt(0).toUpperCase() + title.slice(1);
                     
                     jobs.push({
                         title: title,
                         url: fullUrl,
                         location: 'Remote',
                         type: 'Full-time',
                         sourceType: 'trusted',
                         isTrusted: true
                     });
                 }
            }
            
            // Standard link scanner (fallback)
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
                     
                     const fullUrl = href.startsWith('http') ? href : new URL(href, targetUrl).toString()
                     
                     if (!seenUrls.has(fullUrl)) {
                         seenUrls.add(fullUrl)
                         jobs.push({
                             title: text,
                             url: fullUrl,
                             location: 'Remote', // Automattic is fully remote
                             type: 'Full-time',
                             sourceType: 'trusted',
                             isTrusted: true
                         })
                     }
                }
            })
            
            if (jobs.length > 0) break; // If we found jobs, stop trying other URLs
        }

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
        // We will try to fetch the JSON data directly.
        // Try page-data.json for /jobs/
        
        const jobs = [];
        const baseUrl = 'https://jobs.x-team.com';
        
        // 1. Try to find hashes from main page HTML
        let hashes = [];
        try {
            const htmlRes = await fetch(url);
            if (htmlRes.ok) {
                const html = await htmlRes.text();
                // Look for staticQueryHashes in window.__chunkMapping or similar
                // Actually, Gatsby usually puts hashes in window.___pageData or separate files
                // But finding "component---src-pages-jobs-index-tsx" chunk is hard without parsing JS
            }
        } catch(e) {}

        // 2. Try known endpoints
        const endpoints = [
            `${baseUrl}/page-data/jobs/page-data.json`,
            `${baseUrl}/page-data/index/page-data.json`,
            `${baseUrl}/page-data/sq/d/4095568744.json` // Metadata
        ];
        
        // We need to find the jobs hash. 
        // If automatic detection fails, let's use a very aggressive fallback: 
        // Iterate through common JS chunks? No.
        
        // Let's rely on the generic link scanner BUT with a twist:
        // We will try to fetch `https://x-team.com/join/` as well if `jobs.x-team.com` fails.
        
        const urlsToScan = [url, 'https://x-team.com/join/'];
        
        for (const scanUrl of urlsToScan) {
             const htmlRes = await fetch(scanUrl, {
                 headers: { 'User-Agent': 'Mozilla/5.0' }
             });
             
             if (!htmlRes.ok) continue;
             
             const html = await htmlRes.text();
             const $ = cheerio.load(html);
             
             $('a').each((i, el) => {
                 const $el = $(el)
                 const text = cleanText($el.text())
                 const href = $el.attr('href')
                 
                 if (!href) return
                 
                 // X-Team roles usually contain "Developer" or "Engineer"
                 if ((text.includes('Developer') || text.includes('Engineer') || text.includes('Architect')) && text.length < 80) {
                     const fullUrl = href.startsWith('http') ? href : new URL(href, scanUrl).toString()
                     // Deduplicate
                     if (!jobs.some(j => j.url === fullUrl)) {
                         jobs.push({
                             title: text,
                             url: fullUrl,
                             location: 'Remote',
                             type: 'Full-time',
                             sourceType: 'trusted',
                             isTrusted: true
                         })
                     }
                 }
             })
             
             // Also look for "Apply" links which might be to Lever/Greenhouse
             $('a').each((i, el) => {
                 const href = $(el).attr('href');
                 if (href && (href.includes('lever.co') || href.includes('greenhouse.io'))) {
                     // This is an external job board link
                     // We can't crawl it easily here, but we can add it as a "Job Board" entry?
                     // Or just log it.
                     console.log(`[SpecialCrawler] Found external ATS link: ${href}`);
                 }
             });
        }
        
        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] X-Team error:', e)
        return []
    }
}

export async function crawlBraintrustJobs(url) {
    console.log('[SpecialCrawler] Crawling Braintrust...')
    try {
        let employerId = '2' // Default
        const match = url.match(/employers\/(\d+)/)
        if (match) {
            employerId = match[1]
        }

        const jobs = []
        let nextUrl = `https://app.usebraintrust.com/api/jobs/?employer_id=${employerId}&limit=100`
        let pageCount = 0
        const MAX_PAGES = 50 // Safety limit to prevent infinite loops

        while (nextUrl && pageCount < MAX_PAGES) {
            pageCount++
            console.log(`[SpecialCrawler] Fetching page ${pageCount}: ${nextUrl}...`)
            
            // Add 15s timeout for robustness
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)

            try {
                const response = await fetch(nextUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    signal: controller.signal
                })
                clearTimeout(timeoutId)

                if (!response.ok) {
                    console.error(`[SpecialCrawler] Braintrust API error: ${response.status} ${response.statusText}`)
                    break
                }

                const data = await response.json()
                const results = data.results || []

                if (results.length === 0 && pageCount > 1) {
                    // If empty results on subsequent pages, stop
                    break
                }

                for (const job of results) {
                    const employerName = job.employer ? job.employer.name : 'Unknown'
                    const title = job.title
                    // Prepend employer name to title for clarity
                    const fullTitle = employerName !== 'Freelance Labs, Inc.' && employerName !== 'Braintrust' 
                        ? `${title} (@${employerName})` 
                        : title

                    const jobUrl = `https://app.usebraintrust.com/jobs/${job.id}/`
                    
                    // Construct a rich description from available data
                    const skills = job.main_skills ? job.main_skills.map(s => s.name).join(', ') : ''
                    const roleName = job.role ? job.role.name : ''
                    
                    let description = `<p><strong>Employer:</strong> ${employerName}</p>`
                    if (job.budget_minimum_usd) {
                        description += `<p><strong>Budget:</strong> $${job.budget_minimum_usd} - $${job.budget_maximum_usd} / ${job.payment_type}</p>`
                    }
                    if (skills) {
                        description += `<p><strong>Skills:</strong> ${skills}</p>`
                    }
                    if (roleName) {
                        description += `<p><strong>Role Category:</strong> ${roleName}</p>`
                    }
                    if (job.expected_hours_per_week) {
                        description += `<p><strong>Expected Hours:</strong> ${job.expected_hours_per_week} hrs/week</p>`
                    }
                    description += `<p><a href="${jobUrl}">View full job details on Braintrust</a></p>`

                    jobs.push({
                        title: fullTitle,
                        url: jobUrl,
                        location: (job.locations && job.locations.length > 0) ? job.locations.map(l => l.location).join(', ') : 'Remote',
                        type: job.job_type === 'freelance' ? 'Contract' : 'Full-time',
                        description: description,
                        salary: job.budget_minimum_usd ? `$${job.budget_minimum_usd} - $${job.budget_maximum_usd} / ${job.payment_type}` : null,
                        publishedAt: job.created,
                        sourceType: 'trusted',
                        isTrusted: true,
                        company: 'Braintrust' // Ensure it maps to the trusted company record
                    })
                }

                // Handle pagination (ensure HTTPS)
                nextUrl = data.next
                if (nextUrl && nextUrl.startsWith('http:')) {
                    nextUrl = nextUrl.replace('http:', 'https:')
                }
            } catch (fetchErr) {
                clearTimeout(timeoutId)
                if (fetchErr.name === 'AbortError') {
                    console.error(`[SpecialCrawler] Timeout fetching page ${pageCount}`)
                } else {
                    console.error(`[SpecialCrawler] Error fetching page ${pageCount}:`, fetchErr)
                }
                break // Stop on error to avoid partial/corrupt data loops
            }
        }

        console.log(`[SpecialCrawler] Braintrust found ${jobs.length} jobs`)
        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] Braintrust error:', e)
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
    if (url.includes('usebraintrust.com') && url.includes('employers')) {
        return crawlBraintrustJobs(url)
    }
    if (url.includes('automattic.com')) {
        return crawlAutomatticJobs(url)
    }
    if (url.includes('jobs.x-team.com')) {
        return crawlXTeamJobs(url)
    }
    return null
}
