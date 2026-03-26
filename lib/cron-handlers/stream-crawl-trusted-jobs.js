import { getAllCompanies, saveAllCompanies } from '../api-handlers/trusted-companies.js'
import { syncCompanyJobs } from '../services/job-sync-service.js'
import { crawlCompanyJobs } from '../job-crawler.js'
import { classifyJob, determineExperienceLevel } from '../services/classification-service.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { dispatchSpecialCrawler } from '../api-handlers/special-crawlers.js'
import { sendLog } from '../services/lark-message.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'

// Helper for limited concurrency with proper cleanup
async function pLimit(items, limit, fn) {
    const results = [];
    const executing = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const p = Promise.resolve().then(() => fn(item, i));
        results.push(p);

        if (limit <= items.length) {
            const e = p.finally(() => {
                const idx = executing.indexOf(e);
                if (idx !== -1) executing.splice(idx, 1);
            });
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(results);
}

export default async function handler(req, res) {
    // Auth Check
    const token = extractToken(req)
    const payload = token ? verifyToken(token) : null
    let isAdmin = false

    if (payload && payload.userId) {
        const requester = await userHelper.getUserById(payload.userId)
        isAdmin = !!(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(requester?.email))
    }

    // Check for Vercel Cron Secret
    const isCron = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`

    if (!isAdmin && !isCron) {
        console.warn('[Cron:CrawlTrustedJobs] Unauthorized attempt')
        return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    try {
        console.log('[Cron:CrawlTrustedJobs] Starting scheduled trusted company crawl...')

        // Secure CORS
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'https://haigoo-admin.vercel.app',
            'https://www.haigooremote.com'
        ];
        const origin = req.headers.origin;
        const allowOrigin = allowedOrigins.includes(origin) ? origin : '';

        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': allowOrigin
        });

        // 发送开始消息
        res.write(`event: start\ndata: ${JSON.stringify({
            type: 'start',
            message: '开始可信公司爬取任务',
            timestamp: new Date().toISOString()
        })}\n\n`);

        // 优化：不再获取所有公司，而是直接查询待爬取的公司（按时间排序，实现轮询）
        let targetCompanies = [];
        let totalActiveCompanies = 0;

        if (neonHelper.isConfigured) {
            // 1. Get total count for reporting
            const countResult = await neonHelper.query("SELECT COUNT(*) FROM trusted_companies WHERE status = 'active'");
            totalActiveCompanies = parseInt(countResult[0].count);

            // 2. Get next batch of companies to crawl
            // Priority: Active -> Has Careers Page -> Oldest Crawl Time (or NULL)
            console.log('[Cron:CrawlTrustedJobs] Fetching next batch of companies to crawl...');
            const result = await neonHelper.query(`
                SELECT * FROM trusted_companies 
                WHERE status = 'active' 
                AND careers_page IS NOT NULL 
                AND length(careers_page) > 0
                ORDER BY last_crawled_at ASC NULLS FIRST
                LIMIT 10
            `);

            if (result && result.length > 0) {
                targetCompanies = result.map(row => ({
                    id: row.company_id,
                    name: row.name,
                    website: row.website,
                    careersPage: row.careers_page,
                    linkedin: row.linkedin,
                    description: row.description,
                    logo: row.logo,
                    address: row.address,
                    canRefer: row.can_refer,
                    memberOnly: row.member_only,
                    lastCrawledAt: row.last_crawled_at
                }));
            }
        } else {
            // Fallback for non-Neon env (unlikely)
            const all = await getAllCompanies();
            targetCompanies = all.slice(0, 10);
            totalActiveCompanies = all.length;
        }

        if (targetCompanies.length === 0) {
            console.log('[Cron:CrawlTrustedJobs] No eligible companies to crawl');
            // 发送无公司消息并结束流
            res.write(`event: no_companies\ndata: ${JSON.stringify({
                type: 'no_companies',
                message: '没有找到需要爬取的公司（活跃且配置了招聘页面）',
                timestamp: new Date().toISOString()
            })}\n\n`);
            res.end();
            return;
        }

        console.log(`[Cron:CrawlTrustedJobs] Found ${targetCompanies.length} companies to crawl (Total Active: ${totalActiveCompanies})`)

        // 发送公司扫描完成消息
        res.write(`event: scan_complete\ndata: ${JSON.stringify({
            type: 'scan_complete',
            totalCompanies: totalActiveCompanies,
            message: `扫描完成：共 ${totalActiveCompanies} 个活跃公司，本轮处理 ${targetCompanies.length} 个`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        let updatedCount = 0
        let totalJobsSaved = 0
        // 添加公司岗位统计
        const companyStats = []

        // 发送目标公司选择消息
        res.write(`event: target_selected\ndata: ${JSON.stringify({
            type: 'target_selected',
            targetCount: targetCompanies.length,
            totalCompanies: totalActiveCompanies,
            message: `选择 ${targetCompanies.length} 个公司进行爬取（共 ${totalActiveCompanies} 个）`,
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
            // Safety timeout wrapper for each company crawl task
            // This ensures that even if crawlCompanyJobs hangs (despite internal timeout), 
            // the cron job moves on after 180s per company.
            const TIMEOUT_MS = 180 * 1000;

            const taskWithTimeout = async () => {
                // Strict check: Only use careersPage, do not fallback to website to avoid inaccurate crawling
                const url = company.careersPage

                // Update crawl timestamp immediately to ensure rotation (Round-Robin)
                // This ensures even if no jobs are found or crawl fails, we move this company to the end of the queue
                company.lastCrawledAt = new Date().toISOString()

                // 发送单个公司开始爬取消息
                res.write(`event: company_crawl_start\ndata: ${JSON.stringify({
                    type: 'company_crawl_start',
                    companyIndex: index + 1,
                    totalCompanies: targetCompanies.length,
                    companyName: company.name,
                    url: url || 'N/A',
                    message: `开始爬取 ${company.name} (${index + 1}/${targetCompanies.length})`,
                    timestamp: new Date().toISOString()
                })}\n\n`);

                if (!url) {
                    // 如果未配置 careersPage，视为无岗位，清空现有数据以刷新状态
                    if (neonHelper.isConfigured) {
                        try {
                            console.log(`[cron] Company ${company.name} has no careersPage, clearing jobs...`)
                            await neonHelper.transaction(async (client) => {
                                // 1. Delete existing jobs
                                await client.query('DELETE FROM jobs WHERE company_id = $1 AND (source != \'manual\') AND (is_manually_edited IS NOT TRUE)', [company.id])
                                if (company.name) {
                                    await client.query('DELETE FROM jobs WHERE company = $1 AND company_id IS NULL AND (source != \'manual\') AND (is_manually_edited IS NOT TRUE)', [company.name])
                                }

                                // 2. Update company status
                                await client.query(`
                                    UPDATE trusted_companies 
                                    SET job_count = 0, updated_at = NOW(), last_crawled_at = NOW()
                                    WHERE company_id = $1
                                `, [company.id])
                            })

                            // 发送清理完成消息（作为一种特殊的 crawl_complete）
                            res.write(`event: company_crawl_complete\ndata: ${JSON.stringify({
                                type: 'company_crawl_complete',
                                companyIndex: index + 1,
                                companyName: company.name,
                                jobsFound: 0,
                                companyUpdated: true,
                                message: `${company.name} 未配置招聘链接，已清空岗位数据`,
                                timestamp: new Date().toISOString()
                            })}\n\n`);

                            // 记录公司统计信息
                            companyStats.push({
                                name: company.name,
                                jobs: 0,
                                status: 'cleared_no_careers_page'
                            })

                            return { name: company.name, status: 'cleared_no_careers_page' }
                        } catch (e) {
                            console.error(`[cron] Failed to clear jobs for ${company.name}:`, e)
                            // Fallback to skipped event on error
                            res.write(`event: company_skipped\ndata: ${JSON.stringify({
                                type: 'company_skipped',
                                companyIndex: index + 1,
                                companyName: company.name,
                                reason: 'error_clearing',
                                message: `跳过 ${company.name}：清空数据失败 - ${e.message}`,
                                timestamp: new Date().toISOString()
                            })}\n\n`);
                            return { name: company.name, status: 'error_clearing' }
                        }
                    } else {
                        // 发送跳过消息 (无 DB)
                        res.write(`event: company_skipped\ndata: ${JSON.stringify({
                            type: 'company_skipped',
                            companyIndex: index + 1,
                            companyName: company.name,
                            reason: 'no_careers_page_no_db',
                            message: `跳过 ${company.name}：未配置招聘链接`,
                            timestamp: new Date().toISOString()
                        })}\n\n`);

                        // 记录公司统计信息
                        companyStats.push({
                            name: company.name,
                            jobs: 0,
                            status: 'skipped_no_careers_page'
                        })

                        return { name: company.name, status: 'skipped_no_careers_page' }
                    }
                }

                try {
                    console.log(`[cron] Crawling ${company.name} (${url})...`)

                    // Check for special crawlers first
                    let result = { jobs: [], company: null };

                    // Force dispatchSpecialCrawler to be awaited properly
                    let specialJobs = [];
                    try {
                        specialJobs = await dispatchSpecialCrawler(url);
                    } catch (specialErr) {
                        console.error(`[cron] Special crawler error for ${company.name}:`, specialErr);
                        specialJobs = [];
                    }

                    if (specialJobs && specialJobs.length > 0) {
                        console.log(`[cron] Used special crawler for ${company.name}, found ${specialJobs.length} jobs`);
                        result.jobs = specialJobs;
                    } else {
                        // Fallback to standard crawler
                        result = await crawlCompanyJobs(company.id, company.name, url, {
                            fetchDetails: true,
                            maxDetailFetches: 100, // Increased to 100 to get more jobs with details
                            concurrency: 3,
                            useAI: true // Enable AI fallback for tricky pages
                        });
                    }

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

                    // 立即保存爬取的 jobs
                    let jobsCount = 0
                    if (result.jobs && result.jobs.length > 0) {
                        jobsCount = result.jobs.length
                        const enrichedJobs = result.jobs.map(job => ({
                            ...job,
                            company: company.name,
                            companyLogo: company.logo,
                            sourceType: 'official', // Mark as official for orange badge
                            isTrusted: true,
                            canRefer: !!company.canRefer,
                            memberOnly: !!company.memberOnly,
                            publishedAt: job.publishedAt || new Date().toISOString() // Fix: Ensure published_at is not null
                        }))

                        // 立即保存当前公司的 jobs
                        try {
                            // FIX: Use Diff-based deletion to ensure accuracy and safety
                            // 🆕 Use new syncCompanyJobs logic to handle fuzzy matching and preserve manual edits
                            const syncResult = await syncCompanyJobs(company.id, company.name, enrichedJobs);

                            jobsCount = syncResult.savedCount; // Update count to actual saved
                            totalJobsSaved += jobsCount

                            // 记录本次成功抓取时间 (用于更新 trusted_companies 表)
                            // company.lastCrawledAt is already updated at start of task
                            company.jobCount = jobsCount
                            companyUpdated = true // Force update to save timestamp

                            // 发送单个公司保存完成消息
                            res.write(`event: company_save_complete\ndata: ${JSON.stringify({
                                type: 'company_save_complete',
                                companyIndex: index + 1,
                                companyName: company.name,
                                jobsSaved: jobsCount,
                                deleted: syncResult.deletedCount,
                                migrated: syncResult.migratedCount,
                                message: `${company.name} 职位保存完成：保存 ${jobsCount} 个，删除 ${syncResult.deletedCount} 个，迁移 ${syncResult.migratedCount} 个`,
                                timestamp: new Date().toISOString()
                            })}\n\n`);
                        } catch (saveError) {
                            console.error(`[Cron:CrawlTrustedJobs] Failed to save jobs for ${company.name}:`, saveError.message)

                            // 发送保存失败消息
                            res.write(`event: company_save_failed\ndata: ${JSON.stringify({
                                type: 'company_save_failed',
                                companyIndex: index + 1,
                                companyName: company.name,
                                error: saveError.message,
                                message: `${company.name} 职位保存失败：${saveError.message}`,
                                timestamp: new Date().toISOString()
                            })}\n\n`);
                        }
                    }

                    if (companyUpdated) updatedCount++

                    // 记录公司统计信息
                    companyStats.push({
                        name: company.name,
                        jobs: jobsCount,
                        status: 'success'
                    })

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

                    // 记录公司统计信息
                    companyStats.push({
                        name: company.name,
                        jobs: 0,
                        status: 'failed',
                        error: err.message
                    })

                    return { name: company.name, error: err.message, status: 'failed' }
                }
            };

            // Execute with timeout
            try {
                return await Promise.race([
                    taskWithTimeout(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Operation timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
                    )
                ]);
            } catch (error) {
                console.error(`[Cron:CrawlTrustedJobs] Timeout or critical error wrapper for ${company.name}:`, error.message)

                // Record failure if not already recorded
                if (!companyStats.some(s => s.name === company.name)) {
                    companyStats.push({
                        name: company.name,
                        jobs: 0,
                        status: 'failed',
                        error: error.message
                    })
                }

                // Notify failure
                res.write(`event: company_crawl_failed\ndata: ${JSON.stringify({
                    type: 'company_crawl_failed',
                    companyIndex: index + 1,
                    companyName: company.name,
                    error: error.message,
                    message: `${company.name} 爬取超时或失败：${error.message}`,
                    timestamp: new Date().toISOString()
                })}\n\n`);

                return { name: company.name, error: error.message, status: 'failed' }
            }
        });

        // 发送爬取完成统计消息
        res.write(`event: crawl_complete\ndata: ${JSON.stringify({
            type: 'crawl_complete',
            processedCompanies: targetCompanies.length,
            updatedCompanies: updatedCount,
            newJobsFound: totalJobsSaved,
            message: `爬取完成：处理 ${targetCompanies.length} 个公司，更新 ${updatedCount} 个公司信息，找到并保存 ${totalJobsSaved} 个新职位`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        if (updatedCount > 0) {
            // 发送公司信息保存开始消息
            res.write(`event: save_companies_start\ndata: ${JSON.stringify({
                type: 'save_companies_start',
                updatedCount: updatedCount,
                message: '开始保存更新的公司信息',
                timestamp: new Date().toISOString()
            })}\n\n`);

            await saveAllCompanies(targetCompanies)

            // 发送公司信息保存完成消息
            res.write(`event: save_companies_complete\ndata: ${JSON.stringify({
                type: 'save_companies_complete',
                savedCount: targetCompanies.length,
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
                newJobsFound: totalJobsSaved,
                totalCompanies: totalActiveCompanies
            },
            message: `任务完成：处理 ${targetCompanies.length} 个公司，更新 ${updatedCount} 个公司信息，找到并保存 ${totalJobsSaved} 个新职位`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        // 发送飞书统计消息
        try {
            await sendCompanyStatsToLark(companyStats, targetCompanies.length, totalJobsSaved, updatedCount)
        } catch (larkError) {
            console.error('[Cron:CrawlTrustedJobs] Failed to send Lark message:', larkError)
        }

        res.end();

    } catch (error) {
        console.error('[Cron:CrawlTrustedJobs] Critical error:', error)

        if (neonHelper.isConfigured) {
            try {
                await neonHelper.query(
                    'INSERT INTO admin_messages (type, title, content) VALUES ($1, $2, $3)',
                    ['system_error', '定时任务异常：可信公司爬取', error.message]
                )
            } catch (err) {
                console.error('[Cron] Failed to insert admin message', err)
            }
        }

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

/**
 * 发送公司岗位统计到飞书
 * @param {Array} companyStats - 公司统计信息数组
 * @param {number} processedCount - 处理的公司数量
 * @param {number} totalJobs - 总岗位数
 * @param {number} updatedCount - 更新的公司数量
 */
async function sendCompanyStatsToLark(companyStats, processedCount, totalJobs, updatedCount) {
    if (!companyStats || companyStats.length === 0) {
        console.log('[Cron:CrawlTrustedJobs] No company stats to send')
        return
    }

    // 统计成功、失败、跳过的公司数量
    const successCount = companyStats.filter(stat => stat.status === 'success').length
    const failedCount = companyStats.filter(stat => stat.status === 'failed').length
    const skippedCount = companyStats.filter(stat => stat.status.includes('skipped') || stat.status.includes('cleared')).length

    // 按岗位数排序
    const sortedStats = [...companyStats].sort((a, b) => b.jobs - a.jobs)

    // 构建统计消息内容
    let content = `📊 **可信公司爬取统计报告**\n`
    content += `\n**总体统计**\n`
    content += `• 处理公司数：${processedCount}\n`
    content += `• 成功爬取：${successCount}\n`
    content += `• 爬取失败：${failedCount}\n`
    content += `• 跳过/清理：${skippedCount}\n`
    content += `• 更新公司：${updatedCount}\n`
    content += `• 总岗位数：${totalJobs}\n`

    content += `\n**各公司岗位详情**\n`

    sortedStats.forEach((stat, index) => {
        let statusIcon = '✅'
        if (stat.status === 'failed') statusIcon = '❌'
        else if (stat.status.includes('skipped') || stat.status.includes('cleared')) statusIcon = '⏭️'

        content += `${index + 1}. ${stat.name}: ${stat.jobs} 个岗位 ${statusIcon}`

        if (stat.status === 'failed' && stat.error) {
            content += ` (错误: ${stat.error.substring(0, 50)}...)`
        }
        content += '\n'
    })

    content += `\n**统计时间**\n`
    content += `${new Date().toLocaleString('zh-CN')}`

    // 根据成功比例选择消息颜色
    let color = 'green'
    if (failedCount > successCount) {
        color = 'red'
    } else if (failedCount > 0) {
        color = 'yellow'
    }

    // 发送飞书消息
    await sendLog(content, color, '可信公司爬取统计')

    console.log('[Cron:CrawlTrustedJobs] Lark statistics message sent successfully')
}
