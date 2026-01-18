
// import { fetch } from 'undici' // Use global fetch in Node 18+

export function isWorkableJobBoard(url) {
    return url.includes('apply.workable.com')
}

export async function parseWorkableJobs(baseUrl, companyId) {
    try {
        // Extract slug: https://apply.workable.com/slasify/ -> slasify
        const urlObj = new URL(baseUrl)
        const pathParts = urlObj.pathname.split('/').filter(p => p)
        
        // Usually the first part is the slug
        // Handle potential edge cases where first part might be 'j' or 'view' (though unlikely for company page)
        let slug = pathParts[0]

        if (!slug || slug === 'j' || slug === 'view') {
            // Try to find a part that looks like a company name?
            // For now, if we can't find a valid slug at position 0, we log error
            console.error('[workable-parser] Invalid or missing slug in URL:', baseUrl)
            return { jobs: [], company: null }
        }

        console.log(`[workable-parser] Detected slug: ${slug}`)

        // Fetch jobs from API
        const apiUrl = `https://apply.workable.com/api/v3/accounts/${slug}/jobs`
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({})
        })

        if (!response.ok) {
            console.error(`[workable-parser] API fetch failed: ${response.status} ${response.statusText} for ${apiUrl}`)
            return { jobs: [], company: null }
        }

        const data = await response.json()
        const results = data.results || []

        console.log(`[workable-parser] Found ${results.length} jobs via API for ${slug}`)

        const jobs = results.map(item => ({
            title: item.title,
            location: formatLocation(item),
            type: mapEmploymentType(item.type),
            url: `https://apply.workable.com/${slug}/j/${item.shortcode}/`,
            description: item.description || '', // Description is usually empty in list view
            requirements: [],
            benefits: [],
            sourceType: 'trusted',
            isTrusted: true,
            companyId,
            publishedAt: item.published,
            remote: item.remote
        }))

        // Workable API doesn't return company info in the jobs endpoint easily (except maybe accountUid)
        // We can try to assume company name from the slug or leave it null for now
        const company = {
            name: slug.charAt(0).toUpperCase() + slug.slice(1), // Simple capitalization
            id: companyId
        }

        return { jobs, company }

    } catch (error) {
        console.error('[workable-parser] Error parsing Workable jobs:', error)
        return { jobs: [], company: null }
    }
}

function formatLocation(item) {
    if (item.remote) return 'Remote'
    const loc = item.location || {}
    const parts = [loc.city, loc.region, loc.country].filter(p => p)
    return parts.length > 0 ? parts.join(', ') : 'Remote'
}

function mapEmploymentType(type) {
    const map = {
        'full': 'Full-time',
        'part': 'Part-time',
        'contract': 'Contract',
        'temporary': 'Temporary',
        'internship': 'Internship'
    }
    return map[type] || 'Full-time'
}
