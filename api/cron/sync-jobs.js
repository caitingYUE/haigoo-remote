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

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 尝试多个可能的路径（真实服务优先，失败再回退到 Mock）
const possibleRealPaths = [
  path.join(process.cwd(), 'lib/services/translation-service.cjs'),
  path.join(__dirname, '../../lib/services/translation-service.cjs'),
  path.resolve(process.cwd(), 'lib/services/translation-service.cjs'),
]
const possibleMockPaths = [
  path.join(process.cwd(), 'lib/services/translation-service-mock.cjs'),
  path.join(__dirname, '../../lib/services/translation-service-mock.cjs'),
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 诊断模式：GET 请求返回当前翻译服务状态
  if (req.method === 'GET') {
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

  // 验证授权（支持Vercel Cron和手动触发）
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production'
  
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
    
    // 构建baseUrl：优先使用SITE_URL，其次VERCEL_URL，最后从请求头推断
    let baseUrl = process.env.SITE_URL
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`
    }
    if (!baseUrl && req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || 'https'
      baseUrl = `${protocol}://${req.headers.host}`
    }
    if (!baseUrl) {
      baseUrl = 'http://localhost:3000'
    }
    
    console.log(`📍 环境变量检查:`)
    console.log(`  - SITE_URL: ${process.env.SITE_URL || '(未设置)'}`)
    console.log(`  - VERCEL_URL: ${process.env.VERCEL_URL || '(未设置)'}`)
    console.log(`  - 请求Host: ${req.headers.host || '(无)'}`)
    console.log(`  - 最终baseUrl: ${baseUrl}`)

    const pageSize = Number(process.env.CRON_PAGE_SIZE || '200')
    let totalJobs = 0
    let translatedJobsCount = 0
    let skippedJobsCount = 0
    let failedJobsCount = 0

    // 先拉取第一页，获得总页数
    let firstPageResp
    try {
      firstPageResp = await fetch(`${baseUrl}/api/data/processed-jobs?limit=${pageSize}&page=1`, {
        headers: { 'User-Agent': 'Vercel-Cron-Job/1.0' }
      })
    } catch (fetchError) {
      console.error('❌ fetch第一页失败:', fetchError.message)
      throw new Error(`无法连接到后端API (${baseUrl}): ${fetchError.message}`)
    }
    if (!firstPageResp.ok) {
      const errorText = await firstPageResp.text().catch(() => '无法读取错误响应')
      console.error(`❌ API返回错误: ${firstPageResp.status}`, errorText)
      throw new Error(`获取岗位数据失败: ${firstPageResp.status} - ${errorText.substring(0, 200)}`)
    }
    const firstPageData = await firstPageResp.json().catch(() => ({ jobs: [], totalPages: 1, total: 0 }))
    const totalPages = Number(firstPageData.totalPages || 1)
    console.log(`🗂️ 预计总页数: ${totalPages}，每页 ${pageSize}`)

    // 将第一页的 jobs 放入迭代处理（其余页逐页拉取）
    const processPageJobs = async (jobs, pageIndex) => {
      console.log(`✅ 获取到第 ${pageIndex}/${totalPages} 页，${jobs.length} 个岗位`)
      totalJobs += jobs.length
      // 2. 筛选未翻译
      const untranslated = jobs.filter(job => !job.isTranslated)
      const alreadyTranslated = jobs.length - untranslated.length
      skippedJobsCount += alreadyTranslated
      console.log(`📊 第 ${pageIndex} 页：已翻译 ${alreadyTranslated}，待翻译 ${untranslated.length}`)
      if (untranslated.length === 0) return

      // 3. 翻译（使用服务内部限速）
      currentStep = `translate-jobs(page:${pageIndex})`
      let translated = []
      try {
        translated = await translateJobs(untranslated)
      } catch (translationError) {
        console.error(`❌ 第 ${pageIndex} 页翻译失败:`, translationError)
        failedJobsCount += untranslated.length
        return
      }
      const successCount = translated.filter(j => j.isTranslated).length
      const failCount = translated.length - successCount
      translatedJobsCount += successCount
      failedJobsCount += failCount
      console.log(`✅ 第 ${pageIndex} 页翻译完成: 成功 ${successCount}, 失败 ${failCount}`)

      // 4. 合并原数据与翻译结果
      const merged = jobs.map(job => job.isTranslated ? job : (translated.find(t => t.id === job.id) || job))

      // 5. 分批保存（从较小分片开始，避免 413）
      currentStep = `save-translated-jobs(page:${pageIndex})`
      let CHUNK_SIZE = Number(process.env.CRON_SAVE_CHUNK || '100')
      for (let i = 0; i < merged.length;) {
        const chunk = merged.slice(i, i + CHUNK_SIZE)
        const mode = (pageIndex === 1 && i === 0) ? 'replace' : 'append'
        let saveResponse
        try {
          saveResponse = await fetch(`${baseUrl}/api/data/processed-jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobs: chunk, mode })
          })
        } catch (fetchError) {
          console.error(`❌ 保存请求失败 (page ${pageIndex}, chunk ${i}):`, fetchError.message)
          throw new Error(`保存数据失败 (page ${pageIndex}, chunk ${i}): 网络错误 - ${fetchError.message}`)
        }
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text().catch(() => '无法读取错误响应')
          console.error(`❌ 保存API返回错误 (page ${pageIndex}, chunk ${i}, size=${CHUNK_SIZE}): ${saveResponse.status}`, errorText.substring(0, 500))
          if (saveResponse.status === 413 || /Payload Too Large|entity too large|body too large/i.test(errorText)) {
            const newSize = Math.max(25, Math.floor(CHUNK_SIZE / 2))
            if (newSize === CHUNK_SIZE) throw new Error(`保存数据失败 (page ${pageIndex}, chunk ${i}): ${saveResponse.status} - ${errorText.substring(0, 200)}`)
            console.warn(`📦 请求体过大，分片从 ${CHUNK_SIZE} 缩小到 ${newSize} 后重试...`)
            CHUNK_SIZE = newSize
            continue
          }
          throw new Error(`保存数据失败 (page ${pageIndex}, chunk ${i}, size=${CHUNK_SIZE}): ${saveResponse.status} - ${errorText.substring(0, 200)}`)
        }
        await saveResponse.json().catch(() => ({}))
        i += CHUNK_SIZE
      }
    }

    // 处理第一页
    await processPageJobs(firstPageData.jobs || [], 1)
    // 处理剩余页
    for (let page = 2; page <= totalPages; page++) {
      let pageResp
      try {
        pageResp = await fetch(`${baseUrl}/api/data/processed-jobs?limit=${pageSize}&page=${page}`, {
          headers: { 'User-Agent': 'Vercel-Cron-Job/1.0' }
        })
      } catch (error) {
        console.error(`❌ 拉取第 ${page} 页失败:`, error.message)
        continue
      }
      if (!pageResp.ok) {
        const txt = await pageResp.text().catch(() => '')
        console.error(`❌ 第 ${page} 页 API错误: ${pageResp.status}`, txt.substring(0, 200))
        continue
      }
      const pageData = await pageResp.json().catch(() => ({ jobs: [] }))
      await processPageJobs(pageData.jobs || [], page)
    }

    // ✅ 已改为分页翻译与分批保存，上述流程已完成
    // 旧的“一次性再翻译/再保存”逻辑移除，避免未定义变量与重复写入

    // 返回成功结果（聚合统计）
    return res.json({
      success: true,
      message: '定时任务完成（分页翻译+分批保存）',
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

