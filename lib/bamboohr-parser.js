
import * as cheerio from 'cheerio'

/**
 * Detect if URL is a BambooHR job board
 * Matches: 
 * - *.bamboohr.com/jobs
 * - *.bamboohr.com/careers
 * - *.bamboohr.com/careers/list
 */
export function isBambooHRJobBoard(url) {
    return url.includes('.bamboohr.com')
}

/**
 * Parse BambooHR jobs
 * Tries to fetch from the public API endpoint first
 */
export async function parseBambooHRJobs(baseUrl, companyId) {
    const result = {
        jobs: [],
        company: null
    }

    try {
        // Extract subdomain
        // Format: https://subdomain.bamboohr.com/...
        const urlObj = new URL(baseUrl)
        const parts = urlObj.hostname.split('.')
        const subdomain = parts[0]

        if (!subdomain) {
            console.error('[bamboohr-parser] Could not extract subdomain from', baseUrl)
            return result
        }

        // Try API Endpoint: /careers/list
        const apiUrl = `https://${subdomain}.bamboohr.com/careers/list`
        console.log(`[bamboohr-parser] Fetching API: ${apiUrl}`)

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        })

        if (response.ok) {
            const data = await response.json()
            
            // Expected format: { result: [ { id, jobOpeningName, location: { city, state, country }, ... } ] }
            const jobsList = data.result || []
            
            if (jobsList.length > 0) {
                console.log(`[bamboohr-parser] Found ${jobsList.length} jobs via API`)
                
                result.jobs = jobsList.map(item => {
                    const jobId = item.id
                    // Construct detail URL
                    // Usually: https://subdomain.bamboohr.com/careers/{id} or /jobs/view.php?id={id}
                    // The API doesn't always return the full URL, but we can construct it.
                    // Modern BambooHR: /careers/{id}
                    const jobUrl = `https://${subdomain}.bamboohr.com/careers/${jobId}`
                    
                    let location = 'Remote'
                    if (item.location) {
                        if (typeof item.location === 'string') {
                            location = item.location
                        } else {
                            const locParts = []
                            if (item.location.city) locParts.push(item.location.city)
                            if (item.location.state) locParts.push(item.location.state)
                            if (item.location.country) locParts.push(item.location.country)
                            if (locParts.length > 0) location = locParts.join(', ')
                        }
                    }

                    // Check for Remote in title or type if location is missing
                    if (item.jobOpeningName.toLowerCase().includes('remote')) {
                        location = 'Remote'
                    }

                    // Map fields
                    return {
                        title: item.jobOpeningName,
                        url: jobUrl,
                        location: location,
                        type: item.employmentType || 'Full-time', // BambooHR might not send this in list
                        description: '', // List usually doesn't have full description
                        sourceType: 'trusted',
                        isTrusted: true,
                        publishedAt: new Date().toISOString() // API doesn't always have date, assume fresh
                    }
                })
                
                return result
            }
        } else {
            console.warn(`[bamboohr-parser] API fetch failed: ${response.status}`)
        }

        // Fallback: If API fails, we could try parsing the HTML of the passed page
        // But usually the API is the way to go for BambooHR.
        // If the user provided a specific page (e.g. /jobs), we might need to parse it.
        // But since we are in `parseBambooHRJobs` which is called with `baseUrl`, 
        // we can assume we tried the API. 
        // If we want to support HTML parsing, we would need the HTML content.
        // `lib/job-crawler.js` calls `parseWorkableJobs(baseUrl)` without HTML.
        // So we stick to API for now.

    } catch (error) {
        console.error('[bamboohr-parser] Error parsing BambooHR jobs:', error)
    }

    return result
}
