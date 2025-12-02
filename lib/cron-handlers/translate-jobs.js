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
  getAllJobs,
  saveAllJobs,
  NEON_CONFIGURED
} from '../api-handlers/processed-jobs.js'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 尝试多个可能的路径（真实服务优先，失败再回退到 Mock）
const possibleRealPaths = [
  path.join(process.cwd(), 'lib/services/translation-service.cjs'),
  path.join(__dirname, '../services/translation-service.cjs'),
  path.resolve(process.cwd(), 'lib/services/translation-service.cjs'),
]
const possibleMockPaths = [
  path.join(process.cwd(), 'lib/services/translation-service-mock.cjs'),
  path.join(__dirname, '../services/translation-service-mock.cjs'),
  path.resolve(process.cwd(), 'lib/services/translation-service-mock.cjs'),
]

let mockServiceModule = null
let realServiceModule = null

const ensureMockService = () => {
  if (!mockServiceModule) {
    for (const mockPath of possibleMockPaths) {
      try {
        mockServiceModule = require(mockPath)
        if (mockServiceModule && typeof mockServiceModule.translateJobs === 'function') {
          console.log('✅ ensureMockService 加载成功:', mockPath)
          break
        }
      } catch (error) {
        console.warn(`⚠️ ensureMockService 尝试 [${mockPath}] 失败:`, error.message)
      }
    }
  }
  return mockServiceModule
}

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
      }
    }
  }
  return realServiceModule
}

// 导入翻译服务（使用 CommonJS，通过 createRequire 兼容 ESM）
// 策略：
// 1) 若设置 FORCE_MOCK_TRANSLATION 为真 → 强制使用 Mock
// 2) 否则优先加载真实服务 translation-service.cjs，失败再回退到 Mock
let translateJobs = null
let translationServiceType = 'none'
let loadedFrom = null
const forceMock = /^(1|true|yes|on|mock)$/i.test(String(process.env.FORCE_MOCK_TRANSLATION || ''))

console.log('🔍 当前工作目录:', process.cwd())
console.log('🔍 当前文件目录:', __dirname)

if (!forceMock) {
  // 先尝试真实服务
  const realSvc = ensureRealService()
  if (realSvc && typeof realSvc.translateJobs === 'function') {
    translateJobs = realSvc.translateJobs
    translationServiceType = 'real'
    loadedFrom = possibleRealPaths.find(p => {
      try { return require(p) === realSvc } catch { return false }
    }) || '(resolved-real)'
  }
}

// 若未加载到真实服务，回退到 Mock
if (!translateJobs) {
  const mockSvc = ensureMockService()
  if (mockSvc && typeof mockSvc.translateJobs === 'function') {
    translateJobs = mockSvc.translateJobs
    translationServiceType = 'mock'
    loadedFrom = possibleMockPaths.find(p => {
      try { return require(p) === mockSvc } catch { return false }
    }) || '(resolved-mock)'
  }
}

if (!translateJobs) {
  console.error('❌ 无法加载任何翻译服务（真实/Mock 均失败）')
  console.error('尝试的真实服务路径:', possibleRealPaths)
  console.error('尝试的 Mock 服务路径:', possibleMockPaths)
}

// 导出处理函数（ESM）
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 验证授权（支持Vercel Cron和手动触发）
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'

  // 诊断模式：GET 请求且非 Vercel Cron 且非强制运行参数时，返回当前翻译服务状态
  if (req.method === 'GET' && !isVercelCron && req.query.action !== 'run') {
    return res.status(200).json({
      success: !!translateJobs,
      translationServiceType,
      isMock: translationServiceType === 'mock',
      loadedFrom,
      forceMock,
      message: translateJobs
        ? translationServiceType === 'mock'
          ? '使用 Mock 翻译服务（内置150+词条）'
          : '使用真实翻译服务'
        : '翻译服务未加载',
      environment: {
        cwd: process.cwd(),
        dirname: __dirname,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      },
      possiblePaths: translationServiceType === 'mock' ? possibleMockPaths : possibleRealPaths,
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
  if (translationServiceType === 'mock') {
    console.log('⚠️ 注意：当前使用Mock翻译服务，仅用于测试目的')
  }

  let currentStep = 'init'

  try {
    console.log('🔄 开始定时任务: 同步和翻译岗位数据')
    console.log(`触发方式: ${isVercelCron ? 'Vercel Cron' : '手动触发'}`)
    const startTime = Date.now()

    // 1. 分页获取处理后的岗位数据
    currentStep = 'fetch-processed-jobs'

    const pageSize = Number(process.env.CRON_PAGE_SIZE || '200')
    let totalJobs = 0
    let translatedJobsCount = 0
    let skippedJobsCount = 0
    let failedJobsCount = 0

    // 优先使用 Neon 数据库
    if (NEON_CONFIGURED) {
      console.log('✅ 检测到 Neon 数据库配置，使用数据库直接访问模式')

      // 限制每次运行处理的最大数量，防止超时
      const MAX_JOBS_PER_RUN = 50
      const MAX_EXECUTION_TIME = 55 * 1000 // 55秒 (Vercel Hobby 限制 60s)

      // 获取总数
      const total = await countJobsFromNeon({})
      // 每次只取一页，或者只取未翻译的？
      // 为了效率，我们直接查询未翻译的可能更好，但目前 readJobsFromNeon 不支持复杂过滤
      // 我们还是按页遍历，但加上全局限制

      const totalPages = Math.ceil(total / pageSize) || 1
      console.log(`🗂️ 数据库中共有 ${total} 个岗位，预计分 ${totalPages} 页处理`)
      console.log(`⚠️ 限制: 每次最多处理 ${MAX_JOBS_PER_RUN} 个岗位，最长运行 ${MAX_EXECUTION_TIME / 1000} 秒`)

      // 逐页处理
      for (let page = 1; page <= totalPages; page++) {
        // 检查是否超时
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
          console.log('⚠️ 达到最大运行时间，停止处理')
          break
        }
        // 检查是否达到数量限制
        if (translatedJobsCount >= MAX_JOBS_PER_RUN) {
          console.log('⚠️ 达到单次最大处理数量，停止处理')
          break
        }

        console.log(`Processing page ${page}/${totalPages}...`)

        // 读取一页数据
        const jobs = await readJobsFromNeon({}, { page, limit: pageSize })
        if (!jobs || jobs.length === 0) continue

        totalJobs += jobs.length

        // 2. 筛选未翻译
        const untranslated = jobs.filter(job => !job.isTranslated)
        const alreadyTranslated = jobs.length - untranslated.length
        skippedJobsCount += alreadyTranslated
        console.log(`📊 第 ${page} 页：已翻译 ${alreadyTranslated}，待翻译 ${untranslated.length}`)

        if (untranslated.length === 0) continue

        // 计算本页剩余可处理配额
        const remainingQuota = MAX_JOBS_PER_RUN - translatedJobsCount
        const toTranslate = untranslated.slice(0, remainingQuota)

        if (toTranslate.length < untranslated.length) {
          console.log(`⚠️ 本页待翻译 ${untranslated.length} 个，但配额仅剩 ${remainingQuota} 个，将只处理部分`)
        }

        // 3. 翻译
        currentStep = `translate-jobs(page:${page})`
        let translated = []
        try {
          translated = await translateJobs(toTranslate)
        } catch (translationError) {
          console.error(`❌ 第 ${page} 页翻译失败:`, translationError)
          failedJobsCount += toTranslate.length
          continue
        }

        const successCount = translated.filter(j => j.isTranslated).length
        const failCount = translated.length - successCount
        translatedJobsCount += successCount
        failedJobsCount += failCount
        console.log(`✅ 第 ${page} 页翻译完成: 成功 ${successCount}, 失败 ${failCount}`)

        // 4. 保存翻译结果 (使用 upsert 模式)
        currentStep = `save-translated-jobs(page:${page})`
        if (successCount > 0) {
          const toSave = translated.filter(j => j.isTranslated)
          try {
            // 使用 upsert 模式，只更新已翻译的记录
            await writeJobsToNeon(toSave, 'upsert')
            console.log(`✅ 保存成功 (page ${page}, count: ${toSave.length}, mode: upsert)`)
          } catch (saveError) {
            console.error(`❌ 保存失败 (page ${page}):`, saveError)
            // 不抛出错误，继续处理下一页
          }
        }

        // 如果本页因为配额限制没处理完，说明已经达到总限制了，直接退出循环
        if (toTranslate.length < untranslated.length) {
          break
        }
      }

    } else {
      // 降级模式：使用 getAllJobs (适用于 Redis/KV 等)
      console.warn('⚠️ 未检测到 Neon 配置，使用 getAllJobs 降级模式 (无分页)')

      const allJobs = await getAllJobs()
      totalJobs = allJobs.length
      console.log(`🗂️ 获取到 ${totalJobs} 个岗位`)

      const untranslated = allJobs.filter(job => !job.isTranslated)
      skippedJobsCount = allJobs.length - untranslated.length
      console.log(`📊 待翻译: ${untranslated.length}, 已跳过: ${skippedJobsCount}`)

      if (untranslated.length > 0) {
        currentStep = 'translate-jobs-all'
        let translated = []
        try {
          // 如果数量太多，可能需要分批，这里简单处理
          const CHUNK_SIZE = 50
          for (let i = 0; i < untranslated.length; i += CHUNK_SIZE) {
            const chunk = untranslated.slice(i, i + CHUNK_SIZE)
            const chunkTranslated = await translateJobs(chunk)
            translated.push(...chunkTranslated)
            console.log(`✅ 翻译进度: ${Math.min(i + CHUNK_SIZE, untranslated.length)}/${untranslated.length}`)
          }
        } catch (e) {
          console.error('❌ 翻译失败:', e)
          failedJobsCount += untranslated.length
        }

        const successCount = translated.filter(j => j.isTranslated).length
        translatedJobsCount = successCount
        failedJobsCount = untranslated.length - successCount

        if (successCount > 0) {
          currentStep = 'save-jobs-all'
          // 合并结果
          const jobMap = new Map(allJobs.map(j => [j.id, j]))
          translated.forEach(j => {
            if (j.isTranslated) jobMap.set(j.id, j)
          })
          const finalJobs = Array.from(jobMap.values())

          await saveAllJobs(finalJobs)
          console.log(`✅ 全量保存成功: ${finalJobs.length} 个岗位`)
        }
      }
    }

    // 返回成功结果（聚合统计）
    return res.json({
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
    })

  } catch (error) {
    console.error(`❌ 定时任务失败（步骤: ${currentStep}）:`, error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      message: '定时任务执行失败',
      step: currentStep,
      translationServiceType,
      details: error.stack,
      timestamp: new Date().toISOString()
    })
  }
}

