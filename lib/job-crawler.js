

import * as cheerio from 'cheerio'
import { parseAshbyJobs, isAshbyJobBoard } from './ashby-parser.js'
import { parseWorkableJobs, isWorkableJobBoard } from './workable-parser.js'
import { parseBambooHRJobs, isBambooHRJobBoard } from './bamboohr-parser.js'
import { ClassificationService } from './services/classification-service.js'

// Simple hash function for generating stable job IDs
function hash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
}

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

// Helper to extract description from Cheerio element or HTML string
const extractDescription = (content, $) => {
    if (!content) return ''
    
    // If content is a string and looks like HTML
    if (typeof content === 'string') {
        if (!/<[a-z][\s\S]*>/i.test(content)) {
            return cleanMultilineText(content)
        }
        // Load HTML string into Cheerio
        const $fragment = cheerio.load(content, null, false)
        return extractDescription($fragment.root(), $fragment)
    }
    
    // If content is a Cheerio object
    if (content.length === 0) return ''
    
    // We clone to avoid modifying original DOM if it's from the main page
    // But if it's a fragment we just created, cloning is fine/redundant
    const $clone = content.clone()
    
    // Pre-processing
    $clone.find('script, style, noscript, svg').remove()
    $clone.find('br').replaceWith('\n')
    $clone.find('p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article').after('\n')
    $clone.find('li').prepend('• ')
    
    return cleanMultilineText($clone.text())
}

// Heuristic Job Parser
async function parseJobsFromHtml(html, baseUrl, companyId) {
    const $ = cheerio.load(html)
    let jobs = []
    let company = null

    // Extract company info from Schema.org
    const companyScripts = $('script[type="application/ld+json"]')
    companyScripts.each((i, el) => {
        try {
            const json = JSON.parse($(el).text())
            const items = Array.isArray(json) ? json : [json]
            for (const item of items) {
                if (item['@type'] === 'Organization' || item['@type'] === 'Corporation') {
                    if (!company) company = {}
                    if (item.name) company.name = item.name
                    if (item.logo) company.logo = typeof item.logo === 'string' ? item.logo : item.logo.url
                    if (item.address) {
                        if (typeof item.address === 'string') {
                            company.address = item.address
                        } else if (typeof item.address === 'object') {
                            const parts = []
                            if (item.address.addressCountry) parts.push(item.address.addressCountry)
                            if (item.address.addressLocality) parts.push(item.address.addressLocality)
                            if (parts.length > 0) company.address = parts.join(', ')
                        }
                    }
                }
            }
        } catch (e) { }
    })

    // Strategy 0: Ashby Job Board (Highest Priority for ashbyhq.com)
    if (isAshbyJobBoard(baseUrl)) {
        console.log('[job-crawler] Detected Ashby job board, using specialized parser')
        const result = parseAshbyJobs(html, baseUrl, companyId)
        if (result && result.jobs && result.jobs.length > 0) {
            console.log(`[job-crawler] Ashby parser found ${result.jobs.length} jobs`)
            return result // Returns { jobs, company }
        }
    }

    // Strategy 0.1: Workable Job Board (API based)
    if (isWorkableJobBoard(baseUrl)) {
        console.log('[job-crawler] Detected Workable job board, using API parser')
        const result = await parseWorkableJobs(baseUrl, companyId)
        if (result && result.jobs && result.jobs.length > 0) {
            console.log(`[job-crawler] Workable parser found ${result.jobs.length} jobs`)
            return result // Returns { jobs, company }
        }
    }

    // Strategy 0.15: BambooHR Job Board (API based)
    if (isBambooHRJobBoard(baseUrl)) {
        console.log('[job-crawler] Detected BambooHR job board, using API parser')
        const result = await parseBambooHRJobs(baseUrl, companyId)
        if (result && result.jobs && result.jobs.length > 0) {
            console.log(`[job-crawler] BambooHR parser found ${result.jobs.length} jobs`)
            return result // Returns { jobs, company }
        }
    }

    // Strategy 0.2: Homerun Job Board (e.g. Appwrite)
    const homerunMeta = $('meta[name="homerun:company_id"]')
    const jobList = $('job-list')
    if (homerunMeta.length > 0 || jobList.length > 0) {
        console.log('[job-crawler] Detected Homerun job board')
        try {
            const vBind = jobList.attr('v-bind')
            if (vBind) {
                const data = JSON.parse(vBind)
                if (data && data.content && data.content.vacancies) {
                    const vacancies = data.content.vacancies
                    const locations = data.content.locations || []
                    const jobTypes = data.content.job_types || []

                    const homerunJobs = vacancies.map(v => {
                        const loc = locations.find(l => l.id === v.location_id)
                        const type = jobTypes.find(t => t.id === v.job_type_id)
                        return {
                            title: v.title,
                            url: v.url,
                            location: loc ? loc.name : 'Remote',
                            type: type ? type.name : 'Full-time',
                            sourceType: 'trusted',
                            isTrusted: true
                        }
                    })

                    if (homerunJobs.length > 0) {
                        console.log(`[job-crawler] Homerun parser found ${homerunJobs.length} jobs`)
                        return { jobs: homerunJobs, company }
                    }
                }
            }
        } catch (e) {
            console.error('[job-crawler] Homerun parser error:', e)
        }
    }

    // Strategy 0.25: AlphaSights Custom Parser (Based on their layout)
    if (baseUrl.includes('alphasights.com')) {
        console.log('[job-crawler] Detected AlphaSights job board')
        // AlphaSights seems to list jobs in a way that generic fallback might miss details
        // Or maybe they load dynamically?
        // Let's rely on generic fallback for listing (if it works), but optimize DETAIL extraction.
        // Actually, if listing is missing, we need to handle it.
        // But the user complaint is about EMPTY DESCRIPTION.
        // So we focus on `fetchJobDetails` function optimization below.
    }

    // Strategy 0.3: Eigen AI (Custom Parser)
    if (baseUrl.includes('eigenai.com') || baseUrl.includes('eigen.co')) {
        console.log('[JobCrawler] Detected Eigen AI job board')
        const eigenJobs = []
        
        // Eigen AI uses <a> tags wrapping the content for each job
        // Links start with /join/ (but exclude /join itself if it appears)
        $('a[href^="/join/"]').each((i, el) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            // Skip the main /join page link if caught
            if (href === '/join' || href === '/join/') return

            const $h3 = $el.find('h3')
            if ($h3.length === 0) return // Not a job card

            const title = cleanText($h3.text())
            const subtitle = cleanText($h3.next('p').text())
            const descriptionText = cleanText($h3.parent().next('p').text())
            
            // Combine subtitle and description for better context
            const description = [subtitle, descriptionText].filter(Boolean).join('\n\n')

            if (title && href) {
                eigenJobs.push({
                    title,
                    url: href.startsWith('http') ? href : new URL(href, baseUrl).toString(),
                    location: 'Remote', // Eigen AI is remote-first
                    type: 'Full-time',
                    description,
                    tags: subtitle ? [subtitle] : [],
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })

        if (eigenJobs.length > 0) {
            console.log(`[job-crawler] Eigen AI parser found ${eigenJobs.length} jobs`)
            return { jobs: eigenJobs, company }
        }
    }

    // Strategy 0.35: Greenhouse Job Board (Remix / New UI)
    if (baseUrl.includes('greenhouse.io') || html.includes('window.__remixContext')) {
        console.log('[job-crawler] Detected Greenhouse job board')
        const greenhouseJobs = []

        // 1. Try to parse Remix Context (New Greenhouse UI)
        // Extract window.__remixContext = { ... };
        const remixMatch = html.match(/window\.__remixContext\s*=\s*({[\s\S]*?});/)
        if (remixMatch && remixMatch[1]) {
            try {
                const remixContext = JSON.parse(remixMatch[1])
                // Path: state.loaderData['routes/$url_token'].posts.data
                // Or sometimes just state.loaderData.routes...
                const loaderData = remixContext.state?.loaderData
                const urlTokenKey = Object.keys(loaderData || {}).find(k => k.includes('$url_token'))
                
                if (urlTokenKey) {
                    const routeData = loaderData[urlTokenKey]
                    const postsData = routeData.jobPosts || routeData.posts
                    
                    if (postsData && postsData.data) {
                        const posts = postsData.data
                        posts.forEach(post => {
                            greenhouseJobs.push({
                                title: post.title,
                                // Ensure URL is absolute
                                url: post.absolute_url || (post.internal_job_id ? `${baseUrl.replace(/\/$/, '')}/jobs/${post.internal_job_id}` : baseUrl),
                                location: post.location?.name || post.location || 'Remote',
                                type: 'Full-time', // Default if missing
                                description: post.content ? extractDescription(post.content, $) : '',
                                sourceType: 'trusted',
                                isTrusted: true
                            })
                        })
                    }
                }
            } catch (e) {
                console.error('[job-crawler] Error parsing Greenhouse Remix context:', e)
            }
        }
        
        if (greenhouseJobs.length > 0) {
            console.log(`[job-crawler] Greenhouse parser (Remix) found ${greenhouseJobs.length} jobs`)
            return { jobs: greenhouseJobs, company }
        }
    }

    // Strategy 0.38: Taskade Direct Site (Custom Parser)
    if (baseUrl.includes('taskade.com/jobs')) {
        console.log('[JobCrawler] Detected Taskade direct job board')
        const taskadeJobs = []
        
        // Helper to process a potential job element
        const processElement = (el) => {
            const $el = $(el);
            // It must be a button (as observed in Taskade)
            if (!$el.is('button')) return;
            
            const $p = $el.find('p');
            if ($p.length === 0) return;
            
            const location = cleanText($p.text());
            
            // Check if location looks valid (Taskade style: "City / City / Remote" or "Remote")
            // Make heuristic broad enough to catch all jobs but strict enough to avoid UI buttons
            const isLocationLike = /remote/i.test(location) || 
                                   /singapore/i.test(location) || 
                                   /san francisco/i.test(location) ||
                                   /new york/i.test(location) ||
                                   location.includes('/') ||
                                   location.toLowerCase().includes('based in');
                                   
            if (!isLocationLike) return;
            
            // Extract Title
            const $clone = $el.clone();
            $clone.find('p').remove();
            const title = cleanText($clone.text());
            
            if (title && title.length < 100 && title.length > 2) {
                 // Deduplicate
                 if (taskadeJobs.some(j => j.title === title)) return;
                 
                 taskadeJobs.push({
                    title,
                    url: baseUrl, 
                    location,
                    type: 'Full-time',
                    description: `Role: ${title}\nLocation: ${location}\n\nPlease visit https://www.taskade.com/jobs to view the full description and apply.`,
                    publishedAt: new Date().toISOString(), // Force today to avoid "old job" filtering
                    sourceType: 'trusted',
                    isTrusted: true
                 })
            }
        };

        // 1. Targeted Search (h1#join-our-team context)
        const $joinHeader = $('h1#join-our-team');
        if ($joinHeader.length > 0) {
            $joinHeader.parent().find('button').each((i, el) => processElement(el));
        }

        // 2. Fallback Search (All buttons) if we missed jobs or header not found
        // We always run fallback to catch jobs that might be outside the header container
        // Deduplication in processElement handles overlaps
        $('button').each((i, el) => processElement(el));

        if (taskadeJobs.length > 0) {
            console.log(`[JobCrawler] Taskade parser found ${taskadeJobs.length} jobs`)
            return { jobs: taskadeJobs, company }
        }
    }

    // Strategy 0.4: Pinpoint Job Board
    if (baseUrl.includes('pinpointhq.com')) {
        // ... (Pinpoint logic stays the same)
        console.log('[job-crawler] Detected Pinpoint job board')
        const pinpointJobs = []

        // 1. Try JSON-LD first (Pinpoint usually has this)
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).text())
                const items = Array.isArray(json) ? json : [json]
                items.forEach(item => {
                    if (item['@type'] === 'JobPosting') {
                        pinpointJobs.push({
                            title: item.title,
                            location: item.jobLocation?.address?.addressLocality || 'Remote',
                            type: item.employmentType || 'Full-time',
                            url: item.url || baseUrl,
                            description: item.description,
                            sourceType: 'trusted',
                            isTrusted: true
                        })
                    }
                })
            } catch (e) { }
        })

        if (pinpointJobs.length > 0) {
            console.log(`[job-crawler] Pinpoint parser (JSON-LD) found ${pinpointJobs.length} jobs`)
            return { jobs: pinpointJobs, company }
        }

        // 2. Fallback to HTML parsing
        // Pinpoint often lists jobs in <a> tags with href containing /post/
        $('a[href*="/post/"]').each((i, el) => {
            const $el = $(el)
            const href = $el.attr('href')

            // Avoid duplicates if multiple links point to same job
            if (pinpointJobs.some(j => j.url.includes(href))) return

            // Pinpoint structure varies, but usually Title is the main text or inside a heading
            let title = cleanText($el.find('h2, h3, h4, .title').text())
            if (!title) title = cleanText($el.text()) // Fallback

            // Location is often in a sibling or child element
            // Try to find common location indicators
            let location = 'Remote'
            const locationEl = $el.find('.location, [class*="location"], .meta')
            if (locationEl.length > 0) {
                location = cleanText(locationEl.text())
            } else {
                // Try sibling
                const siblingLoc = $el.next('.location')
                if (siblingLoc.length > 0) location = cleanText(siblingLoc.text())
            }

            if (title && href) {
                pinpointJobs.push({
                    title,
                    url: href.startsWith('http') ? href : new URL(href, baseUrl).toString(),
                    location: location || 'Remote',
                    type: 'Full-time',
                    description: '', // Pinpoint list usually doesn't have description
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })

        if (pinpointJobs.length > 0) {
            console.log(`[job-crawler] Pinpoint parser (HTML) found ${pinpointJobs.length} jobs`)
            return { jobs: pinpointJobs, company }
        }
    }

    // Strategy 0.5: SmartRecruiters Job Board
    if (baseUrl.includes('smartrecruiters.com')) {
        console.log('[job-crawler] Detected SmartRecruiters job board')
        const smartJobs = []

        // SmartRecruiters usually lists jobs in:
        // 1. <li class="opening">...</li>
        // 2. <a class="link--block details">...</a>
        // 3. Or sometimes in groups

        // Use specific selectors to avoid selecting the container list
        $('li.opening, tr.job, a.job-title, a.details').each((i, el) => {
            const $el = $(el)

            // If this element contains other job items (e.g. it's a list), skip it
            if ($el.find('li.opening, tr.job').length > 0) return

            // Try to find the link
            let $link = $el.is('a') ? $el : $el.find('a').first()
            if ($link.length === 0) return

            const href = $link.attr('href')
            if (!href) return

            // Extract Title
            let title = ''
            const titleEl = $el.find('h4, .details-title, .job-title')
            if (titleEl.length > 0) {
                title = cleanText(titleEl.text())
            } else {
                title = cleanText($link.text())
            }

            // Extract Location
            let location = 'Remote'
            const locationEl = $el.find('.details-location, .location')
            if (locationEl.length > 0) {
                location = cleanText(locationEl.text())
            }

            if (title && href) {
                smartJobs.push({
                    title,
                    url: href.startsWith('http') ? href : new URL(href, baseUrl).toString(),
                    location: location || 'Remote',
                    type: 'Full-time', // Default
                    description: '', // List usually doesn't have description
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })

        if (smartJobs.length > 0) {
            console.log(`[job-crawler] SmartRecruiters parser found ${smartJobs.length} jobs`)
            // Deduplicate
            const uniqueSmart = []
            const seenSmart = new Set()
            smartJobs.forEach(j => {
                if (!seenSmart.has(j.url)) {
                    seenSmart.add(j.url)
                    uniqueSmart.push(j)
                }
            })
            return { jobs: uniqueSmart, company }
        }
    }

    // Strategy 0.6: Y Combinator Job Board
    if (baseUrl.includes('ycombinator.com')) {
        console.log('[job-crawler] Detected Y Combinator job board')
        const ycJobs = []

        // 0. Try to parse data-page attribute (New React/Next.js hydration)
        const dataPage = $('[data-page]').attr('data-page');
        if (dataPage) {
            try {
                const data = JSON.parse(dataPage);
                if (data.props && data.props.jobPostings) {
                    data.props.jobPostings.forEach(p => {
                         ycJobs.push({
                             title: p.title,
                             url: p.url.startsWith('http') ? p.url : `https://www.ycombinator.com${p.url}`,
                             location: p.location || 'Remote',
                             type: p.type || 'Full-time',
                             description: '', // YC JSON usually doesn't have full description
                             sourceType: 'trusted',
                             isTrusted: true
                         });
                    });
                    
                    if (ycJobs.length > 0) {
                        console.log(`[job-crawler] Y Combinator parser (data-page) found ${ycJobs.length} jobs`);
                        return { jobs: ycJobs, company };
                    }
                }
            } catch (e) {
                console.error('[job-crawler] Error parsing YC data-page:', e);
            }
        }

        // 1. Try to find the JSON data embedded in the page (most reliable)
        // It seems to be in a data-page attribute or similar, HTML encoded.
        // We look for "jobPostings" pattern in the whole HTML
        const jobPostingsMatch = html.match(/&quot;jobPostings&quot;:(\[{.*?}\])/);
        if (jobPostingsMatch && jobPostingsMatch[1]) {
             try {
                 // Decode HTML entities
                 const rawJson = jobPostingsMatch[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
                 const postings = JSON.parse(rawJson);
                 
                 postings.forEach(p => {
                     ycJobs.push({
                         title: p.title,
                         url: p.url.startsWith('http') ? p.url : `https://www.ycombinator.com${p.url}`,
                         location: p.location || 'Remote',
                         type: p.type || 'Full-time',
                         description: '', // YC JSON usually doesn't have full description
                         sourceType: 'trusted',
                         isTrusted: true
                     });
                 });
                 
                 if (ycJobs.length > 0) {
                     console.log(`[job-crawler] Y Combinator parser (JSON) found ${ycJobs.length} jobs`);
                     return { jobs: ycJobs, company };
                 }
             } catch (e) {
                 console.error('[job-crawler] Error parsing YC JSON:', e);
             }
        }

        // 2. Fallback to HTML parsing (New Layout)
        $('.ycdc-with-link-color a').each((i, el) => {
            const $el = $(el)
            const title = cleanText($el.text())
            const link = $el.attr('href')
            
            // Location is in the sibling div
            // <div class="justify-left flex flex-row ..."> <div>Location</div> ... </div>
            const locationDiv = $el.closest('.flex-col').find('.justify-left div').first()
            const location = locationDiv.length > 0 ? cleanText(locationDiv.text()) : 'Remote'

            if (title && link) {
                ycJobs.push({
                    title,
                    url: link.startsWith('http') ? link : `https://www.ycombinator.com${link}`,
                    location: location,
                    type: 'Full-time',
                    description: '',
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })
        
        // 3. Fallback to HTML parsing (Old Layout)
        if (ycJobs.length === 0) {
            $('.job-name').each((i, el) => {
                const $el = $(el)
                const title = cleanText($el.text())
                const link = $el.closest('a').attr('href')

                if (title && link) {
                    ycJobs.push({
                        title,
                        url: link.startsWith('http') ? link : new URL(link, baseUrl).toString(),
                        location: 'Remote', // Default to Remote for YC if not easily parsable
                        type: 'Full-time',
                        description: '',
                        sourceType: 'trusted',
                        isTrusted: true
                    })
                }
            })
        }

        if (ycJobs.length > 0) {
            console.log(`[job-crawler] Y Combinator parser found ${ycJobs.length} jobs`)
            return { jobs: ycJobs, company }
        }
    }

    // Strategy 0.7: Canonical (Embedded JSON)
    if (baseUrl.includes('canonical.com')) {
        console.log('[job-crawler] Detected Canonical job board')
        // Look for "const vacancies = [...]"
        const scriptContent = $('script').map((i, el) => $(el).html()).get().join('\n')
        const vacanciesMatch = scriptContent.match(/const vacancies\s*=\s*(\[[\s\S]*?\]);/)
        
        if (vacanciesMatch && vacanciesMatch[1]) {
            try {
                const vacancies = JSON.parse(vacanciesMatch[1])
                const canonicalJobs = vacancies.map(v => ({
                    title: v.title,
                    url: v.url, // Use the Greenhouse URL provided in the JSON
                    location: v.location || 'Remote',
                    type: v.employment || 'Full-time',
                    description: v.description || '', // This is usually a summary
                    sourceType: 'trusted',
                    isTrusted: true
                }))

                if (canonicalJobs.length > 0) {
                    console.log(`[job-crawler] Canonical parser found ${canonicalJobs.length} jobs`)
                    return { jobs: canonicalJobs, company }
                }
            } catch (e) {
                console.error('[job-crawler] Error parsing Canonical vacancies:', e)
            }
        }
    }

    // Strategy 0.8: Dover Job Board
    if (baseUrl.includes('dover.com')) {
        console.log('[job-crawler] Detected Dover job board')
        const nextData = $('#__NEXT_DATA__')
        if (nextData.length > 0) {
            try {
                const json = JSON.parse(nextData.text())
                
                // Helper to find jobs in Dover's structure
                const findDoverJobs = (obj) => {
                    if (!obj || typeof obj !== 'object') return []
                    
                    // If it's an array, map and flatten
                    if (Array.isArray(obj)) return obj.flatMap(findDoverJobs)
                    
                    // Check if this looks like a job object
                    // Dover usually has 'title', 'location', and often 'hosted_url' or 'id'
                    if (obj.title && typeof obj.title === 'string') {
                        const jobUrl = obj.hosted_url || obj.url || obj.external_url
                        if (jobUrl) {
                            return [{
                                title: obj.title,
                                url: jobUrl,
                                location: obj.location?.name || obj.location || 'Remote',
                                type: obj.employment_type || 'Full-time',
                                description: obj.description || '',
                                sourceType: 'trusted',
                                isTrusted: true
                            }]
                        }
                    }
                    
                    // Recurse object values
                    return Object.values(obj).flatMap(findDoverJobs)
                }

                const found = findDoverJobs(json)
                // Deduplicate
                const unique = []
                const seen = new Set()
                found.forEach(j => {
                    if (!seen.has(j.url)) {
                        seen.add(j.url)
                        unique.push(j)
                    }
                })

                if (unique.length > 0) {
                    console.log(`[job-crawler] Dover parser found ${unique.length} jobs`)
                    return { jobs: unique, company }
                }
            } catch (e) {
                console.error('[job-crawler] Error parsing Dover data:', e)
            }
        }
    }

    // Strategy 0.9: Ashby Embed Script
    // Many sites (like Chainlink Labs) embed Ashby via a script tag
    const ashbyEmbed = $('script[src*="jobs.ashbyhq.com"][src*="embed"]')
    if (ashbyEmbed.length > 0) {
        console.log('[job-crawler] Detected Ashby Embed Script')
        const embedSrc = ashbyEmbed.attr('src')
        if (embedSrc) {
            // Convert embed URL to public board URL
            // e.g. https://jobs.ashbyhq.com/chainlink-labs/embed -> https://jobs.ashbyhq.com/chainlink-labs
            const ashbyUrl = embedSrc.replace('/embed', '')
            console.log(`[job-crawler] Fetching Ashby page: ${ashbyUrl}`)
             
             try {
                 const ashbyRes = await fetch(ashbyUrl, {
                     headers: { 
                         'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                         'Referer': baseUrl 
                     }
                 })
                 
                 if (ashbyRes.ok) {
                    const ashbyHtml = await ashbyRes.text()
                    // Reuse logic similar to Strategy 1.6
                    const appDataMatch = ashbyHtml.match(/window\.__appData\s*=\s*({[^;]+});/)
                    
                    if (appDataMatch) {
                        try {
                            const appData = JSON.parse(appDataMatch[1])
                            if (appData.jobBoard && appData.jobBoard.jobPostings) {
                                const ashbyJobs = appData.jobBoard.jobPostings.map(job => {
                                    // Construct URL: ashbyUrl + '/' + id
                                    const cleanBase = ashbyUrl.replace(/\/$/, '')
                                    const jobUrl = `${cleanBase}/${job.id}`

                                    return {
                                        title: job.title,
                                        url: jobUrl,
                                        location: job.locationName || 'Remote',
                                        type: job.employmentType || 'Full-time',
                                        description: '', // Usually not full description in list
                                        sourceType: 'trusted',
                                        isTrusted: true
                                    }
                                })

                                if (ashbyJobs.length > 0) {
                                    console.log(`[job-crawler] Ashby Embed parser found ${ashbyJobs.length} jobs`)
                                    return { jobs: ashbyJobs, company }
                                }
                            }
                        } catch (parseErr) {
                            console.error('[job-crawler] Error parsing Ashby Embed JSON:', parseErr)
                        }
                    }
                }
            } catch (e) {
                console.error('[job-crawler] Error fetching Ashby embed:', e)
            }
        }
    }

    // Strategy 1: Next.js / Nuxt.js Hydration Data (Very High Confidence)
    const nextData = $('#__NEXT_DATA__, #__NUXT__').first()
    if (nextData.length > 0) {
        console.log('[job-crawler] Detected Next.js / Nuxt.js Hydration Data')
        try {
            const json = JSON.parse(nextData.text())

            // Helper to recursively find job arrays
            const findJobsInJson = (obj) => {
                if (!obj || typeof obj !== 'object') return []

                // Check if this object looks like a list of jobs
                if (Array.isArray(obj)) {
                    const potentialJobs = obj.filter(item =>
                        item && typeof item === 'object' &&
                        item.title && typeof item.title === 'string' &&
                        (item.url || item.absolute_url || item.application_url || item.shortlink)
                    )
                    if (potentialJobs.length > 0 && potentialJobs.length === obj.length) {
                        return potentialJobs.map(item => ({
                            title: item.title,
                            location: item.location?.location_str || item.location || 'Remote',
                            type: item.employment_type || item.type || 'Full-time',
                            url: item.url || item.absolute_url || item.application_url || item.shortlink || baseUrl,
                            description: item.description || item.short_description || '',
                            sourceType: 'trusted',
                            isTrusted: true
                        }))
                    }
                    // If not a list of jobs, recurse into items
                    return obj.flatMap(findJobsInJson)
                }

                // Recurse into object values
                return Object.values(obj).flatMap(findJobsInJson)
            }

            const foundJobs = findJobsInJson(json)
            if (foundJobs.length > 0) {
                // Deduplicate found jobs
                const uniqueFound = []
                const seen = new Set()
                foundJobs.forEach(j => {
                    if (!seen.has(j.title + j.url)) {
                        seen.add(j.title + j.url)
                        uniqueFound.push(j)
                    }
                })
                if (uniqueFound.length > 0) {
                    jobs = uniqueFound
                }
            }
        } catch (e) {
            console.error('Error parsing Next.js/Nuxt.js data:', e)
        }
    }

    // Strategy 1.5: Next.js App Router (RSC) Payload
    // Handles sites like braintrust.dev that use self.__next_f.push
    const rscScripts = $('script')
    let rscJobs = []
    rscScripts.each((i, el) => {
        const content = $(el).html() || ''
        if (content.includes('self.__next_f.push')) {
            try {
                // Regex to find the JSON string inside the push array: self.__next_f.push([1,"..."])
                // We are looking for the second element which is the string
                const matches = content.matchAll(/self\.__next_f\.push\(\[\d+,"(.*?[^\\])"\]\)/g)
                for (const match of matches) {
                    let jsonStr = match[1]
                    // Unescape quotes
                    jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

                    // Heuristic: Look for job-like structures in the raw string
                    // 1. Ashby Pattern: href":"/careers?ashby_jid=..."
                    const ashbyMatches = jsonStr.matchAll(/href":"(\/careers\?ashby_jid=[^"]+)"/g)
                    for (const m of ashbyMatches) {
                        const relUrl = m[1]
                        // Try to find title nearby (very heuristic)
                        // Looking for "children":"Job Title" pattern
                        // This is limited but handles the specific case we saw
                        const context = jsonStr.substring(Math.max(0, m.index - 500), Math.min(jsonStr.length, m.index + 1000))

                        // Extract children:"..." nearby
                        const titleMatch = context.match(/children":"([^"]+)"/)
                        const title = titleMatch ? titleMatch[1] : 'Unknown Job'

                        rscJobs.push({
                            title: title,
                            url: relUrl.startsWith('http') ? relUrl : new URL(relUrl, baseUrl).toString(),
                            location: 'Remote', // Default
                            type: 'Full-time',
                            sourceType: 'trusted',
                            isTrusted: true
                        })
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    })

    if (rscJobs.length > 0) {
        console.log(`[job-crawler] Next.js App Router parser found ${rscJobs.length} jobs`)
        // Deduplicate
        const uniqueRsc = []
        const seenRsc = new Set()
        rscJobs.forEach(j => {
            if (!seenRsc.has(j.url)) {
                seenRsc.add(j.url)
                uniqueRsc.push(j)
            }
        })
        if (uniqueRsc.length > 0) {
            // Append to existing jobs found by hydration if any, or start new
            // But usually this strategy is mutually exclusive with Pages router
            if (jobs.length === 0) jobs = uniqueRsc
            else jobs = [...jobs, ...uniqueRsc]
        }
    }

    // Strategy 1.6: Ashby __appData (Global Object)
    // Used by Frec and others: window.__appData = { ... }
    const appDataMatch = html.match(/window\.__appData\s*=\s*({[^;]+});/)
    if (appDataMatch && jobs.length === 0) {
        console.log('[job-crawler] Detected Ashby __appData Global Object')
        try {
            const appData = JSON.parse(appDataMatch[1])
            if (appData.jobBoard && appData.jobBoard.jobPostings) {
                const ashbyJobs = appData.jobBoard.jobPostings.map(job => {
                    // Construct URL: baseUrl + '/' + id
                    // Handle trailing slash in baseUrl
                    const cleanBase = baseUrl.replace(/\/$/, '')
                    const jobUrl = `${cleanBase}/${job.id}`

                    return {
                        title: job.title,
                        url: jobUrl,
                        location: job.locationName || 'Remote',
                        type: job.employmentType || 'Full-time',
                        description: '', // Usually not full description in list
                        sourceType: 'trusted',
                        isTrusted: true
                    }
                })

                if (ashbyJobs.length > 0) {
                    console.log(`[job-crawler] Ashby __appData parser found ${ashbyJobs.length} jobs`)
                    jobs = ashbyJobs
                }
            }
        } catch (e) {
            console.error('[job-crawler] Error parsing Ashby __appData:', e)
        }
    }

    // Strategy 2: Schema.org JobPosting (High Confidence)
    if (jobs.length === 0) {
        console.log('[job-crawler] Searching for Schema.org JobPosting')
        const scripts = $('script[type="application/ld+json"]')
        scripts.each((i, el) => {
            try {
                const json = JSON.parse($(el).text())
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
    }

    // Strategy 3: Common Job Board Patterns (Greenhouse, Lever, Ashby, Workable)
    if (jobs.length === 0) {
        // Greenhouse
        console.log('[job-crawler] Searching for Greenhouse Job Postings')
        const greenhouseJobs = $('.opening')
        if (greenhouseJobs.length > 0) {
            greenhouseJobs.each((i, el) => {
                const $el = $(el)
                const link = $el.find('a').first()
                const location = $el.find('.location').first()
                if (link.length > 0) {
                    const href = link.attr('href')
                    jobs.push({
                        title: cleanText(link.text()),
                        url: href.startsWith('http') ? href : new URL(href, baseUrl).toString(),
                        location: cleanText(location.text()) || 'Remote',
                        type: 'Full-time', // Assumption
                        sourceType: 'trusted',
                        isTrusted: true
                    })
                }
            })
        }
    }

    // Generic Fallback
    if (jobs.length === 0) {
        const potentialLinks = $('a')
        const keywords = [
            'Engineer', 'Developer', 'Manager', 'Designer', 'Specialist', 'Analyst', 'Director', 'Head of',
            'Lead', 'Architect', 'Consultant', 'Coordinator', 'Administrator', 'Officer', 'Associate',
            'Translator', 'Writer', 'Editor', 'Marketer', 'Sales', 'Account', 'Success', 'Support',
            'Operations', 'Legal', 'Finance', 'Data', 'Product', 'Program', 'Recruiter', 'Talent',
            'Researcher', 'Scientist'
        ]

        const excludedTextKeywords = [
            'Contact', 'About', 'Login', 'Sign In', 'Sign Up', 'Blog', 'News', 'Press', 'Solution',
            'Product', 'Service', 'Home', 'Pricing', 'Demo', 'Book', 'Guide', 'Paper', 'Report',
            'Download', 'Case Study', 'Webinar', 'Event', 'Team', 'Partner', 'Community', 'Help',
            'Support', 'Status', 'Security', 'Terms', 'Privacy', 'Cookie', 'Sitemap', 'Carrers', // Careers link itself
            'Jobs', 'Openings', 'View all', 'See all', 'Read more', 'Learn more', 'Click here',
            'Skip to', 'Back to', 'Previous', 'Next', 'Page', 'Archive', 'Category', 'Tag', 'Author',
            'Share', 'Tweet', 'Like', 'Follow', 'Subscribe', 'Email', 'Print', 'RSS', 'PDF',
            'Legal', 'Accessibility', 'Copyright', 'Trademark', 'Imprint', 'Impressum', 'GDPR', 'CCPA',
            '合法的', '隐私政策', '服务条款', 'Cookie 政策'
        ]

        const excludedUrlKeywords = [
            '/blog/', '/news/', '/article/', '/product/', '/solution/', '/solutions/', '/contact', '/about',
            '/login', '/signin', '/signup', '/register', '/pricing', '/demo', '/resources',
            '/case-studies', '/webinars', '/events', '/team', '/partners', '/community',
            '/help', '/support', '/status', '/security', '/terms', '/privacy', '/cookies',
            '/records/', '/publication/', '/research/', '/whitepaper/', // Specific for research sites like Zenodo
            '/legal/', '/accessibility/', '/copyright/', '/gdpr/', '/ccpa/',
            '/docs/', '/documentation/', '/customer-success/', '/ai/'
        ]

        const jobUrlPatterns = [
            '/jobs/', '/careers/', '/role/', '/position/', '/openings/', '/vacancy/', '/opportunity/',
            '/apply/', '/p/', '/j/', '/o/', '/job/' // Common short paths for ATS
        ]

        potentialLinks.each((i, el) => {
            const $link = $(el)
            const text = cleanText($link.text())
            const href = $link.attr('href')

            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

            // 1. Check strict text length
            if (text.length < 5 || text.length > 100) return

            // 2. Check for positive keywords
            const hasJobKeyword = keywords.some(k => text.includes(k))
            if (!hasJobKeyword) return

            // 3. Check for negative keywords (Strict)
            const hasExcludedText = excludedTextKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))
            if (hasExcludedText) return

            // 4. Check URL patterns
            const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
            const urlLower = fullUrl.toLowerCase()

            try {
                const urlObj = new URL(fullUrl)
                if (urlObj.hostname.startsWith('docs.') || urlObj.hostname.startsWith('help.') || urlObj.hostname.startsWith('support.') || urlObj.hostname.startsWith('status.')) return
            } catch (e) {}

            const hasExcludedUrl = excludedUrlKeywords.some(k => urlLower.includes(k))
            if (hasExcludedUrl) return

            // 5. Bonus: If URL looks like a job URL, boost confidence. 
            // If it doesn't, be extra strict about the text.
            const looksLikeJobUrl = jobUrlPatterns.some(p => urlLower.includes(p))

            // If it doesn't look like a job URL, we require the text to be very specific 
            // or we skip it to avoid "Sales Solutions" pages.
            // Actually, if we are in generic fallback, we should prefer links that look like jobs.
            // But some sites just use /page-name.
            // Let's rely on the exclusions for now.

            // Special check for "Sales" - it's dangerous.
            if (text.includes('Sales') && !text.includes('Manager') && !text.includes('Representative') && !text.includes('Executive') && !text.includes('Lead') && !text.includes('Director') && !text.includes('Associate') && !text.includes('Officer')) {
                // "Sales" alone or "Sales Solutions" is likely not a job
                return
            }

            // Special check for "Product" - dangerous
            if (text.includes('Product') && !text.includes('Manager') && !text.includes('Designer') && !text.includes('Owner') && !text.includes('Lead') && !text.includes('Director')) {
                return
            }

            jobs.push({
                title: text,
                url: fullUrl,
                location: 'Remote',
                type: 'Full-time',
                sourceType: 'trusted',
                isTrusted: true
            })
        })
    }

    // Deduplicate by URL
    const uniqueJobs = []
    const seenUrls = new Set()
    jobs.forEach(job => {
        if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url)
            uniqueJobs.push(job)
        }
    })

    return { jobs: uniqueJobs, company }
}

// Fetch detailed job information from a job posting URL
export async function fetchJobDetails(jobUrl, useAI = false) {
    if (!jobUrl) return { description: '', requirements: [], benefits: [] }

    try {
        console.log(`[job-crawler] Fetching job details from ${jobUrl}`)
        const response = await fetch(jobUrl, {
            headers: {
                // Simulate a real browser to avoid 403 blocks (especially for Himalayas, Cloudflare protected sites)
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(15000) // Increased timeout to 15s for potential AI processing
        })

        if (!response.ok) {
            // Special handling for 403 (often Cloudflare or WAF)
            if (response.status === 403) {
                console.warn(`[fetchJobDetails] 403 Forbidden for ${jobUrl}. Trying Google Cache fallback.`);

                try {
                    // Fallback: Try Google Cache
                    // Note: Google Cache is becoming less reliable, but worth a try for static content
                    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(jobUrl)}`;
                    const cacheResp = await fetch(cacheUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                            'Referer': 'https://www.google.com/'
                        },
                        signal: AbortSignal.timeout(10000)
                    });

                    if (cacheResp.ok) {
                        const cacheHtml = await cacheResp.text();
                        return parseJobHtml(cacheHtml, jobUrl, useAI);
                    }
                } catch (e) {
                    console.warn(`[fetchJobDetails] Google Cache fallback failed: ${e.message}`);
                }

                // If fallback fails, return empty
                return { description: '', requirements: [], benefits: [] }
            }
            throw new Error(`HTTP ${response.status}`)
        }

        const html = await response.text()
        const finalUrl = response.url

        // Pass finalUrl to parser to handle relative links correctly if redirected
        const result = await parseJobHtml(html, finalUrl, useAI);

        return {
            ...result,
            url: finalUrl !== jobUrl ? finalUrl : undefined // Return new URL only if changed
        }

    } catch (error) {
        console.error(`[fetchJobDetails] Error fetching ${jobUrl}:`, error.message)
        return { description: '', requirements: [], benefits: [] }
    }
}

// Helper function to parse job HTML (extracted to support fallbacks)
async function parseJobHtml(html, jobUrl, useAI = false) {
    console.log(`[parseJobHtml] Parsing HTML length: ${html.length} chars for ${jobUrl}`)
    const $ = cheerio.load(html)

    let description = ''
    let requirements = []
    let benefits = []
    let company = null
    let applyUrl = null
    let publishedAt = null

    // Strategy 1: Schema.org JobPosting (Best)
    const ldJsonScripts = $('script[type="application/ld+json"]')
    let foundInSchema = false

    ldJsonScripts.each((i, el) => {
        if (foundInSchema) return
        try {
            const json = JSON.parse($(el).text())
            const items = Array.isArray(json) ? json : [json]

            const processItem = (item) => {
                if (foundInSchema) return

                // Handle @graph
                if (item['@graph'] && Array.isArray(item['@graph'])) {
                    item['@graph'].forEach(subItem => processItem(subItem))
                    return
                }

                if (item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting') {
                    description = extractDescription(item.description || '', $)
                    if (item.url) applyUrl = item.url
                    if (item.datePosted) publishedAt = item.datePosted

                    // Extract Company Info
                    if (item.hiringOrganization) {
                        if (typeof item.hiringOrganization === 'string') {
                            company = { name: cleanText(item.hiringOrganization) }
                        } else if (item.hiringOrganization.name) {
                            company = {
                                name: cleanText(item.hiringOrganization.name),
                                logo: item.hiringOrganization.logo,
                                url: item.hiringOrganization.url
                            }
                        }
                    }

                    // Parse responsibilities and qualifications
                    if (item.responsibilities) {
                        const resp = Array.isArray(item.responsibilities)
                            ? item.responsibilities
                            : [item.responsibilities]
                        requirements.push(...resp.map(r => cleanText(String(r))))
                    }

                    if (item.qualifications) {
                        const quals = Array.isArray(item.qualifications)
                            ? item.qualifications
                            : [item.qualifications]
                        requirements.push(...quals.map(q => cleanText(String(q))))
                    }

                    if (item.jobBenefits) {
                        const bens = Array.isArray(item.jobBenefits)
                            ? item.jobBenefits
                            : [item.jobBenefits]
                        benefits.push(...bens.map(b => cleanText(String(b))))
                    }

                    foundInSchema = true
                }
            }

            items.forEach(processItem)
        } catch (e) {
            // Ignore parse errors
        }
    })

    if (foundInSchema && description) {
        return { description, requirements, benefits, company, applyUrl, publishedAt }
}

    // Strategy 1.4: Next.js Hydration Data (for detail pages)
    // Many Next.js sites (like Himalayas) contain full job data in the hydration script
    const nextData = $('#__NEXT_DATA__').first()
    if (nextData.length > 0 && (!description || description.length < 100)) {
        try {
            const json = JSON.parse(nextData.text())
            // Helper to recursively find description
            const findDescription = (obj) => {
                if (!obj || typeof obj !== 'object') return null

                // Check for common description fields
                if (obj.description && typeof obj.description === 'string' && obj.description.length > 500) {
                    return obj.description
                }
                if (obj.body && typeof obj.body === 'string' && obj.body.length > 500) {
                    return obj.body
                }
                if (obj.content && typeof obj.content === 'string' && obj.content.length > 500) {
                    return obj.content
                }

                // Check for Himalayas specific structure (often inside props.pageProps.job)
                if (obj.job && obj.job.description) return obj.job.description

                // Recurse
                for (const key in obj) {
                    const res = findDescription(obj[key])
                    if (res) return res
                }
                return null
            }

            const foundDesc = findDescription(json)
            if (foundDesc) {
                // If it's HTML, we might want to clean it or keep it. 
                // cleanText handles HTML tags removal usually.
                // But let's check if it's HTML-escaped.
                description = extractDescription(foundDesc, $)
                console.log(`[fetchJobDetails] Extracted description from Next.js data (${description.length} chars)`)
            }
        } catch (e) {
            // ignore
        }
    }

    // Strategy 1.5: Ashby __appData (if Schema.org failed or missing)
    // Some Ashby pages might expose data in __appData even on detail pages
    const appDataMatch = html.match(/window\.__appData\s*=\s*({[^;]+});/)
    if (appDataMatch && appDataMatch[1]) {
        try {
            const appData = JSON.parse(appDataMatch[1])
            if (appData.jobPosting) {
                if (appData.jobPosting.descriptionHtml) {
                    description = extractDescription(appData.jobPosting.descriptionHtml, $)
                } else if (appData.jobPosting.description) {
                    description = extractDescription(appData.jobPosting.description, $)
                }
            } else if (appData.posting) {
                // Fallback for different Ashby structure (e.g. Chainlink Labs)
                if (appData.posting.descriptionHtml) {
                    description = extractDescription(appData.posting.descriptionHtml, $)
                } else if (appData.posting.description) {
                    description = extractDescription(appData.posting.description, $)
                } else if (appData.posting.descriptionPlainText) {
                    description = appData.posting.descriptionPlainText
                }
            }
        } catch (e) {
            // ignore
        }
    }

    if (description && description.length > 100) {
        return { description, requirements, benefits }
    }

    // Strategy 1.6: Meta Tags (Common for SPAs like Workable)
    if (!description) {
        const metaDesc = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content')
        if (metaDesc && metaDesc.length > 50) {
            description = cleanMultilineText(metaDesc)
        }
    }

    // Extract published date from meta tags if not found yet
    if (!publishedAt) {
        publishedAt = $('meta[property="article:published_time"]').attr('content') ||
                      $('meta[name="date"]').attr('content') ||
                      $('meta[itemprop="datePosted"]').attr('content')
    }

    // Strategy 2: Platform-specific selectors
    // Workable (apply.workable.com)
    if (jobUrl.includes('workable.com')) {
        // Workable uses specific class names for job sections
        const sections = []

        // Description section
        const descSection = $('[data-ui="job-description"], .description, [class*="description"]').first()
        if (descSection.length > 0) {
            const descText = extractDescription(descSection, $)
            if (descText.length > 50) {
                sections.push(descText)
            }
        }

        // Requirements/Qualifications
        $('[data-ui="requirements"], [data-ui="qualifications"], .requirements, .qualifications').each((i, el) => {
            const text = extractDescription($(el), $)
            if (text.length > 20) {
                sections.push(text)
            }
        })

        // Benefits
        $('[data-ui="benefits"], .benefits, [class*="benefit"]').each((i, el) => {
            const text = extractDescription($(el), $)
            if (text.length > 20) {
                sections.push(text)
            }
        })

        // If we found sections, combine them
        if (sections.length > 0) {
            description = sections.join('\n\n')
        }

        // Try to extract list items from the entire page if description is still empty
        if (!description || description.length < 100) {
            // Get main content area
            const mainContent = $('main, [role="main"], article, .content, #content').first()
            if (mainContent.length > 0) {
                const contentText = extractDescription(mainContent, $)
                if (contentText.length > 100) {
                    description = contentText
                }
            }
        }
    }

    // Strategy 2: Specific Site Parsers (AlphaSights, etc)
    if (jobUrl.includes('alphasights.com')) {
        console.log(`[fetchJobDetails] Using AlphaSights specific extractor`)

        // Priority 1: #single-role container (verified)
        const singleRole = $('#single-role');

        if (singleRole.length > 0) {
            // IMPORTANT: Clone first to avoid modifying the global cheerio object if we need it later (though here it's fine)
            // But we must remove the application section (Greenhouse form) which is HUGE and noisy
            const container = singleRole.clone();

            // Remove known noise
            container.find('#application-section').remove(); // The huge Greenhouse form
            container.find('.role-application').remove();
            container.find('form').remove();
            container.find('script, style, noscript, button, input, select').remove();
            container.find('a[href*="open-roles"]').remove(); // Back links
            container.find('a[href*="#application-section"]').remove(); // Apply anchor links

            // Now try to find the content column
            // Structure is usually: #single-role > .container > .row > .col-md-10
            // Since we removed the application section, the remaining text should be the description

            let text = extractDescription(container, $);

            // If text is still too long (e.g. some other hidden junk), try to narrow down to .col-md-10
            const col10 = container.find('.col-md-10, .col-12');
            if (col10.length > 0) {
                // There might be multiple columns (e.g. header row, content row)
                // We pick the one with the most reasonable length text
                let bestText = '';
                let maxLen = 0;

                col10.each((i, el) => {
                    const t = extractDescription($(el), $);
                    // Prefer substantial text but not insane length (application form was ~160k)
                    if (t.length > 100 && t.length < 20000) {
                        if (t.length > maxLen) {
                            maxLen = t.length;
                            bestText = t;
                        }
                    }
                });

                if (bestText) {
                    text = bestText;
                }
            }

            if (text.length > 100) {
                description = text;
                console.log(`[fetchJobDetails] AlphaSights: Extracted ${description.length} chars from #single-role (after cleanup)`)
            }
        }
    }

    // Strategy 3: Generic selectors for job description
    if (!description || description.length < 100) {
        const descriptionSelectors = [
            // Specifics for Eigen AI and Osome/Teamtailor (Prioritize these)
            '.rich-text', '.prose', '.job-detail',
            '.job-description', '.description', '[class*="description"]',
            '.job-details', '[class*="details"]',
            '.content', '[class*="content"]',
            'article', 'main', '[role="main"]'
        ]

        for (const selector of descriptionSelectors) {
            const elem = $(selector).first()
            if (elem.length > 0) {
                const text = extractDescription(elem, $)
                if (text.length > 100) { // Ensure it's substantial
                    description = text
                    console.log(`[fetchJobDetails] Matched selector: ${selector}`)
                    break
                }
            }
        }
    }

    // Strategy 4: Extract structured lists (requirements, benefits)
    if (!description || description.length < 100) {
        // Sometimes the description is split across multiple sections
        const allSections = []

        $('section, .section, [class*="section"]').each((i, el) => {
            const sectionText = extractDescription($(el), $)
            if (sectionText.length > 50 && sectionText.length < 5000) {
                allSections.push(sectionText)
            }
        })

        if (allSections.length > 0) {
            description = allSections.join('\n\n')
        }
    }

    // Extract requirements from lists
    const requirementSelectors = [
        '.requirements li', '.qualifications li',
        '[class*="requirement"] li', '[class*="qualification"] li',
        '[data-ui="requirements"] li', '[data-ui="qualifications"] li'
    ]

    for (const selector of requirementSelectors) {
        const items = $(selector)
        if (items.length > 0) {
            items.each((i, el) => {
                const text = cleanText($(el).text())
                if (text && text.length > 5 && text.length < 500) {
                    requirements.push(text)
                }
            })
            if (requirements.length > 0) break
        }
    }

    // Extract benefits from lists
    const benefitSelectors = [
        '.benefits li', '.perks li',
        '[class*="benefit"] li', '[class*="perk"] li',
        '[data-ui="benefits"] li'
    ]

    for (const selector of benefitSelectors) {
        const items = $(selector)
        if (items.length > 0) {
            items.each((i, el) => {
                const text = cleanText($(el).text())
                if (text && text.length > 5 && text.length < 500) {
                    benefits.push(text)
                }
            })
            if (benefits.length > 0) break
        }
    }

    // Strategy 5: AI Fallback (Bailian)
    // If we still don't have a description and AI is enabled
    if ((!description || description.length < 100) && useAI) {
        try {
            const { extractJobDescriptionFromHtml, isAiAvailable } = await import('./bailian-parser.js')
            if (isAiAvailable()) {
                console.log(`[fetchJobDetails] Selectors failed, attempting AI extraction for ${jobUrl}`)
                // Use text content of body to save tokens, but keep some structure
                const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
                // Or maybe better: simplified HTML
                // Removing scripts, styles, svgs to reduce noise
                $('script, style, svg, noscript, iframe').remove()
                const simplifiedHtml = $('body').html() || ''
                // Limit input size
                const inputContent = simplifiedHtml.length < 30000 ? simplifiedHtml : bodyText

                const aiDescription = await extractJobDescriptionFromHtml(inputContent)
                if (aiDescription) {
                    description = aiDescription
                    console.log(`[fetchJobDetails] AI successfully extracted description (${description.length} chars)`)
                }
            }
        } catch (e) {
            console.error('[fetchJobDetails] AI extraction failed:', e.message)
        }
    }

    // Truncate if too long (Increased limit to 20000 to avoid cutting off long JDs)
    if (description && description.length > 20000) {
        description = description.substring(0, 20000) + '...'
    }

    console.log(`[fetchJobDetails] Extracted ${description.length} chars for ${jobUrl}`)

    return {
        description: description || '',
        requirements: requirements.slice(0, 20), // Limit to 20 items
        benefits: benefits.slice(0, 20),
        company, // Include company info if found (e.g. from schema)
        applyUrl, // Return extracted apply URL
        publishedAt
    }
}

export async function crawlCompanyJobs(companyId, companyName, careersUrl, options = {}) {
    if (!careersUrl) throw new Error('No careers URL provided')

    // Common ATS domains to check against before applying hardcoded fixes
    const atsDomains = [
        'greenhouse.io', 'ashbyhq.com', 'lever.co', 'smartrecruiters.com', 
        'workday.com', 'myworkdayjobs.com', 'jobvite.com', 'recruitee.com', 
        'bamboohr.com', 'pinpointhq.com', 'workable.com', 'fountain.com', 'paradox.ai'
    ]
    const isKnownAtsUrl = atsDomains.some(d => careersUrl.includes(d))

    // Specific Fix for Braintrust (which uses a complex Next.js App Router setup wrapping Ashby)
    // We switch to their direct Ashby board for reliable crawling
    // UPDATE: The user explicitly wants to crawl the platform URL (employers/2) via API, so we disable this override.
    // if ((careersUrl.includes('braintrust.dev') || careersUrl.includes('usebraintrust.com')) && !isKnownAtsUrl) {
    //    console.log('[JobCrawler] Braintrust detected, switching to Ashby board for reliable crawling')
    //    careersUrl = 'https://jobs.ashbyhq.com/braintrust'
    // }

    // Specific Fix for TED (which uses SmartRecruiters but embedded/linked from main site)
    if ((careersUrl.includes('ted.com') && careersUrl.includes('jobs')) && !isKnownAtsUrl) {
        console.log('[JobCrawler] TED detected, switching to SmartRecruiters board')
        careersUrl = 'https://careers.smartrecruiters.com/TEDConferencesLLC'
    }

    // Specific Fix for Frec (which uses Ashby, not Greenhouse)
    // Keep original check for greenhouse.io/frec as it's a specific fix for a broken link, 
    // but allow other ATS links
    if (careersUrl.includes('greenhouse.io/frec') && !careersUrl.includes('ashbyhq.com')) {
        console.log('[JobCrawler] Frec detected with Greenhouse URL, switching to Ashby board')
        careersUrl = 'https://jobs.ashbyhq.com/frec'
    }

    // Specific Fix for Mixrank (Dover API is protected, use YC fallback)
    if (careersUrl.includes('dover.com/jobs/mixrank') && !careersUrl.includes('ycombinator.com')) {
        console.log('[JobCrawler] Mixrank detected, switching to YCombinator board')
        careersUrl = 'https://www.ycombinator.com/companies/mixrank/jobs'
    }

    // Specific Fix for Taskade (Use YCombinator for better data quality)
    // Update: YC data is outdated. We now use the direct site parser below.
    // if ((companyName === 'Taskade' || careersUrl.includes('taskade.com')) && !isKnownAtsUrl) {
    //    console.log('[JobCrawler] Taskade detected, switching to YCombinator board')
    //    careersUrl = 'https://www.ycombinator.com/companies/taskade/jobs'
    // }

    // Ensure Taskade uses the /jobs page for the direct parser to work
    if ((companyName === 'Taskade' || careersUrl.includes('taskade.com')) && !careersUrl.includes('/jobs')) {
         console.log('[JobCrawler] Taskade detected, enforcing /jobs URL');
         careersUrl = 'https://www.taskade.com/jobs';
    }

    // Specific Fix for Grafana Labs (Use Greenhouse)
    if ((companyName === 'Grafana Labs' || careersUrl.includes('grafana.com')) && !isKnownAtsUrl) {
        console.log('[JobCrawler] Grafana Labs detected, switching to Greenhouse board')
        careersUrl = 'https://job-boards.greenhouse.io/grafanalabs'
    }

    // Specific Fix for Docker (Use Ashby)
    if ((companyName === 'Docker' || careersUrl.includes('docker.com')) && !isKnownAtsUrl) {
        console.log('[JobCrawler] Docker detected, switching to Ashby board')
        careersUrl = 'https://jobs.ashbyhq.com/docker'
    }

    // Specific Fix for Progress Chef (Use Jobvite board)
    if ((companyName === 'Progress Chef' || careersUrl.includes('chef.io') || companyName === 'Progress Software' || careersUrl.includes('progress.com')) && !isKnownAtsUrl) {
        console.log('[JobCrawler] Progress Chef detected, switching to Jobvite board')
        careersUrl = 'https://jobs.jobvite.com/progress/jobs'
    }

    // Specific Fix for Canonical: Use Greenhouse API directly for better data
    if ((companyName === 'Canonical' || careersUrl.includes('canonical.com')) && !isKnownAtsUrl) {
        console.log('[JobCrawler] Canonical detected, using Greenhouse API for full details')
        try {
            const apiUrl = 'https://boards-api.greenhouse.io/v1/boards/canonical/jobs?content=true'
            const apiRes = await fetch(apiUrl)
            if (apiRes.ok) {
                const data = await apiRes.json()
                if (data.jobs) {
                    const jobs = data.jobs.map(job => {
                        // Decode HTML entities in content
                        let description = job.content || ''
                        if (description) {
                            const $ = cheerio.load(description)
                            description = $.text() // First pass decodes HTML entities (e.g. &lt;h3&gt; -> <h3>)
                            // Note: We keep the HTML tags because the system supports it and it's better for JDs.
                            // If we wanted plain text, we would call $.text() again or cleanText().
                            // But usually JDs are better with HTML.
                            // Wait, if it was &lt;h3&gt;, $.text() gives <h3>...</h3>. That IS the HTML.
                        }

                        return {
                            title: job.title,
                            url: job.absolute_url,
                            location: job.location?.name || 'Remote',
                            type: 'Full-time', // Greenhouse doesn't always have type in this endpoint
                            description: description, 
                            publishedAt: job.updated_at || job.created_at,
                            sourceType: 'trusted',
                            isTrusted: true
                        }
                    })
                    
                    console.log(`[JobCrawler] Fetched ${jobs.length} jobs from Canonical API`)
                    
                    // Proceed to enrichment directly
                    // We duplicate the enrichment logic here to return early
                     const enrichedJobs = jobs.map(job => ({
                        ...job,
                        companyId,
                        id: job.id || `crawled_${companyId}_${hash(job.url)}`,
                        updatedAt: new Date().toISOString(),
                        category: ClassificationService.classifyJob(job.title, job.description),
                        experienceLevel: ClassificationService.determineExperienceLevel(job.title, job.description)
                    }))

                    const filteredJobs = enrichedJobs.filter(job => !ClassificationService.isExplicitlyOverseas(job.location))
                    
                    // Filter out jobs older than 30 days (Canonical API returns updated_at)
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    
                    const dateFilteredJobs = filteredJobs.filter(job => {
                        if (!job.publishedAt) return true; // Keep if no date (User request)
                        try {
                            const pubDate = new Date(job.publishedAt);
                            // Check if valid date
                            if (isNaN(pubDate.getTime())) return true; // Keep if invalid date
                            return pubDate >= thirtyDaysAgo;
                        } catch (e) {
                            return true; // Keep on error
                        }
                    });

                    if (filteredJobs.length > dateFilteredJobs.length) {
                        console.log(`[JobCrawler] Filtered out ${filteredJobs.length - dateFilteredJobs.length} jobs older than 30 days (Canonical API)`);
                    }

                    return {
                        jobs: dateFilteredJobs,
                        company: null
                    }
                }
            }
        } catch (e) {
            console.error('[JobCrawler] Canonical API failed, falling back to page crawl', e)
        }
    }

    // Specific Fix for Bragi (Uses BambooHR but URL in DB is likely bragi.com)
    if ((companyName === 'Bragi' || careersUrl.includes('bragi.com')) && !careersUrl.includes('bamboohr.com')) {
        console.log('[JobCrawler] Bragi detected, switching to BambooHR board')
        careersUrl = 'https://bragi.bamboohr.com/jobs'
    }

    // Specific Fix for Osome
    if ((companyName === 'Osome' || careersUrl.includes('osome.com')) && !isKnownAtsUrl && !careersUrl.includes('/careers')) {
        console.log('[JobCrawler] Osome detected, ensuring valid careers URL')
        careersUrl = 'https://osome.com/careers/'
    }


    // Specific Fix for Stripe (Custom HTML Parser)
    if (companyName === 'Stripe' || careersUrl.includes('stripe.com')) {
        console.log('[JobCrawler] Stripe detected, using custom parser')
        // Stripe uses a table-like structure but div based usually, or hydration. 
        // Based on test script: It has <a> links with href^="/jobs/listing/" and location is in the container.
        // Test script output shows location is extractable.
        
        const stripeJobs = []
        $('a[href^="/jobs/listing/"]').each((i, el) => {
            const $el = $(el)
            const title = cleanText($el.text())
            const href = $el.attr('href')
            
            // Location extraction based on visual layout (Title | Team | Location)
            // It seems to be in a table row (tr -> td) based on test script assumption, or flex container.
            // Let's look for siblings.
            // The test script found location in: container.find('td').eq(2)
            // So it IS a table or table-like structure.
            
            let location = 'Remote'
            const container = $el.closest('tr')
            if (container.length > 0) {
                // Table structure: [Title] [Team] [Location]
                const locEl = container.find('td').eq(2)
                if (locEl.length > 0) {
                    location = cleanText(locEl.text())
                }
            } else {
                // Fallback for non-table layout (mobile/flex)
                // Try finding the nearest location element
                const parent = $el.closest('div[class*="TableRow"]')
                if (parent.length > 0) {
                     const locEl = parent.find('span').last() // Usually last span is location
                     if (locEl.length > 0) location = cleanText(locEl.text())
                }
            }

            if (title && href) {
                stripeJobs.push({
                    title,
                    url: href.startsWith('http') ? href : `https://stripe.com${href}`,
                    location: location || 'Remote', // Use extracted location
                    type: 'Full-time',
                    description: '', // Will be fetched via details
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })

        if (stripeJobs.length > 0) {
            console.log(`[JobCrawler] Stripe parser found ${stripeJobs.length} jobs`)
            return { jobs: stripeJobs, company }
        }
    }

    // Specific Fix for Fueled (Use HTML parser)
    // Force usage of custom parser and main careers page for reliability
    if (companyName === 'Fueled' || careersUrl.includes('fueled.com') || careersUrl.includes('fueledcareers')) {
        console.log('[JobCrawler] Fueled detected, enforcing correct careers page and custom parser');
        // Force correct URL to the one our custom parser understands
        careersUrl = 'https://fueled.com/careers';

        // We can use a custom parser because we analyzed the HTML structure
        // Structure: .wp-block-fueled-role-card__title a
        // Location: .wp-block-fueled-role-card__location
        
        // We need to fetch the page first.
        // Since we are inside crawlCompanyJobs, we can return a custom object to skip the generic fetch if we do the fetching here.
        // OR we can let the generic fetch happen and just use a custom parser logic inside parseJobsFromHtml?
        // But parseJobsFromHtml is a separate function.
        // The pattern used for Stripe is to do the fetching/parsing inside this block if possible, 
        // OR return a custom object if we can do it all here.
        
        // Let's do the fetch here to be safe and precise.
        try {
            const res = await fetch(careersUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                }
            });
            const html = await res.text();
            const $ = cheerio.load(html);
            const fueledJobs = [];
            
            // Find all job cards
            // Based on snippet: <h2 class="... role-card__title ..."> <a ...>
            // We can target the links inside the title class
            $('.wp-block-fueled-role-card__title a').each((i, el) => {
                const $el = $(el);
                const title = cleanText($el.text());
                const href = $el.attr('href');
                let location = 'Remote';
                
                // Try to find the location span in the footer
                // Structure: h2 (title) ... div (footer) > span (location)
                // They might be siblings or inside a common container.
                // We need to find the common container.
                // Assuming h2 is inside a container or we can traverse.
                // Snippet: h2 ... div.footer.
                // They seem to be siblings or in a block.
                // Let's try to find the container.
                const card = $el.closest('div[class*="role-card"], .wp-block-post');
                if (card.length > 0) {
                    const locEl = card.find('.wp-block-fueled-role-card__location');
                    if (locEl.length > 0) {
                        location = cleanText(locEl.text());
                    }
                } else {
                     // Fallback: Try next sibling of h2's parent?
                     // Or just use generic title extraction later.
                }

                // Extract location from Title (Fueled specific: "Role — Location")
                // Use em-dash, en-dash, or hyphen
                const titleParts = title.split(/[-–—]/).map(p => p.trim());
                if (titleParts.length > 1) {
                    const potentialLoc = titleParts[titleParts.length - 1];
                    // If the suffix is a known location or looks like one (and not "Remote" if we already have it)
                    if (potentialLoc.length > 2 && !['Senior', 'Lead', 'Junior', 'Contract', 'Freelance'].includes(potentialLoc)) {
                        location = potentialLoc;
                    }
                }

                if (title && href) {
                    fueledJobs.push({
                        title,
                        url: href.startsWith('http') ? href : `https://fueled.com${href}`,
                        location: location,
                        type: 'Full-time', // Default
                        description: '',
                        sourceType: 'trusted',
                        isTrusted: true
                    });
                }
            });
            
            if (fueledJobs.length > 0) {
                console.log(`[JobCrawler] Fueled parser found ${fueledJobs.length} jobs`);
                return { jobs: fueledJobs, company: null };
            }
        } catch (e) {
            console.error('[JobCrawler] Fueled custom parser failed:', e);
            // Fallthrough to generic
        }
    }

    const { fetchDetails = false, maxDetailFetches = 10, concurrency = 3, useAI = false } = options

    console.log(`[JobCrawler] Crawling ${careersUrl} for company ${companyId} (${companyName})`)
    if (fetchDetails) {
        console.log(`[JobCrawler] Detail fetching enabled (max: ${maxDetailFetches}, concurrency: ${concurrency})`)
    }
    if (useAI) {
        console.log(`[JobCrawler] AI enhancement enabled (Bailian)`)
    }

    try {
        const response = await fetch(careersUrl, {
            headers: {
                // Simulate a real browser to avoid 403 blocks
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(30000) // 30s timeout to prevent hanging
        })

        if (!response.ok) throw new Error(`Failed to fetch career page: ${response.status}`)

        const html = await response.text()

        // parseJobsFromHtml now returns { jobs, company }
        const parseResult = await parseJobsFromHtml(html, careersUrl, companyId)

        // Handle both return formats (array or object) for backward compatibility if needed, 
        // though we updated parseJobsFromHtml to always return object.
        const jobs = Array.isArray(parseResult) ? parseResult : (parseResult.jobs || [])
        const companyInfo = !Array.isArray(parseResult) ? parseResult.company : null

        console.log(`[JobCrawler] Found ${jobs.length} jobs for ${companyId}`)
        if (companyInfo) {
            console.log(`[JobCrawler] Extracted company info: ${companyInfo.name}`)
        }

        // 🆕 Location Extraction Enhancement (Title Based) - Applied to ALL jobs
        // If location is "Remote" (default) or "Unspecified", try to extract from Title
        jobs.forEach(job => {
            if (job.location === 'Remote' || job.location === 'Unspecified') {
                // 1. Try extracting from Title (e.g. "Senior Engineer - London")
                // Use strict separator (space-hyphen-space) to avoid splitting "Full-Stack", "Co-Founder", etc.
                const titleParts = job.title.split(/\s+[-–—|]\s+/).map(p => p.trim())
                
                // Debug log to trace why it splits
                // if (titleParts.length > 1) console.log(`[JobCrawler] Title split debug: "${job.title}" -> ${JSON.stringify(titleParts)}`);

                if (titleParts.length > 1) {
                    const potentialLoc = titleParts[titleParts.length - 1]
                    // Simple heuristic: If it looks like a location (Capitalized, not "Remote" or "Manager")
                    if (potentialLoc.length > 2 && potentialLoc.length < 30 && /^[A-Z]/.test(potentialLoc)) {
                        // Check for common role keywords to avoid false positives
                        const roleKeywords = ['Manager', 'Director', 'Lead', 'Engineer', 'Developer', 'Remote', 'Full-time', 'Contract', 'Intern', 'Specialist', 'Designer'];
                        const isRole = roleKeywords.some(kw => potentialLoc.includes(kw) || potentialLoc === kw);
                        
                        // console.log(`[JobCrawler] Checking potential loc: "${potentialLoc}", isRole: ${isRole}`);

                        if (!isRole) {
                            console.log(`[JobCrawler] Extracted location from title: ${potentialLoc}`)
                            job.location = potentialLoc
                        }
                    }
                }
            }
        })

        // Fetch detailed information if enabled
        if (fetchDetails && jobs.length > 0) {
            const jobsToFetch = jobs.slice(0, maxDetailFetches)
            console.log(`[JobCrawler] Fetching details for ${jobsToFetch.length} jobs...`)

            // Optional AI enhancement
            if (useAI) {
                try {
                    // User Feedback 2026-01-07: Use Bailian Parser as primary (more reliable)
                    const { enhanceJobDescription, isAiAvailable } = await import('./bailian-parser.js')
                    // Fetch in batches with concurrency control
                    for (let i = 0; i < jobsToFetch.length; i += concurrency) {
                        const batch = jobsToFetch.slice(i, i + concurrency)
                        const batchResults = await Promise.all(
                            batch.map(async (job, idx) => {
                                const details = await fetchJobDetails(job.url, useAI)
                                // Always merge details (even if empty) to ensure they're set
                                job.description = details.description || job.description || ''
                                job.requirements = (details.requirements && details.requirements.length > 0) 
                                    ? details.requirements 
                                    : (job.requirements || [])
                                job.benefits = (details.benefits && details.benefits.length > 0)
                                    ? details.benefits
                                    : (job.benefits || [])
                                
                                // 🆕 Location Extraction Enhancement
                                // If location is "Remote" (default) or "Unspecified", try to extract from Description
                                if (job.location === 'Remote' || job.location === 'Unspecified') {
                                    // 2. Try extracting from Description (if still Remote)
                                    // Look for "Location: X" or "Based in X"
                                    if (job.location === 'Remote' && job.description) {
                                        const locMatch = job.description.match(/(?:Location|Based in|Office)[:：]\s*([^<\n\r]+)/i)
                                        if (locMatch && locMatch[1]) {
                                            let extracted = locMatch[1].trim().replace(/\.$/, '')
                                            if (extracted.length < 50) {
                                                console.log(`[JobCrawler] Extracted location from description: ${extracted}`)
                                                job.location = extracted
                                            }
                                        }
                                    }
                                }

                                // Optional AI enhancement
                                if (job.description && job.description.length > 100) {
                                    try {
                                        if (isAiAvailable()) {
                                            console.log(`[JobCrawler] Enhancing job with AI (Bailian): ${job.title}`)
                                            await enhanceJobDescription(job)
                                        } else {
                                            console.log(`[JobCrawler] AI API not available, skipping enhancement`)
                                        }
                                    } catch (error) {
                                        console.error(`[JobCrawler] AI enhancement failed for ${job.title}:`, error.message)
                                    }
                                }

                                console.log(`[JobCrawler] Fetched details for job ${i + idx + 1}/${jobsToFetch.length}: ${job.title} (${job.description?.length || 0} chars)`)
                                return job
                            })
                        )
                    }
                } catch (e) {
                    console.error('[JobCrawler] Failed to load AI parser:', e)
                }
            } else {
                // Fetch in batches with concurrency control (Original logic without AI import)
                for (let i = 0; i < jobsToFetch.length; i += concurrency) {
                    const batch = jobsToFetch.slice(i, i + concurrency)
                    const batchResults = await Promise.all(
                        batch.map(async (job, idx) => {
                            const details = await fetchJobDetails(job.url, useAI)
                            // Always merge details (even if empty) to ensure they're set
                            job.description = details.description || job.description || ''
                            job.requirements = (details.requirements && details.requirements.length > 0)
                                ? details.requirements
                                : (job.requirements || [])
                            job.benefits = (details.benefits && details.benefits.length > 0)
                                ? details.benefits
                                : (job.benefits || [])

                            if (details.publishedAt) job.publishedAt = details.publishedAt

                            console.log(`[JobCrawler] Fetched details for job ${i + idx + 1}/${jobsToFetch.length}: ${job.title} (${job.description?.length || 0} chars)`)
                            return job
                        })
                    )
                    
                    // Add a small random delay between batches to be polite
                    if (i + concurrency < jobsToFetch.length) {
                        const delay = 1000 + Math.random() * 2000;
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }
            console.log(`[JobCrawler] Detail fetching complete`)
        }



        // Enrich with companyId
        const enrichedJobs = jobs.map(job => ({
            ...job,
            companyId,
            // Use existing ID if available (e.g. from Ashby parser), otherwise generate one
            id: job.id || `crawled_${companyId}_${hash(job.url)}`,
            // id: job.id || `crawled_${companyId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            updatedAt: new Date().toISOString(),
            category: ClassificationService.classifyJob(job.title, job.description),
            experienceLevel: ClassificationService.determineExperienceLevel(job.title, job.description),
            timezone: ClassificationService.extractTimezone(job.location + ' ' + job.description)
        }))

        // Filter out explicitly overseas jobs
        // 2026-01-16 Update: Also check title for overseas keywords (e.g. "India Contractor", "Brazil")
        const filteredJobs = enrichedJobs.filter(job => 
            !ClassificationService.isExplicitlyOverseas(job.location) && 
            !ClassificationService.isExplicitlyOverseas(job.title)
        )
        
        if (enrichedJobs.length > filteredJobs.length) {
            console.log(`[JobCrawler] Filtered out ${enrichedJobs.length - filteredJobs.length} explicitly overseas jobs (from ${enrichedJobs.length} to ${filteredJobs.length})`)
        }

        // Filter out jobs older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const dateFilteredJobs = filteredJobs.filter(job => {
            // Exception for Taskade (YC jobs might be old but active)
            if (companyName === 'Taskade') return true;

            if (!job.publishedAt) return true; // Keep if no date
            try {
                const pubDate = new Date(job.publishedAt);
                // Check if valid date
                if (isNaN(pubDate.getTime())) return true;
                return pubDate >= thirtyDaysAgo;
            } catch (e) {
                return true; // Keep if date invalid
            }
        });

        if (filteredJobs.length > dateFilteredJobs.length) {
            console.log(`[JobCrawler] Filtered out ${filteredJobs.length - dateFilteredJobs.length} jobs older than 30 days`);
        }

        return {
            jobs: dateFilteredJobs,
            company: companyInfo
        }

    } catch (error) {
        console.error(`[JobCrawler] Error crawling ${careersUrl}:`, error)
        return { jobs: [], company: null }
    }
}
