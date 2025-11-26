

import * as cheerio from 'cheerio'
import { parseAshbyJobs, isAshbyJobBoard } from './ashby-parser.js'

// Helper to clean text
const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : ''

// Heuristic Job Parser
async function parseJobsFromHtml(html, baseUrl, companyId) {
    const $ = cheerio.load(html)
    const jobs = []

    // Strategy 0: Ashby Job Board (Highest Priority for ashbyhq.com)
    if (isAshbyJobBoard(baseUrl)) {
        console.log('[job-crawler] Detected Ashby job board, using specialized parser')
        const ashbyJobs = parseAshbyJobs(html, baseUrl, companyId)
        if (ashbyJobs.length > 0) {
            console.log(`[job-crawler] Ashby parser found ${ashbyJobs.length} jobs`)
            return ashbyJobs
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
                if (uniqueFound.length > 0) return uniqueFound
            }
        } catch (e) {
            console.error('Error parsing Next.js/Nuxt.js data:', e)
        }
    }

    // Strategy 2: Schema.org JobPosting (High Confidence)
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

    if (jobs.length > 0) return jobs

    // Strategy 3: Common Job Board Patterns (Greenhouse, Lever, Ashby, Workable)
    // These usually have specific class names or structures

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
        if (jobs.length > 0) return jobs
    }

    // Generic Fallback: Look for "Apply" links or list items with job-like keywords
    // This is risky and might produce noise, so we'll be conservative.
    // We'll look for <a> tags that contain "Engineer", "Developer", "Manager", "Designer" inside a list
    const potentialLinks = $('a')
    const keywords = [
        'Engineer', 'Developer', 'Manager', 'Designer', 'Specialist', 'Analyst', 'Director', 'Head of',
        'Lead', 'Architect', 'Consultant', 'Coordinator', 'Administrator', 'Officer', 'Associate',
        'Translator', 'Writer', 'Editor', 'Marketer', 'Sales', 'Account', 'Success', 'Support',
        'Operations', 'Legal', 'Finance', 'Data', 'Product', 'Program', 'Recruiter', 'Talent'
    ]

    potentialLinks.each((i, el) => {
        const $link = $(el)
        const text = cleanText($link.text())
        // Check if text contains a keyword (case insensitive check might be better but keywords are capitalized)
        // Also ensure the text isn't too long (avoiding navigation links or paragraphs)
        if (keywords.some(k => text.includes(k)) && text.length < 100 && text.length > 5) {
            const href = $link.attr('href')
            if (href) {
                // Check if it looks like a job title
                jobs.push({
                    title: text,
                    url: href.startsWith('http') ? href : new URL(href, baseUrl).toString(),
                    location: 'Remote', // Default for this platform
                    type: 'Full-time',
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
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

// Fetch detailed job information from a job posting URL
async function fetchJobDetails(jobUrl) {
    try {
        const response = await fetch(jobUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(8000) // 8 second timeout for detail pages
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        let description = ''
        let requirements = []
        let benefits = []

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
            return { description, requirements, benefits }
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

        // Truncate if too long
        if (description.length > 5000) {
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
        const jobs = await parseJobsFromHtml(html, careersUrl, companyId)

        console.log(`[JobCrawler] Found ${jobs.length} jobs for ${companyId}`)

        // Fetch detailed information if enabled
        if (fetchDetails && jobs.length > 0) {
            const jobsToFetch = jobs.slice(0, maxDetailFetches)
            console.log(`[JobCrawler] Fetching details for ${jobsToFetch.length} jobs...`)

            // Fetch in batches with concurrency control
            for (let i = 0; i < jobsToFetch.length; i += concurrency) {
                const batch = jobsToFetch.slice(i, i + concurrency)
                const batchResults = await Promise.all(
                    batch.map(async (job, idx) => {
                        const details = await fetchJobDetails(job.url)
                        // Always merge details (even if empty) to ensure they're set
                        job.description = details.description || job.description || ''
                        job.requirements = (details.requirements && details.requirements.length > 0)
                            ? details.requirements
                            : (job.requirements || [])
                        job.benefits = (details.benefits && details.benefits.length > 0)
                            ? details.benefits
                            : (job.benefits || [])

                        // Optional AI enhancement
                        if (useAI && job.description && job.description.length > 100) {
                            try {
                                const { enhanceJobDescription, isDeepSeekAvailable } = await import('./deepseek-parser.js')
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
            console.log(`[JobCrawler] Detail fetching complete`)
        }

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
