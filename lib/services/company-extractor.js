import * as cheerio from 'cheerio'

/**
 * Normalize a URL to a clean hostname/path for deduplication
 */
export const normalizeUrl = (url) => {
    if (!url) return ''
    try {
        const urlObj = new URL(url)
        return urlObj.hostname.replace(/^www\./, '').toLowerCase()
    } catch {
        return url.toLowerCase()
    }
}

/**
 * Normalize company name for deduplication
 */
export const normalizeCompanyName = (name) => {
    return (name || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[,.\-_]/g, '')
}

/**
 * Extract company information from a job object
 * @param {Object} job - The job object (processed or raw-like)
 * @returns {Object} Extracted company info { name, url, description, etc }
 */
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
                          hostname.includes('weworkremotely')
            
            if (!isAts) {
                // Use the hostname as the company URL (e.g. https://stripe.com)
                companyUrl = `https://${hostname}`
            }
        } catch (e) {}
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

/**
 * Deduplicate a list of companies
 */
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
