import { readJobsFromNeon, countJobsFromNeon, writeJobsToNeon, NEON_CONFIGURED } from '../api-handlers/processed-jobs.js';
import { getAllCompanies } from '../api-handlers/trusted-companies.js';
import { classifyCompany } from '../services/classification-service.js';
import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
  try {
    console.log('[Cron:EnrichCompanies] Starting...');

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 发送开始消息
    res.write(`event: start\ndata: ${JSON.stringify({
      type: 'start',
      message: '开始公司信息丰富化任务',
      timestamp: new Date().toISOString()
    })}\n\n`);

    const companies = await getAllCompanies();
    const companyMap = new Map(companies.map(c => [c.name.toLowerCase(), c]));

    console.log(`[Cron:EnrichCompanies] Loaded ${companies.length} trusted companies.`);

    // 优先使用 Neon 数据库
    let totalJobs = 0;
    let updatedCount = 0;
    let trustedCount = 0;
    let aiClassifiedCount = 0;
    if (NEON_CONFIGURED) {
      console.log('✅ 检测到 Neon 数据库配置，使用数据库分页处理模式');

      // 分页获取处理后的岗位数据
      const pageSize = Number(process.env.CRON_PAGE_SIZE || '200');

      // 获取总数
      const total = await countJobsFromNeon({ isAdmin: true });
      const totalPages = Math.ceil(total / pageSize) || 1;
      console.log(`🗂️ 数据库中共有 ${total} 个岗位，预计分 ${totalPages} 页处理`);

      // 发送总数信息
      res.write(`event: total\ndata: ${JSON.stringify({
        type: 'total',
        totalJobs: total,
        totalPages: totalPages,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // 发送扫描完成消息
      res.write(`event: scan_complete\ndata: ${JSON.stringify({
        type: 'scan_complete',
        totalJobs: total,
        totalCompanies: companies.length,
        message: `扫描完成：${total} 个岗位，${companies.length} 个可信公司`,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // 逐页处理
      for (let page = 1; page <= totalPages; page++) {
        console.log(`Processing page ${page}/${totalPages}...`);

        // 发送页面开始处理信息
        res.write(`event: page_start\ndata: ${JSON.stringify({
          type: 'page_start',
          page: page,
          totalPages: totalPages,
          timestamp: new Date().toISOString()
        })}\n\n`);

        // 读取一页数据
        // Fix: Add isAdmin: true to process all jobs regardless of approval status
        const jobs = await readJobsFromNeon({ isAdmin: true }, { page, limit: pageSize });
        if (!jobs || jobs.length === 0) {
          res.write(`event: page_skip\ndata: ${JSON.stringify({
            type: 'page_skip',
            page: page,
            reason: '无数据',
            timestamp: new Date().toISOString()
          })}\n\n`);
          continue;
        }

        totalJobs += jobs.length;

        // 发送处理开始消息
        res.write(`event: processing_start\ndata: ${JSON.stringify({
          type: 'processing_start',
          page: page,
          totalJobs: jobs.length,
          message: `开始处理第 ${page} 页 ${jobs.length} 个岗位的公司信息`,
          timestamp: new Date().toISOString()
        })}\n\n`);

        const enrichedJobs = jobs.map((job, index) => {
          let changed = false;
          let updateType = 'none';
          const jobCompanyLower = (job.company || '').toLowerCase();

          // 1. Match with Trusted Companies
          if (companyMap.has(jobCompanyLower)) {
            const tc = companyMap.get(jobCompanyLower);

            if (job.companyId !== tc.id) { job.companyId = tc.id; changed = true; }
            if (!job.companyWebsite && tc.website) { job.companyWebsite = tc.website; changed = true; }
            if (!job.companyDescription && tc.description) { job.companyDescription = tc.description; changed = true; }
            if (!job.companyIndustry && tc.industry) { job.companyIndustry = tc.industry; changed = true; }
            if (!job.isTrusted) { job.isTrusted = true; changed = true; }

            if (changed) {
              updateType = 'trusted';
              trustedCount++;
            }
          }
          // 2. AI Classification for Industry/Tags (if not trusted)
          else if (!job.companyIndustry || !job.companyTags || job.companyTags.length === 0) {
            // Only if we have a description to analyze
            if (job.description && job.description.length > 100) {
              const analysis = classifyCompany(job.company, job.description);
              if (analysis.industry !== '其他') {
                job.companyIndustry = analysis.industry;
                changed = true;
              }
              if (analysis.tags.length > 0) {
                job.companyTags = analysis.tags;
                changed = true;
              }

              if (changed) {
                updateType = 'ai_classified';
                aiClassifiedCount++;
              }
            }
          }

          if (changed) updatedCount++;
          return job;
        });

        // 发送页面统计信息
        const pageUpdatedCount = enrichedJobs.filter(job => {
          const jobCompanyLower = (job.company || '').toLowerCase();
          const isTrusted = companyMap.has(jobCompanyLower);
          const hasDescription = job.description && job.description.length > 100;
          const needsAI = !job.companyIndustry || !job.companyTags || job.companyTags.length === 0;

          return isTrusted || (needsAI && hasDescription);
        }).length;

        res.write(`event: page_stats\ndata: ${JSON.stringify({
          type: 'page_stats',
          page: page,
          totalJobs: jobs.length,
          updatedCount: pageUpdatedCount,
          timestamp: new Date().toISOString()
        })}\n\n`);

        if (pageUpdatedCount > 0) {
          // 发送保存开始消息
          res.write(`event: save_start\ndata: ${JSON.stringify({
            type: 'save_start',
            page: page,
            totalJobs: enrichedJobs.length,
            message: '开始保存更新后的岗位数据',
            timestamp: new Date().toISOString()
          })}\n\n`);

          // 使用 upsert 模式保存当前页的数据
          await writeJobsToNeon(enrichedJobs, 'upsert');

          // 发送保存完成消息
          res.write(`event: save_complete\ndata: ${JSON.stringify({
            type: 'save_complete',
            page: page,
            savedCount: enrichedJobs.length,
            message: `第 ${page} 页保存完成：共保存 ${enrichedJobs.length} 个岗位数据`,
            timestamp: new Date().toISOString()
          })}\n\n`);

          console.log(`[Cron:EnrichCompanies] Page ${page} updated ${pageUpdatedCount} jobs with company info.`);
        } else {
          // 发送页面无需更新消息
          res.write(`event: page_skip\ndata: ${JSON.stringify({
            type: 'page_skip',
            page: page,
            reason: '无需要更新的数据',
            timestamp: new Date().toISOString()
          })}\n\n`);
        }

        // 发送页面完成信息
        res.write(`event: page_complete\ndata: ${JSON.stringify({
          type: 'page_complete',
          page: page,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }

      // 发送处理完成统计消息
      res.write(`event: processing_complete\ndata: ${JSON.stringify({
        type: 'processing_complete',
        updatedCount: updatedCount,
        trustedCount: trustedCount,
        aiClassifiedCount: aiClassifiedCount,
        message: `处理完成：${updatedCount} 个岗位已更新（${trustedCount} 个可信公司匹配，${aiClassifiedCount} 个AI分类）`,
        timestamp: new Date().toISOString()
      })}\n\n`);

      if (updatedCount > 0) {
        console.log(`[Cron:EnrichCompanies] Updated ${updatedCount} jobs with company info.`);
      } else {
        // 发送无需更新消息
        res.write(`event: no_updates\ndata: ${JSON.stringify({
          type: 'no_updates',
          message: '没有需要更新的岗位数据',
          timestamp: new Date().toISOString()
        })}\n\n`);

        console.log('[Cron:EnrichCompanies] No jobs needed enrichment.');
      }
    }

    console.log('[Cron:EnrichCompanies] Completed successfully.');

    // 发送任务完成消息
    res.write(`event: complete\ndata: ${JSON.stringify({
      type: 'complete',
      stats: {
        totalJobs: totalJobs,
        updatedJobs: updatedCount,
        trustedMatches: trustedCount,
        aiClassifications: aiClassifiedCount,
        noUpdates: totalJobs - updatedCount
      },
      message: `任务完成：共处理 ${totalJobs} 个岗位，更新 ${updatedCount} 个`,
      timestamp: new Date().toISOString()
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('[Cron:EnrichCompanies] Error:', error);

    if (neonHelper.isConfigured) {
      try {
        await neonHelper.query(
          'INSERT INTO admin_messages (type, title, content) VALUES ($1, $2, $3)',
          ['system_error', '定时任务异常：公司信息丰富化', error.message]
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
