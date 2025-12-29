import { readAllRawItems, saveRawItems } from '../api-handlers/raw-rss.js';
import { writeJobsToNeon } from '../api-handlers/processed-jobs.js';
import { classifyJob, determineExperienceLevel, extractSalary, extractLocation } from '../services/classification-service.js';
import { fetchJobDetails } from '../job-crawler.js';

// Helper to clean company name
function extractCompany(title, description, url) {
  // 1. Try URL Extraction (Himalayas) - Most Reliable for this source
  if (url && url.includes('himalayas.app/companies/')) {
    const himalayasUrlPattern = /himalayas\.app\/companies\/([^\/]+)/;
    const urlMatch = url.match(himalayasUrlPattern);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  // 2. Common patterns: "Role at Company", "Company: Role", "Role - Company"
  const atPattern = /\s+at\s+([^(\-|,)]+)/i;
  const colonPattern = /^([^:]+):\s/;
  const dashPattern = /\s+-\s+([^-]+)$/;

  // Try extracting from Title first (most reliable)
  const atMatch = title.match(atPattern);
  if (atMatch && atMatch[1].length < 50) return atMatch[1].trim();

  const colonMatch = title.match(colonPattern);
  if (colonMatch && colonMatch[1].length < 50) return colonMatch[1].trim();

  const dashMatch = title.match(dashPattern);
  if (dashMatch && dashMatch[1].length < 50) return dashMatch[1].trim();

  // 3. Fallback: Check description for "About [Company]" pattern (Common in Himalayas RSS)
  // Look for: "About <a href="...">Company</a>" or "About Company"
  if (description) {
    // HTML Pattern (Himalayas uses this consistently)
    const aboutLinkPattern = /About\s*<a[^>]*>([^<]+)<\/a>/i;
    const aboutLinkMatch = description.match(aboutLinkPattern);
    if (aboutLinkMatch && aboutLinkMatch[1].length < 100) return aboutLinkMatch[1].trim();

    // Plain Text Pattern (About Company...)
    // Be careful not to capture too much. Usually "About Company\n" or "About Company."
    const aboutTextPattern = /About\s+([A-Z][a-zA-Z0-9 &,.]{1,50})(?:\s+is|\s+was|\n|\.|:)/;
    const aboutTextMatch = description.match(aboutTextPattern);
    // Ensure it starts with Uppercase to avoid "About the role"
    if (aboutTextMatch && aboutTextMatch[1] && !aboutTextMatch[1].toLowerCase().includes('the role')) {
      return aboutTextMatch[1].trim();
    }

    // Himalayas specific: Extract from company link if present in description
    // https://himalayas.app/companies/company-name
    const himalayasLinkPattern = /himalayas\.app\/companies\/([^\/"\s>]+)/;
    const himalayasMatch = description.match(himalayasLinkPattern);
    if (himalayasMatch && himalayasMatch[1]) {
      // Convert slug to Title Case (e.g., "aecom" -> "Aecom", "remote-com" -> "Remote Com")
      return himalayasMatch[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return 'Unknown Company';
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
    console.log('[Cron:ProcessRSS] Starting...');

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 发送开始消息
    res.write(`event: start\ndata: ${JSON.stringify({
      type: 'start',
      message: 'RSS数据处理任务开始',
      timestamp: new Date().toISOString()
    })}\n\n`);

    let totalProcessed = 0;
    let totalEnriched = 0;
    let batchNumber = 1;
    const BATCH_SIZE = 50;

    // 🔧 OPTIMIZATION: Process all raw items in batches until none left
    while (true) {
      console.log(`[Cron:ProcessRSS] Processing batch ${batchNumber}...`);

      // 发送批次开始消息
      res.write(`event: batch_start\ndata: ${JSON.stringify({
        type: 'batch_start',
        message: `开始处理第 ${batchNumber} 批次`,
        batchNumber: batchNumber,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // 1. Read Raw Items (Only unprocessed)
      const newItems = await readAllRawItems({ status: 'raw', limit: BATCH_SIZE });

      console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Found ${newItems.length} raw items to process.`);

      // 发送读取完成消息
      res.write(`event: read_complete\ndata: ${JSON.stringify({
        type: 'read_complete',
        message: `读取到 ${newItems.length} 个待处理项目`,
        batchNumber: batchNumber,
        itemCount: newItems.length,
        timestamp: new Date().toISOString()
      })}\n\n`);

      if (newItems.length === 0) {
        console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: No more raw items found. Processing complete.`);
        // 发送无数据消息
        res.write(`event: no_data\ndata: ${JSON.stringify({
          type: 'no_data',
          message: '没有更多待处理的数据',
          batchNumber: batchNumber,
          timestamp: new Date().toISOString()
        })}\n\n`);
        break;
      }

      // 2. Process Items (Classify, Tag & Enrich)
      // Use limited concurrency to prevent overloading target sites
      const results = await pLimit(newItems, 3, async (item, index) => {
        try {
          // 发送单个项目开始处理消息
          res.write(`event: item_processing\ndata: ${JSON.stringify({
            type: 'item_processing',
            message: `处理项目: ${item.title ? item.title.substring(0, 50) : 'No Title'}...`,
            batchNumber: batchNumber,
            itemIndex: index + 1,
            totalItems: newItems.length,
            timestamp: new Date().toISOString()
          })}\n\n`);

          // Safety checks for null fields
          const title = item.title || '';
          const rawDescription = item.description || '';
          const url = item.link || item.url || '';

          if (!title) {
            throw new Error('Title is missing');
          }

          const category = classifyJob(title, rawDescription);
          const experienceLevel = determineExperienceLevel(title, rawDescription);
          let company = extractCompany(title, rawDescription, url);

          // 🔧 ENRICHMENT: Extract Salary and Location from text
          const combinedText = title + ' ' + rawDescription;
          const extractedSalary = extractSalary(combinedText);
          const extractedLocation = extractLocation(combinedText);

          let description = rawDescription;
          let requirements = [];
          let benefits = [];
          let enriched = false;

          // Check if enrichment is needed (e.g., description too short)
          if (url && (!description || description.length < 500)) {
            try {
              const details = await fetchJobDetails(url);
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
                console.log(`[Cron:ProcessRSS] Successfully enriched: ${title} (${description.length} chars)`);

                // 发送丰富化成功消息
                res.write(`event: item_enriched\ndata: ${JSON.stringify({
                  type: 'item_enriched',
                  message: `项目丰富化完成: ${title.substring(0, 50)}`,
                  batchNumber: batchNumber,
                  itemIndex: index + 1,
                  descriptionLength: description.length,
                  timestamp: new Date().toISOString()
                })}\n\n`);
              }
            } catch (e) {
              console.warn(`[Cron:ProcessRSS] Enrichment failed for ${url}:`, e.message);
              // 发送丰富化失败消息
              res.write(`event: item_enrich_failed\ndata: ${JSON.stringify({
                type: 'item_enrich_failed',
                message: `项目丰富化失败: ${title.substring(0, 50)}`,
                batchNumber: batchNumber,
                itemIndex: index + 1,
                error: e.message,
                timestamp: new Date().toISOString()
              })}\n\n`);
            }
          }

          // Map Raw Item to Processed Job Structure
          return {
            status: 'success',
            data: {
              id: item.id, // Use same ID to link them
              title: title,
              company: company,
              location: extractedLocation || 'Remote', // Use extracted location or default to Remote
              description: description,
              url: url,
              publishedAt: item.pubDate,
              source: item.source,
              category: category, // AI Classified
              salary: extractedSalary, // Use extracted salary
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
              sourceType: 'rss', // Explicitly mark as RSS
              isTrusted: false,
              canRefer: false,
              isTranslated: false, // Mark for translation
              enriched: enriched
            }
          };
        } catch (error) {
          console.error(`[Cron:ProcessRSS] Error processing item ${item.id}:`, error);
          return {
            status: 'error',
            id: item.id,
            error: error.message
          };
        }
      });

      const processedJobs = results.filter(r => r.status === 'success').map(r => r.data);
      const failedItems = results.filter(r => r.status === 'error');

      // 3. Save to Processed Jobs DB (UPSERT MODE)
      // Optimized: Only send new items, let DB handle upsert

      if (processedJobs.length > 0) {
        // 发送保存开始消息
        res.write(`event: save_start\ndata: ${JSON.stringify({
          type: 'save_start',
          message: '开始保存处理后的岗位数据',
          batchNumber: batchNumber,
          itemCount: processedJobs.length,
          timestamp: new Date().toISOString()
        })}\n\n`);

        const saved = await writeJobsToNeon(processedJobs, 'upsert');

        console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Saved ${saved.length} jobs.`);

        // 发送保存完成消息
        res.write(`event: save_complete\ndata: ${JSON.stringify({
          type: 'save_complete',
          message: `保存完成: ${saved.length} 个岗位数据`,
          batchNumber: batchNumber,
          savedCount: saved.length,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }

      // 4. Update Raw Items Status
      
      // Update success items
      const successIds = processedJobs.map(job => job.id);
      const successRawItems = newItems
        .filter(item => successIds.includes(item.id))
        .map(item => ({
          ...item,
          status: 'processed'
        }));
      
      // Update failed items
      const failedIds = failedItems.map(f => f.id);
      const failedRawItems = newItems
        .filter(item => failedIds.includes(item.id))
        .map(item => ({
          ...item,
          status: 'error',
          processingError: failedItems.find(f => f.id === item.id)?.error || 'Unknown error'
        }));

      const allUpdatedItems = [...successRawItems, ...failedRawItems];

      // Only update the items we processed
      if (allUpdatedItems.length > 0) {
        // 发送状态更新开始消息
        res.write(`event: status_update_start\ndata: ${JSON.stringify({
          type: 'status_update_start',
          message: '开始更新原始数据状态',
          batchNumber: batchNumber,
          itemCount: allUpdatedItems.length,
          timestamp: new Date().toISOString()
        })}\n\n`);

        await saveRawItems(allUpdatedItems, 'append'); // 'append' maps to upsert in raw-rss logic
        console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Updated ${successRawItems.length} processed, ${failedRawItems.length} error.`);

        // 发送状态更新完成消息
        res.write(`event: status_update_complete\ndata: ${JSON.stringify({
          type: 'status_update_complete',
          message: `状态更新完成: ${allUpdatedItems.length} 个项目`,
          batchNumber: batchNumber,
          updatedCount: allUpdatedItems.length,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }

      // BREAK THE LOOP to prevent infinite loop if status update fails or query returns same items
      // For safety, let's limit to 1 batch per run in this "emergency fix" mode
      console.log(`[Cron:ProcessRSS] Safety break after Batch ${batchNumber}. Trigger again if more items needed.`);
      break;

      // 统计丰富化数量

      const enrichedCount = processedJobs.filter(job => job.enriched).length;
      totalEnriched += enrichedCount;
      totalProcessed += processedJobs.length;

      // 发送批次完成消息
      res.write(`event: batch_complete\ndata: ${JSON.stringify({
        type: 'batch_complete',
        message: `第 ${batchNumber} 批次处理完成`,
        batchNumber: batchNumber,
        processedCount: processedJobs.length,
        enrichedCount: enrichedCount,
        totalProcessed: totalProcessed,
        totalEnriched: totalEnriched,
        timestamp: new Date().toISOString()
      })}\n\n`);

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
    res.write(`event: complete\ndata: ${JSON.stringify({
      type: 'complete',
      message: 'RSS数据处理任务完成',
      stats: {
        totalProcessed: totalProcessed,
        totalBatches: batchNumber - 1,
        totalEnriched: totalEnriched,
        enrichedPercentage: totalProcessed > 0 ? Math.round((totalEnriched / totalProcessed) * 100) : 0
      },
      timestamp: new Date().toISOString()
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('[Cron:ProcessRSS] Error:', error);

    // 发送错误消息并结束流
    res.write(`event: error\ndata: ${JSON.stringify({
      type: 'error',
      message: 'RSS数据处理任务失败',
      error: error.message,
      timestamp: new Date().toISOString()
    })}\n\n`);

    res.end();
  }
}
