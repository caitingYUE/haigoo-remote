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

let translateJobs = null
try {
  const translationService = require('../services/translation-service')
  translateJobs = translationService.translateJobs
} catch (error) {
  console.error('无法加载翻译服务:', error.message)
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // 验证授权（支持Vercel Cron和手动触发）
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  
  // Vercel Cron自动调用或有效的授权令牌
  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized',
      message: '需要有效的授权令牌'
    })
  }

  // 检查翻译服务是否可用
  if (!translateJobs) {
    return res.status(500).json({
      success: false,
      error: '翻译服务不可用',
      message: '无法加载翻译服务，请检查配置'
    })
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
    const jobs = jobsData.data || []

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
    
    const translatedJobs = await translateJobs(untranslatedJobs)
    
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

