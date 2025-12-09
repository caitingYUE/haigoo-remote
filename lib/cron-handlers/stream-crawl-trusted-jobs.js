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
        console.log('[Cron:CrawlTrustedJobs] Starting scheduled trusted company crawl...')

        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // 发送开始消息
        res.write(`event: start\ndata: ${JSON.stringify({
            type: 'start',
            message: '开始可信公司爬取任务',
            timestamp: new Date().toISOString()
        })}\n\n`);

        const companies = await getAllCompanies()
        if (!companies || companies.length === 0) {
            console.log('[Cron:CrawlTrustedJobs] No companies to crawl')
            
            // 发送无公司消息并结束流
            res.write(`event: no_companies\ndata: ${JSON.stringify({
                type: 'no_companies',
                message: '没有找到需要爬取的公司',
                timestamp: new Date().toISOString()
            })}\n\n`);
            res.end();
            return;
        }

        console.log(`[Cron:CrawlTrustedJobs] Found ${companies.length} companies`)

        // 发送公司扫描完成消息
        res.write(`event: scan_complete\ndata: ${JSON.stringify({
            type: 'scan_complete',
            totalCompanies: companies.length,
            message: `扫描完成：找到 ${companies.length} 个可信公司`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        let updatedCount = 0
        let allCrawledJobs = []

        // Process with concurrency limit of 3
        // Limit total companies to 10 per run to prevent timeouts (random shuffle could be added later)
        const targetCompanies = companies.slice(0, 10);

        // 发送目标公司选择消息
        res.write(`event: target_selected\ndata: ${JSON.stringify({
            type: 'target_selected',
            targetCount: targetCompanies.length,
            totalCompanies: companies.length,
            message: `选择 ${targetCompanies.length} 个公司进行爬取（共 ${companies.length} 个）`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        // 发送爬取开始消息
        res.write(`event: crawl_start\ndata: ${JSON.stringify({
            type: 'crawl_start',
            targetCount: targetCompanies.length,
            message: '开始爬取公司职位信息',
            timestamp: new Date().toISOString()
        })}\n\n`);

        const results = await pLimit(targetCompanies, 3, async (company, index) => {
            const url = company.careersPage || company.website
            
            // 发送单个公司开始爬取消息
            res.write(`event: company_crawl_start\ndata: ${JSON.stringify({
                type: 'company_crawl_start',
                companyIndex: index + 1,
                totalCompanies: targetCompanies.length,
                companyName: company.name,
                url: url,
                message: `开始爬取 ${company.name} (${index + 1}/${targetCompanies.length})`,
                timestamp: new Date().toISOString()
            })}\n\n`);

            if (!url) {
                // 发送跳过消息
                res.write(`event: company_skipped\ndata: ${JSON.stringify({
                    type: 'company_skipped',
                    companyIndex: index + 1,
                    companyName: company.name,
                    reason: 'no_url',
                    message: `跳过 ${company.name}：无可用网址`,
                    timestamp: new Date().toISOString()
                })}\n\n`);
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
                let jobsCount = 0
                if (result.jobs && result.jobs.length > 0) {
                    jobsCount = result.jobs.length
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

                // 发送单个公司爬取完成消息
                res.write(`event: company_crawl_complete\ndata: ${JSON.stringify({
                    type: 'company_crawl_complete',
                    companyIndex: index + 1,
                    companyName: company.name,
                    jobsFound: jobsCount,
                    companyUpdated: companyUpdated,
                    message: `${company.name} 爬取完成：找到 ${jobsCount} 个职位${companyUpdated ? '，公司信息已更新' : ''}`,
                    timestamp: new Date().toISOString()
                })}\n\n`);

                return {
                    name: company.name,
                    jobs: jobsCount,
                    updated: companyUpdated,
                    status: 'success'
                }
            } catch (err) {
                console.error(`[Cron:CrawlTrustedJobs] Failed to crawl ${company.name}:`, err.message)
                
                // 发送单个公司爬取失败消息
                res.write(`event: company_crawl_failed\ndata: ${JSON.stringify({
                    type: 'company_crawl_failed',
                    companyIndex: index + 1,
                    companyName: company.name,
                    error: err.message,
                    message: `${company.name} 爬取失败：${err.message}`,
                    timestamp: new Date().toISOString()
                })}\n\n`);
                
                return { name: company.name, error: err.message, status: 'failed' }
            }
        });

        // 发送爬取完成统计消息
        res.write(`event: crawl_complete\ndata: ${JSON.stringify({
            type: 'crawl_complete',
            processedCompanies: targetCompanies.length,
            updatedCompanies: updatedCount,
            newJobsFound: allCrawledJobs.length,
            message: `爬取完成：处理 ${targetCompanies.length} 个公司，更新 ${updatedCount} 个公司信息，找到 ${allCrawledJobs.length} 个新职位`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        // Save all crawled jobs
        if (allCrawledJobs.length > 0) {
            console.log(`[Cron:CrawlTrustedJobs] Saving ${allCrawledJobs.length} crawled jobs...`)
            
            // 发送保存开始消息
            res.write(`event: save_jobs_start\ndata: ${JSON.stringify({
                type: 'save_jobs_start',
                jobsCount: allCrawledJobs.length,
                message: '开始保存爬取的职位数据',
                timestamp: new Date().toISOString()
            })}\n\n`);
            
            const existingJobs = await getAllJobs()
            const mergedJobs = [...existingJobs, ...allCrawledJobs]
            await saveAllJobs(mergedJobs)
            
            // 发送保存完成消息
            res.write(`event: save_jobs_complete\ndata: ${JSON.stringify({
                type: 'save_jobs_complete',
                savedCount: mergedJobs.length,
                newJobs: allCrawledJobs.length,
                message: `职位保存完成：共 ${mergedJobs.length} 个职位（新增 ${allCrawledJobs.length} 个）`,
                timestamp: new Date().toISOString()
            })}\n\n`);
            
            console.log(`[Cron:CrawlTrustedJobs] Jobs saved successfully`)
        }

        if (updatedCount > 0) {
            // 发送公司信息保存开始消息
            res.write(`event: save_companies_start\ndata: ${JSON.stringify({
                type: 'save_companies_start',
                updatedCount: updatedCount,
                message: '开始保存更新的公司信息',
                timestamp: new Date().toISOString()
            })}\n\n`);
            
            await saveAllCompanies(companies)
            
            // 发送公司信息保存完成消息
            res.write(`event: save_companies_complete\ndata: ${JSON.stringify({
                type: 'save_companies_complete',
                savedCount: companies.length,
                updatedCount: updatedCount,
                message: `公司信息保存完成：更新 ${updatedCount} 个公司信息`,
                timestamp: new Date().toISOString()
            })}\n\n`);
            
            console.log(`[Cron:CrawlTrustedJobs] Updated metadata for ${updatedCount} companies`)
        }

        console.log('[Cron:CrawlTrustedJobs] Completed successfully')

        // 发送任务完成消息
        res.write(`event: complete\ndata: ${JSON.stringify({
            type: 'complete',
            stats: {
                processedCompanies: targetCompanies.length,
                updatedCompanies: updatedCount,
                newJobsFound: allCrawledJobs.length,
                totalCompanies: companies.length
            },
            message: `任务完成：处理 ${targetCompanies.length} 个公司，更新 ${updatedCount} 个公司信息，找到 ${allCrawledJobs.length} 个新职位`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        res.end();

    } catch (error) {
        console.error('[Cron:CrawlTrustedJobs] Critical error:', error)
        
        // 发送错误消息并结束流
        res.write(`event: error\ndata: ${JSON.stringify({
            type: 'error',
            error: error.message,
            message: `任务失败：${error.message}`,
            timestamp: new Date().toISOString()
        })}\n\n`);
        
        res.end();
    }
}
