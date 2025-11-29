import { getAllCompanies, saveAllCompanies } from '../../lib/api-handlers/trusted-companies.js'
import { crawlCompanyJobs } from '../../lib/job-crawler.js'

export default async function handler(req, res) {
    // Basic security check for Cron
    // Vercel Cron requests have a specific header, but we can also just rely on the route being hidden or check a secret query param
    // For this implementation, we'll allow it to run. In production, check process.env.CRON_SECRET
    
    try {
        console.log('[cron] Starting scheduled trusted company crawl...')
        const companies = await getAllCompanies()
        if (!companies || companies.length === 0) {
            console.log('[cron] No companies to crawl')
            return res.status(200).json({ success: true, message: 'No companies found' })
        }

        console.log(`[cron] Found ${companies.length} companies`)
        
        // Crawl sequentially to avoid resource exhaustion
        const results = []
        let updatedCount = 0
        
        for (const company of companies) {
            // Skip if no URL
            const url = company.careersPage || company.website
            if (!url) {
                results.push({ name: company.name, status: 'skipped_no_url' })
                continue
            }

            try {
                console.log(`[cron] Crawling ${company.name} (${url})...`)
                
                // Use reasonable limits for automated crawl
                const result = await crawlCompanyJobs(company.id, url, {
                    fetchDetails: true,
                    maxDetailFetches: 5, // Limit details to 5 per company for daily sync to save time
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
                }
                
                if (companyUpdated) updatedCount++
                
                results.push({ 
                    name: company.name, 
                    jobs: result.jobs?.length || 0,
                    updated: companyUpdated,
                    status: 'success'
                })
                
                // Small delay between requests to be polite
                await new Promise(resolve => setTimeout(resolve, 2000))
                
            } catch (err) {
                console.error(`[cron] Failed to crawl ${company.name}:`, err.message)
                results.push({ name: company.name, error: err.message, status: 'failed' })
            }
        }
        
        if (updatedCount > 0) {
            await saveAllCompanies(companies)
            console.log(`[cron] Updated metadata for ${updatedCount} companies`)
        }

        return res.status(200).json({ 
            success: true, 
            processed: companies.length, 
            updatedCompanies: updatedCount,
            results 
        })
        
    } catch (error) {
        console.error('[cron] Critical error:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}
