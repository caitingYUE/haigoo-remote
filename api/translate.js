/**
 * Vercel Edge Function - 翻译API代理
 * 解决前端直接调用翻译API的CORS问题
 * 支持多个免费翻译服务提供商
 */

export const config = {
  runtime: 'edge',
}

// 支持的翻译服务
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

/**
 * 主翻译函数 - 多服务回退机制
 */
async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text || text.trim().length === 0) {
    return {
      success: true,
      data: {
        translatedText: text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        confidence: 1.0,
        provider: 'None'
      }
    }
  }

  // 标准化语言代码
  const normalizedTargetLang = LANGUAGE_MAP[targetLang] || targetLang
  const normalizedSourceLang = sourceLang === 'auto' ? 'auto' : (LANGUAGE_MAP[sourceLang] || sourceLang)

  // 按优先级尝试各个翻译服务
  // 🔧 FIX: 优先使用 Google Translate（质量最好），其次 LibreTranslate，最后 MyMemory
  const preferred = (process.env.PREFERRED_TRANSLATION_PROVIDER || 'google').toLowerCase()
  const byProvider = {
    libretranslate: () => translateWithLibreTranslate(text, normalizedTargetLang, normalizedSourceLang),
    google: () => translateWithGoogle(text, normalizedTargetLang, normalizedSourceLang),
    mymemory: () => translateWithMyMemory(text, normalizedTargetLang, normalizedSourceLang)
  }

  // 构建服务顺序：ENV 优先，否则默认 [Google, LibreTranslate, MyMemory]
  const services = preferred && byProvider[preferred]
    ? [byProvider[preferred], ...Object.entries(byProvider)
      .filter(([k]) => k !== preferred)
      .map(([_, fn]) => fn)]
    : [
      byProvider.google,          // 🔧 FIX: Google 优先
      byProvider.libretranslate,
      byProvider.mymemory
    ]

  let lastError = null

  // 尝试所有可用的翻译服务
  for (const [index, service] of services.entries()) {
    const providerName = service.name.replace('translateWith', '') || 'unknown';
    console.log(`[api/translate] 尝试第 ${index + 1} 个服务 (${providerName})...`);
    try {
      const result = await service();
      if (result.success) {
        // Check if it returned original text or empty value, as per user's snippet intent
        if (result.data.translatedText === text || !result.data.translatedText) {
          console.warn(`[api/translate] ⚠️ 服务 (${providerName}) 返回了原文或空值，尝试下一个服务。`);
          lastError = `Provider ${providerName} returned original text or empty.`;
          continue; // Try next service
        }
        console.log(`[api/translate] ✅ 服务调用成功 (${providerName})`);
        return result;
      }
      // If result.success is false, it's an error from the service itself
      console.error(`[api/translate] ❌ 服务 (${providerName}) 调用失败: ${result.error}`);
      lastError = result.error;
    } catch (error) {
      console.error(`[api/translate] ❌ 服务 (${providerName}) 调用失败 (异常): ${error.message}`);
      lastError = error.message;
      // continue; // Loop will naturally continue to the next service
    }
  }

  console.error(`[api/translate] ❌ 所有服务均失败`);
  // 所有服务都失败，返回原文
  return {
    success: false,
    error: lastError || 'All translation services failed',
    data: {
      translatedText: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      confidence: 0,
      provider: 'Fallback'
    }
  }
}

/**
 * 批量翻译函数
 */
async function batchTranslate(texts, targetLang, sourceLang = 'auto') {
  const results = await Promise.all(
    texts.map(text => translateText(text, targetLang, sourceLang))
  )

  const translatedTexts = results.map((result, index) =>
    result.success && result.data ? result.data.translatedText : texts[index]
  )

  const hasErrors = results.some(result => !result.success)

  return {
    success: !hasErrors,
    data: translatedTexts,
    errors: hasErrors ? results.filter(r => !r.success).map(r => r.error) : undefined
  }
}

// Simple in-memory rate limiter for Edge Functions
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 300; // 300 translation requests per minute per IP (Increased for batch processing)

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    // Cleanup old entries periodically
    if (rateLimitStore.size > 1000) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetAt < now) rateLimitStore.delete(k);
      }
    }
    return true;
  }

  if (record.resetAt < now) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Edge Function处理器
 */
export default async function handler(request) {
  // 设置CORS头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  // 只允许POST请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }

  // Rate limiting（支持内部鉴权绕过）
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const internalSecret = process.env.TRANSLATE_INTERNAL_SECRET || ''
  const authHeader = request.headers.get('authorization') || ''
  const isInternal = internalSecret && authHeader === `Bearer ${internalSecret}`
  if (!isInternal && !checkRateLimit(clientIp)) {
    console.warn(`[translate] Rate limit exceeded for ${clientIp}`);
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many translation requests. Please try again later.',
      retryAfter: 60
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    })
  }

  try {
    const body = await request.json()
    const { text, texts, targetLanguage = 'zh', sourceLanguage = 'auto' } = body

    let result

    if (texts && Array.isArray(texts)) {
      // 批量翻译
      result = await batchTranslate(texts, targetLanguage, sourceLanguage)
    } else if (text) {
      // 单个翻译
      result = await translateText(text, targetLanguage, sourceLanguage)
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing text or texts parameter'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error(`[translate] Error:`, {
      message: error.message,
      name: error.name,
      ip: clientIp
    });
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
}