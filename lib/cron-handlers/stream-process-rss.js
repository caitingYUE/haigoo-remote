import { readAllRawItems, saveRawItems } from '../api-handlers/raw-rss.js';
import { writeJobsToNeon } from '../api-handlers/processed-jobs.js';
import { classifyJob, classifyCompany, determineExperienceLevel, extractSalary, extractLocation, classifyRegion, isExplicitlyOverseas } from '../services/classification-service.js';
import { fetchJobDetails } from '../job-crawler.js';
import neonHelper from '../../server-utils/dal/neon-helper.js';

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
    const enableDeepEnrich = req.query.deepEnrich === 'true' || req.body?.deepEnrich === true;

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
      message: enableDeepEnrich ? 'RSS数据处理任务开始（深度模式）' : 'RSS数据处理任务开始（轻量模式）',
      timestamp: new Date().toISOString()
    })}\n\n`);

    let totalProcessed = 0;
    let totalEnriched = 0;
    let batchNumber = 1;
    const BATCH_SIZE = 50;
    const MAX_BATCHES = 20; // Safety limit: max 1000 items per run to prevent timeout/loops

    // 🔧 OPTIMIZATION: Process all raw items in batches until none left
    while (true) {
      if (batchNumber > MAX_BATCHES) {
        console.log(`[Cron:ProcessRSS] Reached max batches (${MAX_BATCHES}). Stopping to prevent timeout.`);
        res.write(`event: max_limit_reached\ndata: ${JSON.stringify({
          type: 'warning',
          message: `已达到最大批次限制 (${MAX_BATCHES})，停止处理以防止超时`,
          timestamp: new Date().toISOString()
        })}\n\n`);
        break;
      }

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
          let url = item.link || item.url || '';

          if (!title) {
            throw new Error('Title is missing');
          }

          // ⏱ Expiry check: skip jobs published more than 7 days ago
          const MAX_JOB_AGE_DAYS = 7;
          const pubDateStr = item.pubDate || item.fetchedAt;
          if (pubDateStr) {
            const pubDate = new Date(pubDateStr);
            const ageMs = Date.now() - pubDate.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            if (ageDays > MAX_JOB_AGE_DAYS) {
              console.log(`[Cron:ProcessRSS] Skipping expired job (${Math.round(ageDays)}d old): ${title.substring(0, 50)}`);
              return { status: 'skipped', id: item.id, reason: 'expired' };
            }
          }

          const category = classifyJob(title, rawDescription);
          const experienceLevel = determineExperienceLevel(title, rawDescription);
          let company = extractCompany(title, rawDescription, url);

          // 🔧 ENRICHMENT: Parse rawContent for better fields (from specialized parsers)
          let rawData = {};
          try {
            if (item.rawContent) {
              rawData = JSON.parse(item.rawContent);
            }
          } catch (e) {
            console.warn(`[Cron:ProcessRSS] Failed to parse rawContent for ${item.id}`, e);
          }

          // 🔧 ENRICHMENT: Extract Salary and Location from text (Fallback)
          const combinedText = title + ' ' + rawDescription;
          const extractedSalary = rawData.salary || extractSalary(combinedText);
          const extractedLocation = rawData.location || extractLocation(combinedText);
          const jobType = rawData.jobType || 'Full-time';
          // Derive industry: prefer RSS-provided value, then auto-classify from company name + description
          let industry = rawData.companyIndustry || rawData.industry || null;
          if (!industry) {
            const classified = classifyCompany(company, rawDescription);
            // Only use the classification if it returned a meaningful (non-fallback) industry
            industry = classified.industry !== '其他' ? classified.industry : null;
          }

          let description = rawData.description || rawDescription; // Prefer cleaned description from parser
          let requirements = rawData.requirements || [];
          let benefits = rawData.benefits || [];
          let enriched = false;

          // RSS 定时处理默认仅做轻量字段提取，深度抓取只在手动开启时执行
          if (enableDeepEnrich && url && (!description || description.length < 500)) {
            try {
              const details = await fetchJobDetails(url, true);
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

          // Classify region dynamically from extracted location
          const effectiveLocation = extractedLocation || rawData.location || '';
          const classifiedRegion = classifyRegion(effectiveLocation);

          // ────────────────────────────────────────────────────────────
          // Process-stage location filter:
          // After all enrichment is done, do a final check to skip jobs that are
          // explicitly constrained to an overseas location (city OR country) and
          // show NO remote/global signal in the combined text.
          // ────────────────────────────────────────────────────────────
          const PROCESS_REMOTE_RE = /\b(remote|anywhere|worldwide|global|distributed|wfa|work from anywhere|不限地点|全球|远程|不限|global.remote)\b/i;
          if (effectiveLocation && isExplicitlyOverseas(effectiveLocation)) {
            const fullText = `${title} ${description} ${effectiveLocation}`;
            const hasRemote = PROCESS_REMOTE_RE.test(fullText);
            if (!hasRemote) {
              console.log(`[Cron:ProcessRSS] Skip overseas-only job: "${title}" (location: ${effectiveLocation})`);
              return {
                status: 'skipped',
                id: item.id,
                reason: `overseas-only: ${effectiveLocation}`
              };
            }
          }

          // Map Raw Item to Processed Job Structure
          return {
            status: 'success',
            data: {
              id: item.id, // Use same ID to link them
              title: title,
              company: company,
              location: effectiveLocation || 'Remote', // Use extracted location or default to Remote
              description: description,
              url: url,
              publishedAt: item.pubDate,
              source: item.source,
              category: category, // AI Classified
              salary: extractedSalary, // Use extracted salary
              jobType: jobType, // Use extracted or default
              experienceLevel: experienceLevel, // AI Classified
              tags: [], // Use parsed skills as tags
              requirements: requirements,
              benefits: benefits,
              industry: industry, // Mapped industry field
              isRemote: true,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              region: classifiedRegion, // Dynamically classified from location
              sourceType: 'rss', // Explicitly mark as RSS
              isTrusted: false,
              canRefer: false,
              isApproved: false, // RSS jobs require admin review before going live
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
      const skippedItems = results.filter(r => r.status === 'skipped');
      const failedItems = results.filter(r => r.status === 'error');

      if (skippedItems.length > 0) {
        console.log(`[Cron:ProcessRSS] Batch ${batchNumber}: Skipped ${skippedItems.length} expired/filtered items.`);
        // Mark skipped raw items as 'processed' so they don't get picked up again
        const skippedRaw = newItems
          .filter(item => skippedItems.some(s => s.id === item.id))
          .map(item => ({ ...item, status: 'processed' }));
        if (skippedRaw.length > 0) await saveRawItems(skippedRaw, 'append');
      }

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
      message: enableDeepEnrich ? 'RSS数据处理任务完成（深度模式）' : 'RSS数据处理任务完成（轻量模式）',
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

    if (neonHelper.isConfigured) {
      try {
        await neonHelper.query(
          'INSERT INTO admin_messages (type, title, content) VALUES ($1, $2, $3)',
          ['system_error', '定时任务异常：处理RSS数据', error.message]
        )
      } catch (err) {
        console.error('[Cron] Failed to insert admin message', err)
      }
    }

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
