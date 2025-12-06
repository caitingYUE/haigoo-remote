import { getAllCompanies, saveAllCompanies } from '../api-handlers/trusted-companies.js'
import { getAllJobs, saveAllJobs } from '../api-handlers/processed-jobs.js'
import { crawlCompanyJobs } from '../job-crawler.js'

// Helper for limited concurrency
async function pLimit(items, limit, fn) {
    const results = [];
    const executing = [];
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        if (limit <= items.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(results);
}

export default async function handler(req, res) {
    try {
        console.log('[cron] Starting scheduled trusted company crawl...')
        const companies = await getAllCompanies()
        if (!companies || companies.length === 0) {
            console.log('[cron] No companies to crawl')
            return res.status(200).json({ success: true, message: 'No companies found' })
        }

        console.log(`[cron] Found ${companies.length} companies`)

        let updatedCount = 0
        let allCrawledJobs = []

        // Process with concurrency limit of 3
        // Limit total companies to 10 per run to prevent timeouts (random shuffle could be added later)
        const targetCompanies = companies.slice(0, 10);

        const results = await pLimit(targetCompanies, 3, async (company) => {
            const url = company.careersPage || company.website
            if (!url) {
                return { name: company.name, status: 'skipped_no_url' }
            }

            try {
                console.log(`[cron] Crawling ${company.name} (${url})...`)

                const result = await crawlCompanyJobs(company.id, url, {
                    fetchDetails: true,
                    maxDetailFetches: 3, // Reduced to 3 to be faster
                    concurrency: 2
                })

                const crawledCompany = result.company
                let companyUpdated = false

                // Update company info if found
                if (crawledCompany) {
                    if (crawledCompany.logo && !company.logo) {
                        company.logo = crawledCompany.logo
                        companyUpdated = true
                    }
                    if (crawledCompany.address && !company.address) {
                        company.address = crawledCompany.address
                        companyUpdated = true
                    }
                    if (companyUpdated) updatedCount++
                }

                // Collect jobs
                if (result.jobs && result.jobs.length > 0) {
                    const enrichedJobs = result.jobs.map(job => ({
                        ...job,
                        company: company.name,
                        companyLogo: company.logo,
                        sourceType: 'trusted',
                        isTrusted: true,
                        canRefer: !!company.canRefer,
                        publishedAt: job.publishedAt || new Date().toISOString() // Fix: Ensure published_at is not null
                    }))
                    allCrawledJobs.push(...enrichedJobs)
                }

                return {
                    name: company.name,
                    jobs: result.jobs?.length || 0,
                    updated: companyUpdated,
                    status: 'success'
                }
            } catch (err) {
                console.error(`[cron] Failed to crawl ${company.name}:`, err.message)
                return { name: company.name, error: err.message, status: 'failed' }
            }
        });

        // Save all crawled jobs
        if (allCrawledJobs.length > 0) {
            console.log(`[cron] Saving ${allCrawledJobs.length} crawled jobs...`)
            const existingJobs = await getAllJobs()
            const mergedJobs = [...existingJobs, ...allCrawledJobs]
            await saveAllJobs(mergedJobs)
            console.log(`[cron] Jobs saved successfully`)
        }

        if (updatedCount > 0) {
            await saveAllCompanies(companies)
            console.log(`[cron] Updated metadata for ${updatedCount} companies`)
        }

        return res.status(200).json({
            success: true,
            processed: targetCompanies.length,
            updatedCompanies: updatedCount,
            newJobsFound: allCrawledJobs.length,
            results
        })

    } catch (error) {
        console.error('[cron] Critical error:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}
