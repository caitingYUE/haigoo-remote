/**
 * Vercel Cron Job: 翻译最近 7 天的 RSS 草稿岗位
 * 配置在 vercel.json 中，每日运行一次。
 *
 * 仅处理：
 * 1. source_type = 'rss'，以及历史上被归并到 third-party 的 RSS 草稿
 * 2. is_approved IS NOT TRUE
 * 3. 尚未翻译完成的岗位
 * 4. 最近 7 天自动导入的数据
 */

import { createRequire } from 'module'
import {
  writeJobsToNeon,
  NEON_CONFIGURED
} from '../api-handlers/processed-jobs.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { systemSettingsService } from '../services/system-settings-service.js'

const require = createRequire(import.meta.url)
const RSS_DRAFT_WHERE = `
  (
    source_type = 'rss'
    OR (
      source_type = 'third-party'
      AND COALESCE(source, '') <> 'manual'
      AND is_trusted IS NOT TRUE
      AND can_refer IS NOT TRUE
    )
  )
`

// 直接导入翻译服务
let translateJobs = null
let configureTranslation = null
let translationServiceType = 'none'

try {
  // 必须指向 .cjs 文件，因为它是 CommonJS 模块
  // 路径相对于当前文件: ../../lib/services/translation-service.cjs
  // 但我们在 lib/cron-handlers/, 所以是 ../services/translation-service.cjs
  const servicePath = '../services/translation-service.cjs'
  const service = require(servicePath)
  translateJobs = service.translateJobs
  configureTranslation = service.configure
  translationServiceType = 'real'
  console.log('✅ 翻译服务加载成功')
} catch (error) {
  console.error('❌ 翻译服务加载失败:', error)
  // 不要在这里抛出，让后面的 handler 处理并返回 JSON 错误
}

// 导出处理函数（ESM）
export default async function handler(req, res) {
  console.log('[Cron:TranslateJobs] VERSION: OPTIMIZED_KEYSET_PAGINATION_V1');

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // 验证授权（支持Vercel Cron和手动触发）
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'

  // 验证逻辑：
  if (!isVercelCron && isProduction && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '需要有效的授权令牌'
      })
    }
  }

  // 检查翻译服务是否可用
  if (!translateJobs) {
    res.write(`event: error\ndata: ${JSON.stringify({
      type: 'error',
      success: false,
      error: 'Translation Service Not Loaded',
      message: '无法加载翻译服务模块'
    })}\n\n`)
    res.end()
    return
  }

  /* 
   * 诊断模式：GET 请求且非 Vercel Cron 且非强制运行参数时
   * 返回当前状态
   */
  if (req.method === 'GET' && !isVercelCron && req.query.action !== 'run') {
    // Note: Since we set SSE headers above, we can't easily switch back to JSON.
    // So we send a single SSE event and close.
    res.write(`event: status\ndata: ${JSON.stringify({
      success: true,
      message: 'Service Ready',
      translationServiceType,
      timestamp: new Date().toISOString()
    })}\n\n`)
    res.end()
    return
  }

  let currentStep = 'init'

  try {
    console.log('🔄 开始定时任务: 翻译最近 7 天 RSS 草稿岗位')
    const startTime = Date.now()

    // 立即发送开始响应
    res.write(`event: start\ndata: ${JSON.stringify({
      type: 'start',
      message: '翻译任务开始执行（仅处理最近 7 天 RSS 草稿）',
      translationServiceType,
      timestamp: new Date().toISOString()
    })}\n\n`)

    // 1. 获取并应用系统设置
    const aiSetting = await systemSettingsService.getSetting('ai_translation_enabled');
    const hasAiKeys = !!(process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY);
    const aiEnabled = hasAiKeys ? (aiSetting?.value ?? true) : false;

    console.log(`🔧 系统设置: AI 翻译 ${aiEnabled ? '已启用' : '已禁用'} (Keys present: ${hasAiKeys})`);

    if (configureTranslation) {
      configureTranslation({ aiEnabled });
    }

    // 2. 批量处理逻辑 (Keyset Pagination)
    currentStep = 'fetch-jobs'

    // 配置
    // Vercel Function limit is 10s (hobby) or 60s (pro). 
    // We should be conservative. 
    // Cron ensures we run often.
    const MAX_EXECUTION_TIME = 55 * 1000; // 55秒安全限制
    const BATCH_SIZE = 10; // 降低Batch Size以提高稳定性
    const MAX_JOBS_PER_RUN = 50; // 限制每次运行最大处理数量，降低吞吐量

    let totalJobsScanned = 0
    let translatedJobsCount = 0
    let failedJobsCount = 0
    let lastSeenId = ''; // For keyset pagination

    if (NEON_CONFIGURED) {
      // 第一步：获取总数 (Estimation) for UI progress
      try {
        const countResult = await neonHelper.query(`
             SELECT COUNT(*) as count
             FROM jobs
             WHERE ${RSS_DRAFT_WHERE}
               AND is_approved IS NOT TRUE
               AND (is_translated IS NOT TRUE OR translations IS NULL)
               AND COALESCE(created_at, published_at) >= NOW() - INTERVAL '7 days'
           `);
        const totalEstimate = parseInt(countResult[0]?.count || '0');
        const totalPagesEstimate = Math.ceil(totalEstimate / BATCH_SIZE) || 1;

        res.write(`event: total\ndata: ${JSON.stringify({
          type: 'total',
          totalJobs: totalEstimate,
          totalPages: totalPagesEstimate,
          timestamp: new Date().toISOString()
        })}\n\n`)
      } catch (e) {
        console.warn('Failed to count jobs:', e);
      }

      let currentBatchNum = 0;

      while (true) {
        currentBatchNum++;

        // ⏱️ 超时检查 & 数量限制检查
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.warn(`⚠️ 任务即将超时 (${Math.round((Date.now() - startTime) / 1000)}s)，停止处理。`);
          res.write(`event: timeout_stop\ndata: ${JSON.stringify({
            type: 'timeout_stop',
            message: 'Execution time limit reached. Stopping safely.',
            processedBatches: currentBatchNum - 1,
            timestamp: new Date().toISOString()
          })}\n\n`);
          break;
        }

        if (totalJobsScanned >= MAX_JOBS_PER_RUN) {
            console.log(`⚠️ 达到单次运行最大数量限制 (${MAX_JOBS_PER_RUN})，停止处理。`);
            res.write(`event: limit_stop\ndata: ${JSON.stringify({
                type: 'limit_stop',
                message: `Reached max jobs limit per run (${MAX_JOBS_PER_RUN}).`,
                processedBatches: currentBatchNum - 1,
                timestamp: new Date().toISOString()
            })}\n\n`);
            break;
        }

        // 获取一批未翻译数据
        // Use canonical column names strictly
        const params = [];
        let paramIndex = 1;
        let query = `
                SELECT *
                FROM jobs
                WHERE ${RSS_DRAFT_WHERE}
                  AND is_approved IS NOT TRUE
                  AND (is_translated IS NOT TRUE OR translations IS NULL)
                  AND COALESCE(created_at, published_at) >= NOW() - INTERVAL '7 days'
            `;

        if (lastSeenId) {
          query += ` AND job_id > $${paramIndex}`;
          params.push(lastSeenId);
          paramIndex++;
        }

        query += ` ORDER BY job_id ASC LIMIT $${paramIndex}`;
        params.push(BATCH_SIZE);

        const jobsRaw = await neonHelper.query(query, params);

        // Helper to map DB row to Job object (copied from processed-jobs.js to ensure compatibility)
        const mapRowToJob = (row) => {
          const safeJsonParse = (val, fallback) => {
            if (typeof val === 'string') {
              try { return JSON.parse(val); } catch (e) { return fallback; }
            }
            return val || fallback;
          };

          return {
            id: row.job_id,
            title: row.title,
            company: row.company,
            location: row.location,
            description: row.description,
            url: row.url,
            publishedAt: row.published_at,
            source: row.source,
            category: row.category,
            salary: row.salary,
            jobType: row.job_type,
            experienceLevel: row.experience_level,
            tags: safeJsonParse(row.tags, []),
            requirements: safeJsonParse(row.requirements, []),
            benefits: safeJsonParse(row.benefits, []),
            isRemote: row.is_remote,
            status: row.status,
            region: row.region,
            timezone: row.timezone,
            translations: safeJsonParse(row.translations, null),
            isTranslated: row.is_translated,
            translatedAt: row.translated_at,
            companyId: row.company_id,
            sourceType: row.source_type,
            isTrusted: row.is_trusted,
            canRefer: row.can_refer,
            isFeatured: row.is_featured,
            isManuallyEdited: row.is_manually_edited,
            created_at: row.created_at, // Preserve for ordering/debugging
            updated_at: row.updated_at,
            riskRating: safeJsonParse(row.risk_rating, null),
            haigooComment: row.haigoo_comment,
            hiddenFields: safeJsonParse(row.hidden_fields, null),
            industry: row.industry,
            isApproved: row.is_approved
          };
        };

        const jobs = (jobsRaw || []).map(mapRowToJob);


        if (!jobs || jobs.length === 0) {
          if (currentBatchNum === 1) {
            res.write(`event: page_skip\ndata: ${JSON.stringify({
              type: 'page_skip',
              page: currentBatchNum,
              reason: 'No untranslated jobs found.',
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
          break; // 完成所有处理
        }

        // 更新游标
        lastSeenId = jobsRaw[jobsRaw.length - 1]?.job_id || jobs[jobs.length - 1]?.id || '';
        totalJobsScanned += jobs.length;

        console.log(`📊 Batch ${currentBatchNum}: Processing ${jobs.length} jobs...`);

        // Map DB rows to Job objects if necessary, or just pass to translator
        // Translator expects objects with { id, title, description ... }
        // neonHelper returns objects with db column names (usually lowercase)
        // Need to ensure camelCase mapping if the translator expects it? 
        // Checking translation-service.cjs: references job.title, job.description. DB returns title, description. MATCH.
        // But verify: Neon driver usually returns exactly what is in DB.

        // Execute Translation
        let translated = [];
        try {
          translated = await translateJobs(jobs);
        } catch (err) {
          console.error(`❌ Batch ${currentBatchNum} translation failed:`, err);
          failedJobsCount += jobs.length;
          res.write(`event: page_error\ndata: ${JSON.stringify({
            type: 'page_error',
            page: currentBatchNum,
            error: err.message,
            timestamp: new Date().toISOString()
          })}\n\n`);
          continue; // Try next batch? or stop? Try next.
        }

        const successCount = translated.filter(j => j.isTranslated).length;
        const failCount = translated.length - successCount;
        translatedJobsCount += successCount;
        failedJobsCount += failCount;

        // Save results
        const toSave = translated.filter(j => j && j.id && (j.isTranslated || j.translations === null));

        // Log Detailed Errors for debugging (so user sees "Why" in SSE)
        const failed = translated.filter(j => !j.isTranslated);
        if (failed.length > 0) {
          const reasons = failed.slice(0, 3).map(j => `ID:${j.id} (${j.translationError || 'Unknown'})`).join('; ');
          console.warn(`⚠️ Filtered Invalid: ${reasons}`);

          // Send a special log message event
          res.write(`event: log\ndata: ${JSON.stringify({
            type: 'log',
            message: `Validation Failed for ${failed.length} jobs. Sample: ${reasons}`,
            timestamp: new Date().toISOString()
          })}\n\n`);
        }

        if (toSave.length > 0) {
          try {
            // Upsert logic
            await writeJobsToNeon(toSave, 'upsert', true);

            // Aggregate Token Usage Logging
            let batchUsage = { input: 0, output: 0, total: 0 };
            toSave.forEach(j => {
              if (j.tokenUsage) {
                batchUsage.input += (j.tokenUsage.input || 0);
                batchUsage.output += (j.tokenUsage.output || 0);
                batchUsage.total += (j.tokenUsage.total || 0);
              }
            });

            if (batchUsage.total > 0) {
              try {
                await systemSettingsService.incrementTokenUsage(batchUsage, 'translation');
              } catch (tokenErr) {
                console.warn('Failed to log token usage:', tokenErr);
              }
            }

            res.write(`event: page_translated\ndata: ${JSON.stringify({
              type: 'page_translated',
              page: currentBatchNum,
              successCount: successCount,
              failCount: failCount,
              savedCount: toSave.length,
              timestamp: new Date().toISOString()
            })}\n\n`);

          } catch (saveErr) {
            console.error(`❌ Batch ${currentBatchNum} save failed:`, saveErr);

            // CRITICAL FIX: Report save failures properly
            failedJobsCount += toSave.length; // Mark all jobs in this batch as failed
            translatedJobsCount -= successCount; // Revert the success count

            res.write(`event: page_error\ndata: ${JSON.stringify({
              type: 'page_error',
              page: currentBatchNum,
              error: `Database save failed: ${saveErr.message}`,
              affectedJobs: toSave.length,
              timestamp: new Date().toISOString()
            })}\n\n`);

            // Continue to next batch despite failure
          }
        }

        // Small delay to prevent rate limits
        if (jobs.length === BATCH_SIZE) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

    } else {
      throw new Error('Neon DB not configured. Cannot process jobs.');
    }

    console.log('[Cron:TranslateJobs] Completed successfully.');

    const finalStats = {
      type: 'complete',
      success: true,
      message: 'RSS 草稿翻译任务完成',
      translationServiceType,
      stats: {
        totalJobs: totalJobsScanned,
        translatedJobs: translatedJobsCount,
        failedJobs: failedJobsCount,
        duration: `${Date.now() - startTime}ms`
      },
      timestamp: new Date().toISOString()
    }

    res.write(`event: complete\ndata: ${JSON.stringify(finalStats)}\n\n`)
    res.end()

  } catch (error) {
    console.error(`❌ 定时任务失败（步骤: ${currentStep}）:`, error)

    // 发送错误信息
    const errorResponse = {
      type: 'error',
      success: false,
      error: error.message || 'Unknown error',
      message: '定时任务执行失败',
      step: currentStep,
      details: error.stack,
      timestamp: new Date().toISOString()
    }

    res.write(`event: error\ndata: ${JSON.stringify(errorResponse)}\n\n`)
    res.end()
  }
}
