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

const require = createRequire(import.meta.url)

const realServicePath = path.join(process.cwd(), 'lib/services/translation-service.cjs')
const mockServicePath = path.join(process.cwd(), 'lib/services/translation-service-mock.cjs')

// 导入翻译服务（使用 CommonJS，通过 createRequire 兼容 ESM）
// 优先使用真实翻译服务，失败则使用Mock服务
let translateJobs = null
let translationServiceType = 'none'

try {
  const translationService = require(realServicePath)
  translateJobs = translationService.translateJobs
  translationServiceType = 'real'
  console.log('✅ 真实翻译服务加载成功')
} catch (error) {
  console.warn('⚠️ 真实翻译服务加载失败，尝试使用Mock服务:', error.message)
  
  try {
    const mockService = require(mockServicePath)
    translateJobs = mockService.translateJobs
    translationServiceType = 'mock'
    console.log('✅ Mock翻译服务加载成功（用于测试）')
  } catch (mockError) {
    console.error('❌ Mock翻译服务也加载失败:', mockError.message)
  }
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
      message: translateJobs
        ? translationServiceType === 'mock'
          ? '使用 Mock 翻译服务（测试用途）'
          : '使用真实翻译服务'
        : '翻译服务未加载',
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

  try {
    console.log('🔄 开始定时任务: 同步和翻译岗位数据')
    console.log(`触发方式: ${isVercelCron ? 'Vercel Cron' : '手动触发'}`)
    const startTime = Date.now()

    // 1. 获取处理后的岗位数据
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    console.log(`从 ${baseUrl} 获取岗位数据...`)
    
    const jobsResponse = await fetch(`${baseUrl}/api/data/processed-jobs?limit=1000`)
    
    if (!jobsResponse.ok) {
      throw new Error(`获取岗位数据失败: ${jobsResponse.status}`)
    }

    const jobsData = await jobsResponse.json()
    // 修复：API返回的数据格式是 { jobs: [...], total, page, pageSize, totalPages }
    const jobs = jobsData.jobs || []

    console.log(`获取到 ${jobs.length} 个岗位`)

    if (jobs.length === 0) {
      return res.json({ 
        success: true, 
        message: '没有需要处理的岗位数据',
        stats: {
          totalJobs: 0,
          translatedJobs: 0,
          skippedJobs: 0,
          failedJobs: 0,
          duration: `${Date.now() - startTime}ms`
        },
        timestamp: new Date().toISOString()
      })
    }

    // 2. 筛选出未翻译的岗位
    const untranslatedJobs = jobs.filter(job => !job.isTranslated)
    const alreadyTranslated = jobs.length - untranslatedJobs.length
    
    console.log(`📊 翻译状态统计:`)
    console.log(`  - 总数: ${jobs.length}`)
    console.log(`  - 已翻译: ${alreadyTranslated}`)
    console.log(`  - 待翻译: ${untranslatedJobs.length}`)

    if (untranslatedJobs.length === 0) {
      return res.json({
        success: true,
        message: '所有岗位已翻译',
        stats: {
          totalJobs: jobs.length,
          translatedJobs: 0,
          skippedJobs: alreadyTranslated,
          failedJobs: 0,
          duration: `${Date.now() - startTime}ms`
        },
        timestamp: new Date().toISOString()
      })
    }

    // 3. 批量翻译
    console.log(`🌍 开始翻译 ${untranslatedJobs.length} 个岗位...`)
    const translationStartTime = Date.now()
    
    let translatedJobs = []
    try {
      translatedJobs = await translateJobs(untranslatedJobs)
    } catch (translationError) {
      console.error('❌ 翻译过程失败:', translationError)
      // 翻译失败但不中断整个流程
      return res.status(500).json({
        success: false,
        error: '翻译过程失败',
        message: translationError.message,
        details: translationError.stack,
        stats: {
          totalJobs: jobs.length,
          translatedJobs: 0,
          skippedJobs: alreadyTranslated,
          failedJobs: untranslatedJobs.length,
          duration: `${Date.now() - startTime}ms`
        },
        timestamp: new Date().toISOString()
      })
    }
    
    const translationDuration = Date.now() - translationStartTime
    const successCount = translatedJobs.filter(j => j.isTranslated).length
    const failedCount = translatedJobs.length - successCount
    
    console.log(`✅ 翻译完成: ${successCount} 成功, ${failedCount} 失败, 耗时 ${translationDuration}ms`)

    // 4. 合并并保存
    const allJobs = jobs.map(job => {
      if (job.isTranslated) {
        // 已翻译的保持不变
        return job
      }
      // 找到对应的翻译结果
      const translated = translatedJobs.find(t => t.id === job.id)
      return translated || job
    })

    // 5. 保存回数据库（分批保存，避免请求过大）
    console.log('💾 保存翻译后的数据...')
    const saveStartTime = Date.now()
    
    const CHUNK_SIZE = 200
    for (let i = 0; i < allJobs.length; i += CHUNK_SIZE) {
      const chunk = allJobs.slice(i, i + CHUNK_SIZE)
      const mode = i === 0 ? 'replace' : 'append'
      
      const saveResponse = await fetch(`${baseUrl}/api/data/processed-jobs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          jobs: chunk, 
          mode 
        })
      })

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        throw new Error(`保存数据失败 (chunk ${i}): ${saveResponse.status} - ${errorText}`)
      }
      
      console.log(`  保存进度: ${Math.min(i + CHUNK_SIZE, allJobs.length)}/${allJobs.length}`)
    }

    const saveDuration = Date.now() - saveStartTime
    console.log(`✅ 数据保存完成, 耗时 ${saveDuration}ms`)

    const totalDuration = Date.now() - startTime

    // 返回成功结果
    return res.json({
      success: true,
      message: '定时任务完成',
      translationServiceType, // 告知前端使用的翻译服务类型
      stats: {
        totalJobs: jobs.length,
        translatedJobs: successCount,
        skippedJobs: alreadyTranslated,
        failedJobs: failedCount,
        duration: `${totalDuration}ms`,
        translationDuration: `${translationDuration}ms`,
        saveDuration: `${saveDuration}ms`
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 定时任务失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
      message: '定时任务执行失败',
      timestamp: new Date().toISOString()
    })
  }
}

