/**
 * Vercel Cron Job: 定时同步和翻译岗位数据
 * 配置在 vercel.json 中
 * 
 * 执行流程：
 * 1. 获取所有处理后的岗位数据
 * 2. 筛选未翻译的岗位
 * 3. 批量翻译
 * 4. 保存回数据库
 * 
 * 调用方式：
 * - 定时任务：每天凌晨2:00自动执行
 * - 手动触发：POST /api/cron/sync-jobs（需要授权）
 */

import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import {
  readJobsFromNeon,
  countJobsFromNeon,
  writeJobsToNeon,
  NEON_CONFIGURED
} from '../api-handlers/processed-jobs.js'
import { systemSettingsService } from '../services/system-settings-service.js'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 尝试多个可能的路径（真实服务优先）
const possibleRealPaths = [
  path.join(process.cwd(), 'lib/services/translation-service.cjs'),
  path.join(__dirname, '../services/translation-service.cjs'),
  path.resolve(process.cwd(), 'lib/services/translation-service.cjs'),
]

let realServiceModule = null

const ensureRealService = () => {
  if (!realServiceModule) {
    for (const realPath of possibleRealPaths) {
      try {
        realServiceModule = require(realPath)
        if (realServiceModule && typeof realServiceModule.translateJobs === 'function') {
          console.log('✅ ensureRealService 加载成功:', realPath)
          break
        } else {
          console.warn(`⚠️ 真实服务模块缺少 translateJobs 方法:`, Object.keys(realServiceModule || {}))
        }
      } catch (error) {
        console.warn(`⚠️ ensureRealService 尝试 [${realPath}] 失败:`, error.message)
        // 🔧 FIX: 如果是因为语法错误等原因加载失败，应该抛出异常而不是被吞掉
        if (error instanceof SyntaxError) {
          console.error('❌ 真实服务加载失败（语法错误）:', error);
          throw error;
        }
      }
    }
  }
  return realServiceModule
}

// 导入翻译服务（使用 CommonJS，通过 createRequire 兼容 ESM）
let translateJobs = null
let configureTranslation = null
let translationServiceType = 'none'
let loadedFrom = null

console.log('🔍 当前工作目录:', process.cwd())
console.log('🔍 当前文件目录:', __dirname)

// 尝试真实服务
const realSvc = ensureRealService()
if (realSvc && typeof realSvc.translateJobs === 'function') {
  translateJobs = realSvc.translateJobs
  configureTranslation = realSvc.configure
  translationServiceType = 'real'
  loadedFrom = possibleRealPaths.find(p => {
    try { return require(p) === realSvc } catch { return false }
  }) || '(resolved-real)'
}

if (!translateJobs) {
  console.error('❌ 无法加载真实翻译服务！')
  console.error('尝试的真实服务路径:', possibleRealPaths)
  // 🔧 FIX: 严禁使用 Mock 数据，直接报错
  throw new Error('Critical: Real translation service failed to load. Mock fallback is disabled.')
}

// 导出处理函数（ESM）
export default async function handler(req, res) {
  console.log(new Date().toISOString(), "UA:", req.headers["user-agent"], "IP:", req.headers["x-forwarded-for"], "Referer:", req.headers.referer);

  console.log('[Cron:TranslateJobs] Starting...');

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
  console.log(`[Cron:TranslateJobs] Authorization Header: ${authHeader}`);
  console.log(`[Cron:TranslateJobs] Cron Secret: ${cronSecret}`);
  console.log(`[Cron:TranslateJobs] Is Vercel Cron: ${isVercelCron}`);
  console.log(`[Cron:TranslateJobs] Is Production: ${isProduction}`);

  // 诊断模式：GET 请求且非 Vercel Cron 且非强制运行参数时，返回当前翻译服务状态
  if (req.method === 'GET' && !isVercelCron && req.query.action !== 'run') {
    console.log('[Cron:TranslateJobs] Diagnostic mode: GET request.');
    return res.status(200).json({
      success: !!translateJobs,
      translationServiceType,
      loadedFrom,
      message: translateJobs
        ? '使用真实翻译服务'
        : '翻译服务未加载',
      environment: {
        cwd: process.cwd(),
        dirname: __dirname,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      },
      possiblePaths: possibleRealPaths,
      timestamp: new Date().toISOString()
    })
  }

  // 验证逻辑：
  // 1. Vercel Cron自动调用 - 总是允许
  // 2. 生产环境 + 配置了CRON_SECRET - 需要验证令牌
  // 3. 非生产环境或未配置CRON_SECRET - 允许（开发/预发环境）
  if (!isVercelCron && isProduction && cronSecret) {
    // 生产环境：严格验证
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '需要有效的授权令牌'
      })
    }
  }
  // 非生产环境：允许直接调用（方便测试和开发）
  console.log(`🔓 授权检查: ${isVercelCron ? 'Vercel Cron' : isProduction ? '生产环境手动触发' : '预发/开发环境手动触发'}`)

  // 检查翻译服务是否可用
  if (!translateJobs) {
    return res.status(500).json({
      success: false,
      error: '翻译服务不可用',
      message: '无法加载任何翻译服务（包括Mock服务）'
    })
  }

  // 记录使用的翻译服务类型
  console.log(`🔧 使用翻译服务类型: ${translationServiceType}`)

  let currentStep = 'init'

  try {
    console.log('🔄 开始定时任务: 同步和翻译岗位数据')
    console.log(`触发方式: ${isVercelCron ? 'Vercel Cron' : '手动触发'}`)
    const startTime = Date.now()

    // 立即发送开始响应，确保在25秒内开始流式传输
    res.write(`event: start\ndata: ${JSON.stringify({
      type: 'start',
      message: '定时任务开始执行',
      translationServiceType,
      timestamp: new Date().toISOString()
    })}\n\n`)

    // DEBUG: Probe existing translations (Diagnostic)
    console.log('🔍 Probing existing translations...');
    try {
        const probeJobs = await readJobsFromNeon({ 
            isAdmin: true, 
            isTranslated: true, 
            limit: 5 
        });
        
        const probeData = probeJobs.map(j => ({
            id: j.id,
            title: j.title,
            transTitle: j.translations?.title,
            hasChineseTitle: /[\u4e00-\u9fa5]/.test(j.translations?.title || ''),
            isTranslated: j.isTranslated
        }));

        res.write(`event: debug_probe\ndata: ${JSON.stringify({
            type: 'debug_probe',
            message: 'Diagnostic Probe of "Translated" Jobs',
            data: probeData,
            timestamp: new Date().toISOString()
        })}\n\n`);
    } catch (e) {
        console.error('Probe failed:', e);
    }

    // 1. 获取并应用系统设置
    const aiSetting = await systemSettingsService.getSetting('ai_translation_enabled');
    // Check if AI keys are present in env
    const hasAiKeys = !!(process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY);
    
    // Default to true if keys are present, otherwise follow setting or false
    const aiEnabled = hasAiKeys ? (aiSetting?.value ?? true) : false;
    
    console.log(`🔧 系统设置: AI 翻译 ${aiEnabled ? '已启用' : '已禁用'} (Keys present: ${hasAiKeys})`);
    
    if (configureTranslation) {
        configureTranslation({ aiEnabled });
    }

    // 2. 分页获取处理后的岗位数据
    currentStep = 'fetch-processed-jobs'

    // ⬇️ 优化：将每页数量从 200 降低到 50，以避免 Vercel 5分钟超时限制
    // 翻译服务每批次(2个)需等待2秒，200个需等待200秒+API耗时，极易超时
    const pageSize = Number(process.env.CRON_PAGE_SIZE || '50')
    const MAX_EXECUTION_TIME = 250 * 1000; // 250秒 (预留50秒缓冲)

    let totalJobs = 0
    let translatedJobsCount = 0
    let skippedJobsCount = 0
    let failedJobsCount = 0

    // 优先使用 Neon 数据库
    if (NEON_CONFIGURED) {
      console.log('✅ 检测到 Neon 数据库配置，使用数据库直接访问模式')

      // 获取未翻译的岗位总数
      // 关键修复：添加 isAdmin: true 以绕过审核状态过滤，并只查询 isTranslated: false 的岗位
      const queryParams = { isAdmin: true, isTranslated: false };
      
      const total = await countJobsFromNeon(queryParams)
      const totalPages = Math.ceil(total / pageSize) || 1
      console.log(`🗂️ 数据库中共有 ${total} 个待翻译岗位，预计分 ${totalPages} 页处理`)

      // 发送总数信息
      res.write(`event: total\ndata: ${JSON.stringify({
        type: 'total',
        totalJobs: total,
        totalPages: totalPages,
        timestamp: new Date().toISOString()
      })}\n\n`)

      // 逐页处理
      // 由于每次处理完会更新 isTranslated=true，未翻译的队列会动态变化
      // 所以我们始终获取第1页即可拿到最新的未翻译数据
      // 但为了防止死循环（一直处理同一批失败的数据），我们需要有退出机制
      // 这里简单起见，我们仍然循环 totalPages 次，但每次都取 page 1
      
      for (let i = 0; i < totalPages; i++) {
        const currentPage = 1; // 始终处理第一页
        const currentBatchNum = i + 1;

        // ⏱️ 超时检查
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.warn(`⚠️ 任务执行即将超时 (${Math.round((Date.now() - startTime)/1000)}s)，停止处理后续页面`);
          res.write(`event: timeout_stop\ndata: ${JSON.stringify({
            type: 'timeout_stop',
            message: '任务即将超时，自动停止后续处理。请再次运行任务以继续。',
            processedBatches: currentBatchNum - 1,
            timestamp: new Date().toISOString()
          })}\n\n`);
          break;
        }

        console.log(`Processing batch ${currentBatchNum}/${totalPages} (Page ${currentPage})...`)

        // 发送页面开始处理信息
        res.write(`event: page_start\ndata: ${JSON.stringify({
          type: 'page_start',
          page: currentBatchNum,
          totalPages: totalPages,
          timestamp: new Date().toISOString()
        })}\n\n`)

        // 读取一页未翻译数据
        const jobs = await readJobsFromNeon(queryParams, { page: currentPage, limit: pageSize })
        
        if (!jobs || jobs.length === 0) {
          console.log(`⚠️ 第 ${currentBatchNum} 批：未获取到数据，可能已全部处理完成`)
          res.write(`event: page_skip\ndata: ${JSON.stringify({
            type: 'page_skip',
            page: currentBatchNum,
            reason: '无更多待翻译数据',
            timestamp: new Date().toISOString()
          })}\n\n`)
          break; // 没有数据了，提前结束
        }

        totalJobs += jobs.length

        // 2. 筛选
        const untranslated = jobs;
        
        console.log(`📊 第 ${currentBatchNum} 批：待翻译 ${untranslated.length}`)

        // 发送页面统计信息
        res.write(`event: page_stats\ndata: ${JSON.stringify({
          type: 'page_stats',
          page: currentBatchNum,
          totalJobs: jobs.length,
          untranslated: untranslated.length,
          alreadyTranslated: 0,
          timestamp: new Date().toISOString()
        })}\n\n`)

        // 如果检测出假翻译，我们需要清除它们的 isTranslated 标记
        untranslated.forEach(job => {
          if (job.isTranslated) {
            job.isTranslated = false;
            job.translations = null; // 清除旧翻译
          }
        });

        if (untranslated.length === 0) {
          res.write(`event: page_skip\ndata: ${JSON.stringify({
            type: 'page_skip',
            page: currentBatchNum,
            reason: '无待翻译数据',
            timestamp: new Date().toISOString()
          })}\n\n`)
          continue
        }

        // 3. 翻译
        currentStep = `translate-jobs(batch:${currentBatchNum})`
        let translated = []
        try {
          translated = await translateJobs(untranslated)
        } catch (translationError) {
          console.error(`❌ 第 ${currentBatchNum} 批翻译失败:`, translationError)
          failedJobsCount += untranslated.length
          
          // 发送翻译失败信息
          res.write(`event: page_error\ndata: ${JSON.stringify({
            type: 'page_error',
            page: currentBatchNum,
            error: translationError.message,
            failedCount: untranslated.length,
            timestamp: new Date().toISOString()
          })}\n\n`)
          continue
        }

        const successCount = translated.filter(j => j.isTranslated).length
        const failCount = translated.length - successCount
        translatedJobsCount += successCount
        failedJobsCount += failCount
        console.log(`✅ 第 ${currentBatchNum} 批翻译完成: 成功 ${successCount}, 失败 ${failCount}`)

        // 发送翻译结果信息
        res.write(`event: page_translated\ndata: ${JSON.stringify({
          type: 'page_translated',
          page: currentBatchNum,
          successCount: successCount,
          failCount: failCount,
          timestamp: new Date().toISOString()
        })}\n\n`)

        // 4. 保存翻译结果 (使用 upsert 模式)
        currentStep = `save-translated-jobs(batch:${currentBatchNum})`
        // 关键修复：保存所有尝试过翻译的岗位，包括翻译失败的（以更新其状态为未翻译，防止"假翻译"循环）
        const toSave = translated.filter(j => j && j.id); 
        
        if (toSave.length > 0) {
          try {
            // Aggregate token usage
            let batchUsage = { input: 0, output: 0, total: 0 };
            toSave.forEach(job => {
                if (job.tokenUsage) {
                    batchUsage.input += job.tokenUsage.input || 0;
                    batchUsage.output += job.tokenUsage.output || 0;
                    batchUsage.total += job.tokenUsage.total || 0;
                    delete job.tokenUsage; // Remove temporary field before saving
                }
            });
            
            if (batchUsage.total > 0) {
                await systemSettingsService.incrementTokenUsage(batchUsage, 'translation');
                console.log(`📊 本批次消耗 Token: ${batchUsage.total} (In: ${batchUsage.input}, Out: ${batchUsage.output})`);
            }

            // 使用 upsert 模式，只更新已翻译的记录
            await writeJobsToNeon(toSave, 'upsert', true) // true to skip filter
            console.log(`✅ 保存处理结果 (batch ${currentBatchNum}, count: ${toSave.length}, mode: upsert)`)
            
            // 发送保存成功信息
            res.write(`event: page_saved\ndata: ${JSON.stringify({
              type: 'page_saved',
              page: currentBatchNum,
              savedCount: toSave.length,
              timestamp: new Date().toISOString()
            })}\n\n`)
          } catch (saveError) {
            console.error(`❌ 保存失败 (batch ${currentBatchNum}):`, saveError)
            // 发送保存失败信息
            res.write(`event: page_save_error\ndata: ${JSON.stringify({
              type: 'page_save_error',
              page: currentBatchNum,
              error: saveError.message,
              timestamp: new Date().toISOString()
            })}\n\n`)
            // 不抛出错误，继续处理下一页
          }
        } else {
            console.warn(`⚠️ 第 ${currentBatchNum} 批: 无数据需要保存`);
        }

        // 发送页面完成信息
        res.write(`event: page_complete\ndata: ${JSON.stringify({
          type: 'page_complete',
          page: currentBatchNum,
          timestamp: new Date().toISOString()
        })}\n\n`)

      }

    }

    console.log('[Cron:TranslateJobs] Completed successfully.');

    // 返回最终结果（聚合统计）
    const finalStats = {
      type: 'complete',
      success: true,
      message: '定时任务完成',
      translationServiceType,
      stats: {
        totalJobs,
        translatedJobs: translatedJobsCount,
        skippedJobs: skippedJobsCount,
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
      translationServiceType,
      details: error.stack,
      timestamp: new Date().toISOString()
    }
    
    res.write(`event: error\ndata: ${JSON.stringify(errorResponse)}\n\n`)
    res.end()
  }
}

