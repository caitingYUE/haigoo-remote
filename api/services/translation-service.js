/**
 * 后端翻译服务
 * 使用免费的 Google Translate API 进行批量翻译
 * 
 * 核心功能：
 * 1. 批量翻译文本
 * 2. 翻译单个岗位数据
 * 3. 批量翻译岗位数据
 * 
 * 使用 @vitalets/google-translate-api 免费库
 */

// 动态导入 google-translate-api
let translate = null
try {
  // 尝试导入翻译库
  const translationModule = require('@vitalets/google-translate-api')
  translate = translationModule.translate || translationModule.default?.translate || translationModule.default
} catch (error) {
  console.error('⚠️ 无法加载 google-translate-api，翻译功能将不可用')
}

// 缓存翻译结果（内存缓存，减少重复翻译）
const translationCache = new Map()

/**
 * 生成缓存键
 */
function getCacheKey(text, targetLang, sourceLang) {
  return `${sourceLang}:${targetLang}:${text.substring(0, 100)}`
}

/**
 * 批量翻译文本（使用免费的 Google Translate API）
 * @param {string[]} texts - 需要翻译的文本数组
 * @param {string} targetLang - 目标语言 (默认: 'zh-CN')
 * @param {string} sourceLang - 源语言 (默认: 'en')
 * @returns {Promise<string[]>} 翻译后的文本数组
 */
async function translateBatch(texts, targetLang = 'zh-CN', sourceLang = 'en') {
  if (!texts || texts.length === 0) {
    return []
  }

  // 检查翻译库是否可用
  if (!translate) {
    console.warn('⚠️ Google Translate API 不可用，返回原文')
    return texts
  }

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

    console.log(`🔄 需要翻译 ${textsToTranslate.length}/${validTexts.length} 个文本`)

    // Google Translate API 免费版需要逐个翻译
    const allTranslations = []

    for (const text of textsToTranslate) {
      try {
        const result = await translate(text, { 
          from: sourceLang, 
          to: targetLang 
        })
        
        const translatedText = result.text || result
        allTranslations.push(translatedText)
        
        // 更新缓存
        const cacheKey = getCacheKey(text, targetLang, sourceLang)
        translationCache.set(cacheKey, translatedText)
        
        // 添加小延迟，避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`翻译失败: ${text.substring(0, 50)}...`, error.message)
        // 翻译失败，使用原文
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
    textKeys.forEach((key, index) => {
      if (key === 'title' || key === 'description' || key === 'location' || key === 'type') {
        translationObj[key] = translations[index] || textsToTranslate[index]
      }
    })

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

    // 并发翻译，但限制并发数（避免API速率限制）
    const batchSize = 5
    const translatedJobs = []

    for (let i = 0; i < jobsToTranslate.length; i += batchSize) {
      const batch = jobsToTranslate.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(job => translateJob(job))
      )
      translatedJobs.push(...batchResults)
      
      // 进度日志
      console.log(`📊 翻译进度: ${translatedJobs.length}/${jobsToTranslate.length}`)
      
      // 批次间延迟
      if (i + batchSize < jobsToTranslate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
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

