

import * as cheerio from 'cheerio'
import { parseAshbyJobs, isAshbyJobBoard } from './ashby-parser.js'
import { parseWorkableJobs, isWorkableJobBoard } from './workable-parser.js'
import { ClassificationService } from './services/classification-service.js' 

// Helper to clean text
const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : ''

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
        } catch(e) {}
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

    // Strategy 0.3: Eigen AI (Custom Parser)
    if (baseUrl.includes('eigenai.com')) {
        console.log('[job-crawler] Detected Eigen AI job board')
        const eigenJobs = []
        $('.role-card').each((i, el) => {
            const $el = $(el)
            const title = cleanText($el.find('.role-card__title').text())
            const description = cleanText($el.find('.role-card__description').text())
            const link = $el.find('.role-card__cta').attr('href')
            const tags = []
            $el.find('.role-card__tag').each((j, tag) => {
                tags.push(cleanText($(tag).text()))
            })

            if (title && link) {
                eigenJobs.push({
                    title,
                    url: link.startsWith('http') ? link : new URL(link, baseUrl).toString(),
                    location: 'Remote', // Eigen AI seems to be remote-first/distributed, or we can assume Remote based on context
                    type: 'Full-time',
                    description, // Brief description from card
                    tags,
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

    // Strategy 0.4: Pinpoint Job Board
    if (baseUrl.includes('pinpointhq.com')) {
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
             } catch(e) {}
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

    // Strategy 1: Next.js / Nuxt.js Hydration Data (Very High Confidence)
    const nextData = $('#__NEXT_DATA__, #__NUXT__').first()
    if (nextData.length > 0) {
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

    // Strategy 2: Schema.org JobPosting (High Confidence)
    if (jobs.length === 0) {
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
            'Share', 'Tweet', 'Like', 'Follow', 'Subscribe', 'Email', 'Print', 'RSS', 'PDF'
        ]

        const excludedUrlKeywords = [
            '/blog/', '/news/', '/article/', '/product/', '/solution/', '/contact', '/about', 
            '/login', '/signin', '/signup', '/register', '/pricing', '/demo', '/resources', 
            '/case-studies', '/webinars', '/events', '/team', '/partners', '/community', 
            '/help', '/support', '/status', '/security', '/terms', '/privacy', '/cookies',
            '/records/', '/publication/', '/research/', '/whitepaper/' // Specific for research sites like Zenodo
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
    try {
        const response = await fetch(jobUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(15000) // Increased timeout to 15s for potential AI processing
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        let description = ''
        let requirements = []
        let benefits = []
        let company = null

        // Strategy 1: Schema.org JobPosting (Best)
        const ldJsonScripts = $('script[type="application/ld+json"]')
        let foundInSchema = false

        ldJsonScripts.each((i, el) => {
            if (foundInSchema) return
            try {
                const json = JSON.parse($(el).text())
                const items = Array.isArray(json) ? json : [json]

                items.forEach(item => {
                    if (item['@type'] === 'JobPosting') {
                        description = cleanText(item.description || '')

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
                })
            } catch (e) {
                // Ignore parse errors
            }
        })

        if (foundInSchema && description) {
            return { description, requirements, benefits, company }
        }

        // Strategy 1.5: Ashby __appData (if Schema.org failed or missing)
        // Some Ashby pages might expose data in __appData even on detail pages
        const appDataMatch = html.match(/window\.__appData\s*=\s*({[^;]+});/)
        if (appDataMatch && appDataMatch[1]) {
            try {
                const appData = JSON.parse(appDataMatch[1])
                if (appData.jobPosting && appData.jobPosting.descriptionHtml) {
                    description = cleanText(appData.jobPosting.descriptionHtml)
                } else if (appData.jobPosting && appData.jobPosting.description) {
                    description = cleanText(appData.jobPosting.description)
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
                description = cleanText(metaDesc)
            }
        }

        // Strategy 2: Platform-specific selectors
        // Workable (apply.workable.com)
        if (jobUrl.includes('workable.com')) {
            // Workable uses specific class names for job sections
            const sections = []

            // Description section
            const descSection = $('[data-ui="job-description"], .description, [class*="description"]').first()
            if (descSection.length > 0) {
                const descText = cleanText(descSection.text())
                if (descText.length > 50) {
                    sections.push(descText)
                }
            }

            // Requirements/Qualifications
            $('[data-ui="requirements"], [data-ui="qualifications"], .requirements, .qualifications').each((i, el) => {
                const text = cleanText($(el).text())
                if (text.length > 20) {
                    sections.push(text)
                }
            })

            // Benefits
            $('[data-ui="benefits"], .benefits, [class*="benefit"]').each((i, el) => {
                const text = cleanText($(el).text())
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
                    const contentText = cleanText(mainContent.text())
                    if (contentText.length > 100) {
                        description = contentText
                    }
                }
            }
        }

        // Strategy 3: Generic selectors for job description
        if (!description || description.length < 100) {
            const descriptionSelectors = [
                '.job-description', '.description', '[class*="description"]',
                '.job-details', '[class*="details"]',
                '.content', '[class*="content"]',
                'article', 'main', '[role="main"]'
            ]

            for (const selector of descriptionSelectors) {
                const elem = $(selector).first()
                if (elem.length > 0) {
                    const text = cleanText(elem.text())
                    if (text.length > 100) { // Ensure it's substantial
                        description = text
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
                const sectionText = cleanText($(el).text())
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

        // Strategy 5: AI Fallback (DeepSeek)
        // If we still don't have a description and AI is enabled
        if ((!description || description.length < 100) && useAI) {
            try {
                const { extractJobDescriptionFromHtml, isDeepSeekAvailable } = await import('./deepseek-parser.js')
                if (isDeepSeekAvailable()) {
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

        // Truncate if too long
        if (description && description.length > 5000) {
            description = description.substring(0, 5000) + '...'
        }

        console.log(`[fetchJobDetails] Extracted ${description.length} chars for ${jobUrl}`)

        return {
            description: description || '',
            requirements: requirements.slice(0, 20), // Limit to 20 items
            benefits: benefits.slice(0, 20)
        }

    } catch (error) {
        console.error(`[fetchJobDetails] Error fetching ${jobUrl}:`, error.message)
        return { description: '', requirements: [], benefits: [] }
    }
}

export async function crawlCompanyJobs(companyId, careersUrl, options = {}) {
    if (!careersUrl) throw new Error('No careers URL provided')

    // Specific Fix for Braintrust (which uses a complex Next.js App Router setup wrapping Ashby)
    // We switch to their direct Ashby board for reliable crawling
    if (careersUrl.includes('braintrust.dev') || careersUrl.includes('usebraintrust.com')) {
        console.log('[JobCrawler] Braintrust detected, switching to Ashby board for reliable crawling')
        careersUrl = 'https://jobs.ashbyhq.com/braintrust'
    }

    const { fetchDetails = false, maxDetailFetches = 10, concurrency = 3, useAI = false } = options

    console.log(`[JobCrawler] Crawling ${careersUrl} for company ${companyId}`)
    if (fetchDetails) {
        console.log(`[JobCrawler] Detail fetching enabled (max: ${maxDetailFetches}, concurrency: ${concurrency})`)
    }
    if (useAI) {
        console.log(`[JobCrawler] AI enhancement enabled (DeepSeek)`)
    }

    try {
        const response = await fetch(careersUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
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

        // Fetch detailed information if enabled
        if (fetchDetails && jobs.length > 0) {
            const jobsToFetch = jobs.slice(0, maxDetailFetches)
            console.log(`[JobCrawler] Fetching details for ${jobsToFetch.length} jobs...`)

    // Optional AI enhancement
    if (useAI) {
        try {
            const { enhanceJobDescription, isDeepSeekAvailable } = await import('./deepseek-parser.js')
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

                        // Optional AI enhancement
                        if (job.description && job.description.length > 100) {
                            try {
                                if (isDeepSeekAvailable()) {
                                    console.log(`[JobCrawler] Enhancing job with AI: ${job.title}`)
                                    await enhanceJobDescription(job)
                                } else {
                                    console.log(`[JobCrawler] DeepSeek API not available, skipping AI enhancement`)
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
            console.error('[JobCrawler] Failed to load DeepSeek parser:', e)
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

                    console.log(`[JobCrawler] Fetched details for job ${i + idx + 1}/${jobsToFetch.length}: ${job.title} (${job.description?.length || 0} chars)`)
                    return job
                })
            )
        }
    }
            console.log(`[JobCrawler] Detail fetching complete`)
        }

        // Enrich with companyId
        const enrichedJobs = jobs.map(job => ({
            ...job,
            companyId,
            // Use existing ID if available (e.g. from Ashby parser), otherwise generate one
            id: job.id || `crawled_${companyId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            updatedAt: new Date().toISOString(),
            category: ClassificationService.classifyJob(job.title, job.description)
        }))

        return {
            jobs: enrichedJobs,
            company: companyInfo
        }

    } catch (error) {
        console.error(`[JobCrawler] Error crawling ${careersUrl}:`, error)
        return { jobs: [], company: null }
    }
}
