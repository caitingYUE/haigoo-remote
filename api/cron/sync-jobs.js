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

// 尝试多个可能的路径
const possibleMockPaths = [
  path.join(process.cwd(), 'lib/services/translation-service-mock.cjs'),
  path.join(__dirname, '../../lib/services/translation-service-mock.cjs'),
  path.resolve(process.cwd(), 'lib/services/translation-service-mock.cjs'),
]

let mockServiceModule = null

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

// 导入翻译服务（使用 CommonJS，通过 createRequire 兼容 ESM）
// 直接使用Mock翻译服务（稳定、快速、免费）
let translateJobs = null
let translationServiceType = 'none'
let loadedFrom = null

console.log('🔍 当前工作目录:', process.cwd())
console.log('🔍 当前文件目录:', __dirname)

for (const mockPath of possibleMockPaths) {
  try {
    console.log(`🔄 尝试加载: ${mockPath}`)
    const mockService = require(mockPath)
    
    if (mockService && typeof mockService.translateJobs === 'function') {
      translateJobs = mockService.translateJobs
      translationServiceType = 'mock'
      loadedFrom = mockPath
      mockServiceModule = mockService
      console.log('✅ Mock翻译服务加载成功')
      console.log('📍 加载路径:', mockPath)
      console.log('📝 使用内置翻译字典，包含150+常用职位术语')
      break
    } else {
      console.warn(`⚠️ 模块加载成功但缺少 translateJobs 方法:`, Object.keys(mockService || {}))
    }
  } catch (error) {
    console.warn(`⚠️ 路径加载失败 [${mockPath}]:`, error.message)
  }
}

if (!translateJobs) {
  console.error('❌ 所有路径都无法加载Mock翻译服务')
  console.error('尝试的路径:', possibleMockPaths)
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
      possiblePaths: possibleMockPaths,
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

    // 1. 获取处理后的岗位数据
    currentStep = 'fetch-processed-jobs'
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
    currentStep = 'translate-jobs'
    console.log(`🌍 开始翻译 ${untranslatedJobs.length} 个岗位...`)
    console.log(`📝 使用翻译服务类型: ${translationServiceType}`)
    console.log(`📝 translateJobs 函数存在: ${typeof translateJobs === 'function'}`)
    
    const translationStartTime = Date.now()
    
    let translatedJobs = []
    try {
      if (typeof translateJobs !== 'function') {
        throw new Error(`translateJobs 不是一个函数，当前类型: ${typeof translateJobs}`)
      }
      
      console.log(`🚀 调用 translateJobs，输入 ${untranslatedJobs.length} 个岗位`)
      translatedJobs = await translateJobs(untranslatedJobs)
      console.log(`✅ translateJobs 执行完成，返回 ${translatedJobs?.length || 0} 个结果`)
      
      if (!Array.isArray(translatedJobs)) {
        throw new Error(`translateJobs 返回值不是数组，类型: ${typeof translatedJobs}`)
      }
      
    } catch (translationError) {
      console.error('❌ 翻译过程失败:', translationError)
      console.error('错误详情:', translationError.stack)
      
      // 直接返回错误，不再尝试回退（因为已经在用Mock了）
      return res.status(500).json({
        success: false,
        error: '翻译过程失败',
        message: translationError.message || 'Unknown translation error',
        details: translationError.stack || 'No stack trace',
        context: {
          translationServiceType,
          translateJobsType: typeof translateJobs,
          untranslatedJobsCount: untranslatedJobs.length,
          loadedFrom
        },
        stats: {
          totalJobs: jobs.length,
          translatedJobs: 0,
          skippedJobs: alreadyTranslated,
          failedJobs: untranslatedJobs.length,
          duration: `${Date.now() - startTime}ms`
        },
        step: currentStep,
        timestamp: new Date().toISOString()
      })
    }
    
    const translationDuration = Date.now() - translationStartTime
    const successCount = translatedJobs.filter(j => j.isTranslated).length
    const failedCount = translatedJobs.length - successCount
    
    console.log(`✅ 翻译完成: ${successCount} 成功, ${failedCount} 失败, 耗时 ${translationDuration}ms`)

    // 4. 合并并保存
    currentStep = 'merge-and-save'
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

