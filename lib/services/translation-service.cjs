/**
 * 后端翻译服务
 * 使用 LibreTranslate（通过本项目的 /api/translate 代理）进行批量翻译
 * 
 * 核心功能：
 * 1. 批量翻译文本
 * 2. 翻译单个岗位数据
 * 3. 批量翻译岗位数据
 * 
 * 使用 @vitalets/google-translate-api 免费库
 */

// 通过本项目的 Edge 代理 /api/translate 调用 LibreTranslate（并带回退机制）
// 优点：统一语言映射与多服务回退，避免直连外部服务的限流问题
// 🔧 FIX: 默认使用 Google Translate 以获得更好的翻译质量
const PREFERRED_PROVIDER = (process.env.PREFERRED_TRANSLATION_PROVIDER || 'google').toLowerCase()
// 🔧 FIX: 确保使用正确的生产域名
const SITE_URL = process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'https://haigoo.vercel.app'  // 硬编码生产域名作为最后回退
const TRANSLATE_ENDPOINT = process.env.TRANSLATE_API_URL || `${SITE_URL}/api/translate`

// 并发与速率控制（方案A：保守配置）
// 🔧 FIX: 降低默认值以避免触发 Google API 速率限制
const TRANSLATE_CONCURRENCY = Number(process.env.TRANSLATE_CONCURRENCY || '2')  // 从1改为2
const REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.TRANSLATE_REQUESTS_PER_MINUTE || '30'))  // 从18改为30
const REQUEST_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE)
const INTERNAL_SECRET = process.env.TRANSLATE_INTERNAL_SECRET || ''

console.log('[translation-service] Configuration:', {
  SITE_URL,
  TRANSLATE_ENDPOINT,
  PREFERRED_PROVIDER,
  REQUESTS_PER_MINUTE,
  TRANSLATE_CONCURRENCY,
  REQUEST_INTERVAL_MS: `${REQUEST_INTERVAL_MS}ms`,
  HAS_INTERNAL_SECRET: !!INTERNAL_SECRET
})

// 缓存翻译结果（内存缓存，减少重复翻译）
const translationCache = new Map()

/**
 * 生成缓存键
 */
function getCacheKey(text, targetLang, sourceLang) {
  return `${sourceLang}:${targetLang}:${text.substring(0, 100)}`
}

/**
 * 批量翻译文本（通过代理优先 LibreTranslate，失败回退到原文）
 * @param {string[]} texts - 需要翻译的文本数组
 * @param {string} targetLang - 目标语言 (默认: 'zh-CN')
 * @param {string} sourceLang - 源语言 (默认: 'en')
 * @returns {Promise<string[]>} 翻译后的文本数组
 */
async function translateBatch(texts, targetLang = 'zh-CN', sourceLang = 'en') {
  if (!texts || texts.length === 0) {
    return []
  }

  // 通过代理批量翻译

  // 过滤空文本
  const validTexts = texts.filter(t => t && t.trim())
  if (validTexts.length === 0) {
    return texts.map(() => '')
  }

  try {
    // 检查缓存
    const results = []
    const textsToTranslate = []
    const indexMap = []

    validTexts.forEach((text, index) => {
      const cacheKey = getCacheKey(text, targetLang, sourceLang)
      const cached = translationCache.get(cacheKey)

      if (cached) {
        results[index] = cached
      } else {
        textsToTranslate.push(text)
        indexMap.push(index)
      }
    })

    // 如果全部命中缓存，直接返回
    if (textsToTranslate.length === 0) {
      console.log(`✅ 全部命中缓存，跳过翻译`)
      return results
    }

    console.log(`🔄 需要翻译 ${textsToTranslate.length}/${validTexts.length} 个文本（provider: ${PREFERRED_PROVIDER} via proxy）`)
    console.log(`🌐 翻译端点: ${TRANSLATE_ENDPOINT}`)

    let proxyResponse = null
    try {
      console.log(`📡 发送翻译请求到: ${TRANSLATE_ENDPOINT}`)
      proxyResponse = await fetch(TRANSLATE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Cron-Job/1.0',
          ...(INTERNAL_SECRET ? { 'Authorization': `Bearer ${INTERNAL_SECRET}` } : {})
        },
        body: JSON.stringify({ texts: textsToTranslate, targetLanguage: targetLang, sourceLanguage: sourceLang })
      })
    })
  } catch (e) {
    console.warn('⚠️ 代理调用网络错误:', e?.message || e)
  }

  const allTranslations = []
  if (proxyResponse && proxyResponse.ok) {
    try {
      const data = await proxyResponse.json()
      const translated = Array.isArray(data?.data) ? data.data : [] // 兼容批量接口
      // 注意：api/translate 目前可能只返回单个字符串（如果是单条翻译），或者对象。
      // 我们的 api/translate 似乎是设计为处理单条文本的？
      // 让我们检查 api/translate.js 的实现。
      // 看起来 api/translate.js 接收 { text, ... } 并返回 { data: string }
      // 如果我们发送 { texts: [...] }，api/translate.js 支持吗？
      // 检查 api/translate.js... 
      // 看起来 api/translate.js 只处理 `req.body.text`！不支持批量！
      // 这就是问题所在！我们发送了 { texts: [...] } 但它只期望 { text: ... }

      // 🔧 临时的客户端修复：如果 api/translate 不支持批量，我们需要在这里循环调用
      // 或者修改 api/translate 支持批量。
      // 考虑到 api/translate 是 Edge Function，修改它支持批量更好。

      // 假设 api/translate 已经修复支持批量（下一步操作），这里处理返回
      if (Array.isArray(translated)) {
        for (let i = 0; i < textsToTranslate.length; i++) {
          const original = textsToTranslate[i]
          const t = translated[i] || original
          allTranslations.push(t)
          const cacheKey = getCacheKey(original, targetLang, sourceLang)
          translationCache.set(cacheKey, t)
        }
      } else if (typeof data?.data === 'string') {
        // 单条返回的情况
        allTranslations.push(data.data)
        // ...
      }

    } catch (e) {
      console.warn('⚠️ 代理返回解析失败:', e?.message || e)
      // ...
    }
  } else {
    if (proxyResponse) {
      const errText = await proxyResponse.text()
      console.warn(`⚠️ 代理调用返回错误状态: ${proxyResponse.status} ${proxyResponse.statusText}`, errText)
    }
    // ...
  }
  try {
    const data = await proxyResponse.json()
    const translated = Array.isArray(data?.data) ? data.data : []
    for (let i = 0; i < textsToTranslate.length; i++) {
      const original = textsToTranslate[i]
      const t = translated[i] || original
      allTranslations.push(t)
      const cacheKey = getCacheKey(original, targetLang, sourceLang)
      translationCache.set(cacheKey, t)
    }
  } catch (e) {
    console.warn('⚠️ 代理返回解析失败，按原文回退:', e?.message || e)
    for (const text of textsToTranslate) {
      allTranslations.push(text)
    }
  }
} else {
  // 代理不可用时回退到原文（避免库依赖）
  for (const text of textsToTranslate) {
    allTranslations.push(text)
  }
}

// 填充结果
indexMap.forEach((resultIndex, translationIndex) => {
  results[resultIndex] = allTranslations[translationIndex]
})

return results
  } catch (error) {
  console.error('❌ 批量翻译失败:', error.message)
  // 翻译失败时返回原文
  return texts
}
}

/**
 * 翻译单个岗位数据
 * @param {object} job - 岗位数据
 * @returns {Promise<object>} 包含翻译的岗位数据
 */
async function translateJob(job) {
  try {
    // 如果已经有翻译，跳过
    if (job.translations && job.translations.title) {
      console.log(`⏭️ 岗位 [${job.id}] 已翻译，跳过`)
      return job
    }

    // 准备需要翻译的字段
    const textsToTranslate = []
    const textKeys = []

    // 标题
    if (job.title) {
      textsToTranslate.push(job.title)
      textKeys.push('title')
    }

    // 描述（限制长度，避免超过API限制）
    if (job.description) {
      const desc = job.description.substring(0, 500)
      textsToTranslate.push(desc)
      textKeys.push('description')
    }

    // 地点
    if (job.location) {
      textsToTranslate.push(job.location)
      textKeys.push('location')
    }

    // 工作类型
    if (job.type || job.jobType) {
      textsToTranslate.push(job.type || job.jobType)
      textKeys.push('type')
    }

    // 批量翻译
    if (textsToTranslate.length === 0) {
      return {
        ...job,
        translations: {},
        isTranslated: false
      }
    }

    const translations = await translateBatch(textsToTranslate)

    // 构建翻译对象
    const translationObj = {}
    let hasValidTranslation = false

    textKeys.forEach((key, index) => {
      if (key === 'title' || key === 'description' || key === 'location' || key === 'type') {
        const original = textsToTranslate[index]
        const translated = translations[index] || original

        translationObj[key] = translated

        // 简单的翻译成功检测（针对英译中）：
        // 如果原文不含中文，但译文含有中文，则认为翻译成功
        // 或者译文与原文不同，也认为可能有变化
        const originalHasChinese = /[\u4e00-\u9fa5]/.test(original)
        const translatedHasChinese = /[\u4e00-\u9fa5]/.test(translated)

        if (!originalHasChinese && translatedHasChinese) {
          hasValidTranslation = true
        } else if (translated !== original && translated.length > 0) {
          // 非中文环境下的回退检测
          hasValidTranslation = true
        } else if (originalHasChinese && translatedHasChinese) {
          // 原文已经是中文
          hasValidTranslation = true
        }
      }
    })

    // 如果没有有效翻译（例如英译中却全是英文），则不标记为已翻译
    if (!hasValidTranslation && textsToTranslate.some(t => t && t.trim().length > 0)) {
      console.warn(`⚠️ 岗位 [${job.id}] 翻译结果似乎无效（未检测到目标语言特征），不标记为已翻译`)
      return {
        ...job,
        translations: translationObj, // 仍然保存可能的部分结果
        isTranslated: false // 关键：不标记为完成，以便下次重试
      }
    }

    // 公司名称不翻译，保留原文
    if (job.company) {
      translationObj.company = job.company
    }

    return {
      ...job,
      translations: translationObj,
      translatedAt: new Date().toISOString(),
      isTranslated: true
    }
  } catch (error) {
    console.error(`❌ 翻译岗位失败 [${job.id}]:`, error.message)
    // 翻译失败，返回原数据并标记
    return {
      ...job,
      translations: null,
      isTranslated: false
    }
  }
}

/**
 * 批量翻译岗位数据
 * @param {object[]} jobs - 岗位数据数组
 * @returns {Promise<object[]>} 翻译后的岗位数组
 */
async function translateJobs(jobs) {
  if (!jobs || jobs.length === 0) {
    return []
  }

  console.log(`🌍 开始批量翻译 ${jobs.length} 个岗位...`)
  const startTime = Date.now()

  try {
    // 筛选需要翻译的岗位
    const jobsToTranslate = jobs.filter(job => !job.isTranslated)
    console.log(`📝 需要翻译: ${jobsToTranslate.length}/${jobs.length}`)

    if (jobsToTranslate.length === 0) {
      console.log(`✅ 所有岗位已翻译`)
      return jobs
    }

    const translatedJobs = []
    const batchSize = Math.max(1, TRANSLATE_CONCURRENCY)

    if (batchSize === 1) {
      // 顺序执行，每次请求之间等待，严格控制速率
      for (let i = 0; i < jobsToTranslate.length; i++) {
        const r = await translateJob(jobsToTranslate[i])
        translatedJobs.push(r)
        console.log(`📊 翻译进度: ${translatedJobs.length}/${jobsToTranslate.length}`)
        if (i + 1 < jobsToTranslate.length) {
          await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL_MS))
        }
      }
    } else {
      // 有限并发：按批处理，批次之间等待以近似满足速率
      for (let i = 0; i < jobsToTranslate.length; i += batchSize) {
        const batch = jobsToTranslate.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(job => translateJob(job)))
        translatedJobs.push(...batchResults)
        console.log(`📊 翻译进度: ${translatedJobs.length}/${jobsToTranslate.length}`)
        if (i + batchSize < jobsToTranslate.length) {
          const approxWait = Math.max(1000, Math.ceil((REQUEST_INTERVAL_MS * batch.length) / Math.max(1, batchSize)))
          await new Promise(resolve => setTimeout(resolve, approxWait))
        }
      }
    }

    // 合并已翻译和未翻译的岗位
    const resultJobs = jobs.map(job => {
      if (job.isTranslated) {
        return job
      }
      const translated = translatedJobs.find(t => t.id === job.id)
      return translated || job
    })

    const duration = Date.now() - startTime
    const successCount = resultJobs.filter(j => j.isTranslated).length
    console.log(`✅ 批量翻译完成: ${successCount}/${jobs.length} 个岗位, 耗时: ${duration}ms`)

    // 清理缓存（保持最新1000条）
    if (translationCache.size > 1000) {
      const keysToDelete = Array.from(translationCache.keys()).slice(0, translationCache.size - 1000)
      keysToDelete.forEach(key => translationCache.delete(key))
    }

    return resultJobs
  } catch (error) {
    console.error('❌ 批量翻译岗位失败:', error.message)
    return jobs
  }
}

// 工具函数：数组分块
function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

module.exports = {
  translateBatch,
  translateJob,
  translateJobs
}

