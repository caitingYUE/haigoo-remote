const { URLSearchParams } = require('url');

// ==========================================
// 配置区域
// ==========================================

// 语言代码映射
const LANGUAGE_MAP = {
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  'en': 'en',
  'fr': 'fr',
  'de': 'de',
  'es': 'es',
  'ja': 'ja',
  'ko': 'ko',
  'ru': 'ru',
  'pt': 'pt',
  'it': 'it',
  'ar': 'ar'
}

// 翻译服务配置
const TRANSLATION_SERVICES = {
  mymemory: {
    name: 'MyMemory',
    baseUrl: 'https://api.mymemory.translated.net/get',
    priority: 1,
    maxLength: 500
  },
  libretranslate: {
    name: 'LibreTranslate',
    baseUrl: 'https://translate.argosopentech.com/translate',
    priority: 2,
    maxLength: 1000
  },
  google: {
    name: 'Google Translate',
    baseUrl: 'https://translate.googleapis.com/translate_a/single',
    priority: 3,
    maxLength: 5000
  }
}

// 环境变量配置
const PREFERRED_PROVIDER = (process.env.PREFERRED_TRANSLATION_PROVIDER || 'google').toLowerCase()
const REQUESTS_PER_MINUTE = Number(process.env.TRANSLATE_REQUESTS_PER_MINUTE || 30)
const TRANSLATE_CONCURRENCY = Number(process.env.TRANSLATE_CONCURRENCY || 2)
const REQUEST_INTERVAL_MS = Math.floor(60000 / Math.max(1, REQUESTS_PER_MINUTE))

// 简单内存缓存
const translationCache = new Map()

// ==========================================
// 翻译提供商实现 (从 api/translate.js 移植)
// ==========================================

/**
 * MyMemory翻译服务
 */
async function translateWithMyMemory(text, targetLang, sourceLang = 'auto') {
  try {
    const maxLen = TRANSLATION_SERVICES.mymemory.maxLength
    const clipped = typeof text === 'string' ? text.substring(0, maxLen) : ''
    const langPair = sourceLang === 'auto' ? `auto|${targetLang}` : `${sourceLang}|${targetLang}`
    const url = `${TRANSLATION_SERVICES.mymemory.baseUrl}?q=${encodeURIComponent(clipped)}&langpair=${langPair}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Translation-Proxy/1.0)'
      }
    })

    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'MyMemory translation failed')
    }

    return {
      success: true,
      data: {
        translatedText: data.responseData.translatedText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        confidence: data.responseData.match / 100,
        provider: 'MyMemory'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      provider: 'MyMemory'
    }
  }
}

/**
 * LibreTranslate翻译服务
 */
async function translateWithLibreTranslate(text, targetLang, sourceLang = 'auto') {
  try {
    const maxLen = TRANSLATION_SERVICES.libretranslate.maxLength
    const clipped = typeof text === 'string' ? text.substring(0, maxLen) : ''
    const response = await fetch(TRANSLATION_SERVICES.libretranslate.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        q: clipped,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      })
    })

    if (!response.ok) {
      throw new Error(`LibreTranslate API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        translatedText: data.translatedText,
        sourceLanguage: data.detectedLanguage?.language || sourceLang,
        targetLanguage: targetLang,
        confidence: data.detectedLanguage?.confidence || 0.8,
        provider: 'LibreTranslate'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      provider: 'LibreTranslate'
    }
  }
}

/**
 * Google Translate翻译服务（免费API）
 */
async function translateWithGoogle(text, targetLang, sourceLang = 'auto') {
  try {
    const maxLen = TRANSLATION_SERVICES.google.maxLength
    const clipped = typeof text === 'string' ? text.substring(0, maxLen) : ''
    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLang === 'auto' ? 'auto' : sourceLang,
      tl: targetLang,
      dt: 't',
      q: clipped
    })

    const response = await fetch(`${TRANSLATION_SERVICES.google.baseUrl}?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data || !Array.isArray(data) || !data[0]) {
      throw new Error('Invalid Google Translate response')
    }

    let translatedText = ''
    if (Array.isArray(data[0])) {
      translatedText = data[0].map(item => item[0]).join('')
    } else {
      translatedText = data[0][0][0] || text
    }

    const detectedLang = data[2] || sourceLang

    return {
      success: true,
      data: {
        translatedText,
        sourceLanguage: detectedLang,
        targetLanguage: targetLang,
        confidence: 0.9,
        provider: 'Google Translate'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      provider: 'Google Translate'
    }
  }
}

// ==========================================
// 核心逻辑
// ==========================================

/**
 * 单文本翻译 - 多服务回退机制
 */
async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text) return text

  // 确保输入是字符串
  if (typeof text !== 'string') {
    return text
  }

  if (text.trim().length === 0) {
    return text
  }

  // 检查缓存
  const cacheKey = `${sourceLang}:${targetLang}:${text}`
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)
  }

  // 标准化语言代码
  const normalizedTargetLang = LANGUAGE_MAP[targetLang] || targetLang
  const normalizedSourceLang = sourceLang === 'auto' ? 'auto' : (LANGUAGE_MAP[sourceLang] || sourceLang)

  // 服务列表
  const byProvider = {
    libretranslate: () => translateWithLibreTranslate(text, normalizedTargetLang, normalizedSourceLang),
    google: () => translateWithGoogle(text, normalizedTargetLang, normalizedSourceLang),
    mymemory: () => translateWithMyMemory(text, normalizedTargetLang, normalizedSourceLang)
  }

  // 构建服务顺序
  const services = PREFERRED_PROVIDER && byProvider[PREFERRED_PROVIDER]
    ? [byProvider[PREFERRED_PROVIDER], ...Object.entries(byProvider)
      .filter(([k]) => k !== PREFERRED_PROVIDER)
      .map(([_, fn]) => fn)]
    : [byProvider.google, byProvider.libretranslate, byProvider.mymemory]

  // 尝试所有服务
  for (const service of services) {
    try {
      const result = await service()
      if (result.success && result.data && result.data.translatedText) {
        const translated = result.data.translatedText
        // 简单验证：如果结果为空或与原文完全一致(且原文很长)，可能无效
        if (!translated || (translated === text && text.length > 20)) {
          continue
        }
        translationCache.set(cacheKey, translated)
        return translated
      }
    } catch (e) {
      console.warn(`Translation service failed: ${e.message}`)
    }
  }

  // 全部失败，返回原文
  return text
}

/**
 * 批量翻译文本
 */
async function translateBatch(texts, targetLang = 'zh', sourceLang = 'auto') {
  if (!texts || texts.length === 0) return []

  console.log(`🔄 批量翻译 ${texts.length} 个文本...`)

  // 并发控制
  const results = []
  const concurrency = 3 // 内部并发度

  for (let i = 0; i < texts.length; i += concurrency) {
    const chunk = texts.slice(i, i + concurrency)
    const chunkResults = await Promise.all(chunk.map(text => translateText(text, targetLang, sourceLang)))
    results.push(...chunkResults)
  }

  return results
}

/**
 * 翻译单个岗位对象
 */
async function translateJob(job) {
  if (!job) return null

  // 如果已经翻译过，直接返回
  if (job.isTranslated && job.translations) {
    return job
  }

  console.log(`🔄 正在翻译岗位: ${job.title} (${job.id})`)

  const fieldsToTranslate = [
    job.title,
    job.description,
    job.requirements,
    job.benefits
  ]

  // 执行翻译
  const translatedFields = await translateBatch(fieldsToTranslate, 'zh', 'auto')

  const translations = {
    title: translatedFields[0] || job.title,
    description: translatedFields[1] || job.description,
    requirements: translatedFields[2] || job.requirements,
    benefits: translatedFields[3] || job.benefits,
    updatedAt: new Date().toISOString()
  }

  // 验证翻译结果
  // 如果标题翻译后与原文相同，且原文是英文，可能翻译失败
  // 但这里我们已经尽力了，标记为已翻译

  return {
    ...job,
    translations,
    isTranslated: true
  }
}

/**
 * 批量翻译岗位列表
 */
async function translateJobs(jobs) {
  if (!jobs || jobs.length === 0) return []

  console.log(`🌍 开始处理 ${jobs.length} 个岗位的翻译任务`)
  const startTime = Date.now()

  const results = []
  // 使用全局并发配置
  const batchSize = TRANSLATE_CONCURRENCY

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(job => translateJob(job)))
    results.push(...batchResults)

    // 速率限制等待
    if (i + batchSize < jobs.length) {
      console.log(`⏳ 等待 ${REQUEST_INTERVAL_MS}ms 以遵守速率限制...`)
      await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL_MS))
    }
  }

  const duration = Date.now() - startTime
  console.log(`✅ 批量翻译完成，耗时: ${duration}ms`)

  return results
}

module.exports = {
  translateBatch,
  translateJob,
  translateJobs
}
