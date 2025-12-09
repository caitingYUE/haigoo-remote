import { getAllJobs, saveAllJobs } from '../api-handlers/processed-jobs.js';
import { getAllCompanies } from '../api-handlers/trusted-companies.js';
import { classifyCompany } from '../services/classification-service.js';

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

    const [jobs, companies] = await Promise.all([
      getAllJobs(),
      getAllCompanies()
    ]);

    console.log(`[Cron:EnrichCompanies] Scanned ${jobs.length} jobs and ${companies.length} trusted companies.`);

    // 发送扫描完成消息
    res.write(`event: scan_complete\ndata: ${JSON.stringify({
      type: 'scan_complete',
      totalJobs: jobs.length,
      totalCompanies: companies.length,
      message: `扫描完成：${jobs.length} 个岗位，${companies.length} 个可信公司`,
      timestamp: new Date().toISOString()
    })}\n\n`);

    let updatedCount = 0;
    let trustedCount = 0;
    let aiClassifiedCount = 0;
    const companyMap = new Map(companies.map(c => [c.name.toLowerCase(), c]));

    // 发送处理开始消息
    res.write(`event: processing_start\ndata: ${JSON.stringify({
      type: 'processing_start',
      totalJobs: jobs.length,
      message: `开始处理 ${jobs.length} 个岗位的公司信息`,
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

      // 发送单个岗位处理进度
      // if (changed) {
      //   res.write(JSON.stringify({
      //     type: 'job_updated',
      //     jobIndex: index + 1,
      //     totalJobs: jobs.length,
      //     company: job.company,
      //     updateType: updateType,
      //     message: `岗位 ${index + 1}/${jobs.length}: ${job.company} (${updateType === 'trusted' ? '可信公司匹配' : 'AI分类'})`,
      //     timestamp: new Date().toISOString()
      //   }) + '\n');
      // }

      if (changed) updatedCount++;
      return job;
    });

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
      // 发送保存开始消息
      res.write(`event: save_start\ndata: ${JSON.stringify({
        type: 'save_start',
        totalJobs: enrichedJobs.length,
        message: '开始保存更新后的岗位数据',
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      await saveAllJobs(enrichedJobs);
      
      // 发送保存完成消息
      res.write(`event: save_complete\ndata: ${JSON.stringify({
        type: 'save_complete',
        savedCount: enrichedJobs.length,
        message: `保存完成：共保存 ${enrichedJobs.length} 个岗位数据`,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
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

    console.log('[Cron:EnrichCompanies] Completed successfully.');

    // 发送任务完成消息
    res.write(`event: complete\ndata: ${JSON.stringify({
      type: 'complete',
      stats: {
        totalJobs: jobs.length,
        updatedJobs: updatedCount,
        trustedMatches: trustedCount,
        aiClassifications: aiClassifiedCount,
        noUpdates: jobs.length - updatedCount
      },
      message: `任务完成：共处理 ${jobs.length} 个岗位，更新 ${updatedCount} 个`,
      timestamp: new Date().toISOString()
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('[Cron:EnrichCompanies] Error:', error);
    
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
