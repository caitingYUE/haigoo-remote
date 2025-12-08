import { readAllRawItems, saveRawItems } from '../api-handlers/raw-rss.js';
import { saveAllJobs } from '../api-handlers/processed-jobs.js';
import { classifyJob, determineExperienceLevel } from '../services/classification-service.js';
import { fetchJobDetails } from '../job-crawler.js';

// Helper to clean company name
function extractCompany(title, description) {
  // Common patterns: "Role at Company", "Company: Role", "Role - Company"
  const atPattern = /\s+at\s+([^(\-|,)]+)/i;
  const colonPattern = /^([^:]+):\s/;
  const dashPattern = /\s+-\s+([^-]+)$/;

  let company = 'Unknown Company';

  // Try extracting from Title first (most reliable)
  const atMatch = title.match(atPattern);
  if (atMatch && atMatch[1].length < 50) return atMatch[1].trim();

  const colonMatch = title.match(colonPattern);
  if (colonMatch && colonMatch[1].length < 50) return colonMatch[1].trim();

  const dashMatch = title.match(dashPattern);
  if (dashMatch && dashMatch[1].length < 50) return dashMatch[1].trim();

  return company;
}

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
    console.log(new Date().toISOString(), "UA:", req.headers["user-agent"], "IP:", req.headers["x-forwarded-for"], "Referer:", req.headers.referer);

    console.log('[Cron:ProcessRSS] Starting...');

    // 设置流式响应头
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    });

    // 发送开始消息
    res.write(JSON.stringify({
      type: 'start',
      message: 'RSS数据处理任务开始',
      timestamp: new Date().toISOString()
    }) + '\n');

    let totalProcessed = 0;
    let totalEnriched = 0;
    let batchNumber = 1;
    const BATCH_SIZE = 50;

    // 🔧 OPTIMIZATION: Process all raw items in batches until none left
    while (true) {
      console.log(`[Cron:ProcessRSS] Processing batch ${batchNumber}...`);

      // 发送批次开始消息
      res.write(JSON.stringify({
        type: 'batch_start',
        message: `开始处理第 ${batchNumber} 批次`,
        batchNumber: batchNumber,
        timestamp: new Date().toISOString()
      }) + '\n');

      // 1. Read Raw Items (Only unprocessed)
      const newItems = await readAllRawItems({ status: 'raw', limit: BATCH_SIZE });

      console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Found ${newItems.length} raw items to process.`);

      // 发送读取完成消息
      res.write(JSON.stringify({
        type: 'read_complete',
        message: `读取到 ${newItems.length} 个待处理项目`,
        batchNumber: batchNumber,
        itemCount: newItems.length,
        timestamp: new Date().toISOString()
      }) + '\n');

      if (newItems.length === 0) {
        console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: No more raw items found. Processing complete.`);
        // 发送无数据消息
        res.write(JSON.stringify({
          type: 'no_data',
          message: '没有更多待处理的数据',
          batchNumber: batchNumber,
          timestamp: new Date().toISOString()
        }) + '\n');
        break;
      }

      // 2. Process Items (Classify, Tag & Enrich)
      // Use limited concurrency to prevent overloading target sites
      const processedJobs = await pLimit(newItems, 3, async (item, index) => {
        console.log(`[Cron:ProcessRSS] Processing item: ${item.title.substring(0, 50)}...`);

        // 发送单个项目开始处理消息
        res.write(JSON.stringify({
          type: 'item_processing',
          message: `处理项目: ${item.title.substring(0, 50)}...`,
          batchNumber: batchNumber,
          itemIndex: index + 1,
          totalItems: newItems.length,
          timestamp: new Date().toISOString()
        }) + '\n');

        const category = classifyJob(item.title, item.description);
        const experienceLevel = determineExperienceLevel(item.title, item.description);
        const company = extractCompany(item.title, item.description);

        let description = item.description || '';
        let requirements = [];
        let benefits = [];
        let enriched = false;

        // Check if enrichment is needed (e.g., description too short)
        if (item.link && (!description || description.length < 500)) {
          console.log(`[Cron:ProcessRSS] Enriching short description for: ${item.title}`);
          try {
            const details = await fetchJobDetails(item.link);
            if (details) {
              if (details.description && details.description.length > description.length) {
                description = details.description;
                requirements = details.requirements || [];
                benefits = details.benefits || [];
                enriched = true;
              }
              // 🔧 ENRICHMENT: Use crawled company info
              if (details.company && details.company.name) {
                company = details.company.name;
              }
              console.log(`[Cron:ProcessRSS] Successfully enriched: ${item.title} (${description.length} chars)`);
              
              // 发送丰富化成功消息
              res.write(JSON.stringify({
                type: 'item_enriched',
                message: `项目丰富化完成: ${item.title.substring(0, 50)}`,
                batchNumber: batchNumber,
                itemIndex: index + 1,
                descriptionLength: description.length,
                timestamp: new Date().toISOString()
              }) + '\n');
            }
          } catch (e) {
            console.warn(`[Cron:ProcessRSS] Enrichment failed for ${item.link}:`, e.message);
            // 发送丰富化失败消息
            res.write(JSON.stringify({
              type: 'item_enrich_failed',
              message: `项目丰富化失败: ${item.title.substring(0, 50)}`,
              batchNumber: batchNumber,
              itemIndex: index + 1,
              error: e.message,
              timestamp: new Date().toISOString()
            }) + '\n');
          }
        }

        // Map Raw Item to Processed Job Structure
        return {
          id: item.id, // Use same ID to link them
          title: item.title,
          company: company,
          location: 'Remote', // Default for RSS
          description: description,
          url: item.link,
          publishedAt: item.pubDate,
          source: item.source,
          category: category, // AI Classified
          salary: null,
          jobType: 'full-time', // Default
          experienceLevel: experienceLevel, // AI Classified
          tags: [], // Can implement Tag extraction here if needed
          requirements: requirements,
          benefits: benefits,
          isRemote: true,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          region: 'overseas', // Default for WeWorkRemotely etc.
          sourceType: 'rss',
          isTrusted: false,
          canRefer: false,
          isTranslated: false, // Mark for translation
          enriched: enriched
        };
      });

      // 3. Save to Processed Jobs DB (UPSERT MODE)
      // Optimized: Only send new items, let DB handle upsert
      
      // 发送保存开始消息
      res.write(JSON.stringify({
        type: 'save_start',
        message: '开始保存处理后的岗位数据',
        batchNumber: batchNumber,
        itemCount: processedJobs.length,
        timestamp: new Date().toISOString()
      }) + '\n');

      const saved = await saveAllJobs(processedJobs, 'upsert');

      console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Saved ${saved.length} jobs (processed ${processedJobs.length} new).`);

      // 发送保存完成消息
      res.write(JSON.stringify({
        type: 'save_complete',
        message: `保存完成: ${saved.length} 个岗位数据`,
        batchNumber: batchNumber,
        savedCount: saved.length,
        timestamp: new Date().toISOString()
      }) + '\n');

      // 4. Update Raw Items Status
      const updatedRawItems = newItems.map(item => ({
        ...item,
        status: 'processed'
      }));

      // Only update the items we processed
      if (updatedRawItems.length > 0) {
        // 发送状态更新开始消息
        res.write(JSON.stringify({
          type: 'status_update_start',
          message: '开始更新原始数据状态',
          batchNumber: batchNumber,
          itemCount: updatedRawItems.length,
          timestamp: new Date().toISOString()
        }) + '\n');

        await saveRawItems(updatedRawItems, 'append'); // 'append' maps to upsert in raw-rss logic
        console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Updated ${updatedRawItems.length} raw items status to 'processed'.`);

        // 发送状态更新完成消息
        res.write(JSON.stringify({
          type: 'status_update_complete',
          message: `状态更新完成: ${updatedRawItems.length} 个项目`,
          batchNumber: batchNumber,
          updatedCount: updatedRawItems.length,
          timestamp: new Date().toISOString()
        }) + '\n');
      }

      // 统计丰富化数量
      const enrichedCount = processedJobs.filter(job => job.enriched).length;
      totalEnriched += enrichedCount;
      totalProcessed += processedJobs.length;

      // 发送批次完成消息
      res.write(JSON.stringify({
        type: 'batch_complete',
        message: `第 ${batchNumber} 批次处理完成`,
        batchNumber: batchNumber,
        processedCount: processedJobs.length,
        enrichedCount: enrichedCount,
        totalProcessed: totalProcessed,
        totalEnriched: totalEnriched,
        timestamp: new Date().toISOString()
      }) + '\n');

      console.log(`[Cron:ProcessRSS] Batch ${batchNumber} completed. Total processed so far: ${totalProcessed}`);

      batchNumber++;

      // If we got less than batch size, we've processed all available items
      if (newItems.length < BATCH_SIZE) {
        console.log(`[Cron:ProcessRSS] Last batch processed (${newItems.length} items). All raw items have been processed.`);
        break;
      }
    }

    console.log(`[Cron:ProcessRSS] Completed successfully. Total jobs processed: ${totalProcessed} in ${batchNumber - 1} batches`);

    // 发送最终完成消息并结束流
    res.write(JSON.stringify({
      type: 'complete',
      message: 'RSS数据处理任务完成',
      stats: {
        totalProcessed: totalProcessed,
        totalBatches: batchNumber - 1,
        totalEnriched: totalEnriched,
        enrichedPercentage: totalProcessed > 0 ? Math.round((totalEnriched / totalProcessed) * 100) : 0
      },
      timestamp: new Date().toISOString()
    }) + '\n');

    res.end();

  } catch (error) {
    console.error('[Cron:ProcessRSS] Error:', error);
    
    // 发送错误消息并结束流
    res.write(JSON.stringify({
      type: 'error',
      message: 'RSS数据处理任务失败',
      error: error.message,
      timestamp: new Date().toISOString()
    }) + '\n');
    
    res.end();
  }
}
