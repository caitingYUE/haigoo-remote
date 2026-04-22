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
  },
  ai: {
    name: 'AI Translate (Bailian/DeepSeek)',
    priority: 0, // Lowest priority backup
    maxLength: 4000
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
// 术语保护机制
// ==========================================
const PROTECTED_TERMS = [
  'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'Go', 'GO', 'Golang', 'Rust',
  'AWS', 'Docker', 'Kubernetes', 'CI/CD', 'SQL', 'MongoDB', 'Redis', 'API', 'REST', 'GraphQL',
  'DevOps', 'Agile', 'Scrum', 'Jira', 'Git', 'Linux', 'Windows', 'MacOS', 'iOS', 'Android',
  'Flutter', 'React Native', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SASS', 'LESS',
  'Webpack', 'Vite', 'Next.js', 'Nuxt.js', 'Nest.js', 'Express', 'Koa', 'Spring Boot',
  'Django', 'Flask', 'FastAPI', 'ASP.NET', 'C#', 'C++', 'PHP', 'Ruby', 'Swift', 'Kotlin',
  'Scala', 'R', 'Matlab', 'TensorFlow', 'PyTorch', 'Keras', 'Pandas', 'NumPy', 'Scikit-learn',
  'OpenCV', 'NLP', 'LLM', 'GPT', 'BERT', 'Transformer', 'OpenAI', 'Anthropic', 'Gemini',
  'Claude', 'Llama', 'Mistral', 'Stable Diffusion', 'Midjourney', 'DALL-E',
  'Frontend', 'Backend', 'Fullstack', 'Full-stack', 'Middleware', 'Database', 'Serverless',
  'Tailwind', 'Bootstrap', 'jQuery', 'Redux', 'MobX', 'Zustand', 'Recoil', 'Apollo',
  'Prisma', 'TypeORM', 'Sequelize', 'Mongoose', 'PostgreSQL', 'MySQL', 'SQLite', 'MariaDB',
  'Elasticsearch', 'RabbitMQ', 'Kafka', 'Nginx', 'Apache', 'Jenkins', 'GitHub', 'GitLab',
  'Bitbucket', 'Heroku', 'Vercel', 'Netlify', 'DigitalOcean', 'Linode', 'Azure', 'GCP',
  'Puppeteer', 'Jest', 'Cypress', 'Playwright', 'Selenium', 'Mocha', 'Chai', 'Jasmine',
  'Terraform', 'Prometheus', 'Grafana', 'K8s', 'SRE', 'gRPC'
];

/**
 * 保护术语不被翻译
 * @param {string} text 
 * @returns {{text: string, map: Map<string, string>}}
 */
function protectTerms(text) {
  if (!text) return { text, map: new Map() };
  let protectedText = text;
  const map = new Map();
  let counter = 0;

  // Sort terms by length desc to handle overlapping terms (e.g. "React Native" vs "React")
  const sortedTerms = [...PROTECTED_TERMS].sort((a, b) => b.length - a.length);

  sortedTerms.forEach(term => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = term === 'Go' || term === 'GO' ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escapedTerm}\\b`, flags);

    protectedText = protectedText.replace(regex, (match) => {
      const key = `HAIGOOTERMX${counter++}X`;
      map.set(key, match);
      return key;
    });
  });

  return { text: protectedText, map };
}

/**
 * 恢复受保护的术语
 * @param {string} text 
 * @param {Map<string, string>} map 
 * @returns {string}
 */
function restoreTerms(text, map) {
  if (!text || !map || map.size === 0) return text;
  let restoredText = text;

  map.forEach((original, key) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    restoredText = restoredText.replace(new RegExp(escapedKey, 'g'), original);
  });

  return restoredText;
}

function stripTranslationPlaceholderArtifacts(text) {
  if (!text) return text;

  return String(text)
    .replace(/HAIGOOTERMX\d+X/gi, '')
    .replace(/__TERM_\d+__/gi, '')
    .replace(/__[\u4e00-\u9fa5A-Za-z0-9]+(?:_[\u4e00-\u9fa5A-Za-z0-9]+)*__/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ==========================================
// 辅助函数
// ==========================================

/**
 * Split text into chunks that fit within maxLen
 */
function splitText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  
  const chunks = [];
  let current = text;
  
  while (current.length > maxLen) {
      let cutAt = maxLen;
      // Look for a good break point in the last 20% of the allowable length
      const searchStart = Math.floor(maxLen * 0.8);
      const searchEnd = maxLen;
      const slice = current.substring(searchStart, searchEnd);
      
      // Priorities: Newline > Period > Space
      const lastNewline = slice.lastIndexOf('\n');
      const lastPeriod = slice.lastIndexOf('. ');
      const lastSpace = slice.lastIndexOf(' ');
      
      if (lastNewline !== -1) {
          cutAt = searchStart + lastNewline + 1; // Include newline
      } else if (lastPeriod !== -1) {
          cutAt = searchStart + lastPeriod + 1; // Include period
      } else if (lastSpace !== -1) {
          cutAt = searchStart + lastSpace; // Exclude space (will be trimmed from next)
      }
      
      chunks.push(current.substring(0, cutAt));
      current = current.substring(cutAt);
  }
  
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Execute translation with chunking support
 */
async function translateWithChunking(text, maxLen, translateFn) {
    if (typeof text !== 'string' || text.length <= maxLen) {
        return translateFn(text);
    }

    console.log(`Text length ${text.length} exceeds limit ${maxLen}, splitting into chunks...`);
    const chunks = splitText(text, maxLen);
    const results = [];
    
    for (const chunk of chunks) {
        try {
            const res = await translateFn(chunk);
            if (!res.success) return res; // Fail fast
            results.push(res);
        } catch (e) {
            return { success: false, error: e.message, provider: 'Chunking' };
        }
    }

    // Combine results
    const combinedText = results.map(r => r.data.translatedText).join('');
    
    return {
        success: true,
        data: {
            translatedText: combinedText,
            sourceLanguage: results[0].data.sourceLanguage,
            targetLanguage: results[0].data.targetLanguage,
            confidence: results[0].data.confidence,
            provider: results[0].data.provider
        }
    };
}

// ==========================================
// 翻译提供商实现 (从 api/translate.js 移植)
// ==========================================

/**
 * MyMemory翻译服务
 */
async function translateWithMyMemory(text, targetLang, sourceLang = 'auto') {
  const doTranslate = async (inputText) => {
      try {
        const langPair = sourceLang === 'auto' ? `auto|${targetLang}` : `${sourceLang}|${targetLang}`
        const url = `${TRANSLATION_SERVICES.mymemory.baseUrl}?q=${encodeURIComponent(inputText)}&langpair=${langPair}`

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
  };

  return translateWithChunking(text, TRANSLATION_SERVICES.mymemory.maxLength, doTranslate);
}

/**
 * LibreTranslate翻译服务
 */
async function translateWithLibreTranslate(text, targetLang, sourceLang = 'auto') {
  const doTranslate = async (inputText) => {
      try {
        const response = await fetch(TRANSLATION_SERVICES.libretranslate.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            q: inputText,
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
  };

  return translateWithChunking(text, TRANSLATION_SERVICES.libretranslate.maxLength, doTranslate);
}

/**
 * Google Translate翻译服务（免费API）
 */
async function translateWithGoogle(text, targetLang, sourceLang = 'auto') {
  const doTranslate = async (inputText) => {
      try {
        const params = new URLSearchParams({
          client: 'gtx',
          sl: sourceLang === 'auto' ? 'auto' : sourceLang,
          tl: targetLang,
          dt: 't',
          q: inputText
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
          translatedText = data[0][0][0] || inputText
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
  };

  return translateWithChunking(text, TRANSLATION_SERVICES.google.maxLength, doTranslate);
}

// Global configuration
let config = {
  aiEnabled: false // Default to false (disabled) unless explicitly enabled
};

/**
 * Configure the translation service
 */
function configure(newConfig) {
  config = { ...config, ...newConfig };
  console.log('Translation Service Configured:', config);
}

/**
 * AI翻译服务 (Bailian/DeepSeek)
 */
async function translateWithAI(text, targetLang, sourceLang = 'auto') {
  // Check if AI is enabled
  if (!config.aiEnabled) {
    return { success: false, error: 'AI Translation is disabled', provider: 'AI' };
  }

  try {
    // 优先使用 DeepSeek
    // Limit keys
    const deepseekKey = process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
    const bailianKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY

    let apiUrl = ''
    let apiKey = ''
    let requestBody = {}
    let providerName = ''

    // User Preferred: Bailian (more reliable) > DeepSeek (cheaper but unstable)
    if (bailianKey) {
      providerName = 'Bailian'
      // Use Qwen-Plus or compatible endpoint
      apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
      apiKey = bailianKey
      requestBody = {
        model: 'qwen-plus', // Or qwen-turbo
        messages: [
          { role: "system", content: `You are a professional translator. Translate the following text to ${targetLang === 'zh' ? 'Chinese' : targetLang}. Keep technical terms (like React, Java, Python, API, etc.) in their original English form. Only output the translated text without explanations.` },
          { role: "user", content: text }
        ],
        stream: false
      }
    } else if (deepseekKey) {
      providerName = 'DeepSeek'
      apiUrl = 'https://api.deepseek.com/chat/completions'
      apiKey = deepseekKey
      requestBody = {
        model: 'deepseek-chat',
        messages: [
          { role: "system", content: `You are a professional translator. Translate the following text to ${targetLang === 'zh' ? 'Chinese' : targetLang}. Keep technical terms (like React, Java, Python, API, etc.) in their original English form. Only output the translated text without explanations.` },
          { role: "user", content: text }
        ],
        stream: false
      }
    } else {
      throw new Error('No AI API Key found')
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`${providerName} API error: ${response.status} ${err}`)
    }

    const data = await response.json()
    let translatedText = ''

    if (providerName === 'DeepSeek') {
      translatedText = data.choices?.[0]?.message?.content || ''
    } else {
      translatedText = data.output?.text || ''
    }

    // Extract usage
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      success: true,
      data: {
        translatedText: translatedText.trim(),
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        confidence: 0.95,
        provider: providerName,
        usage: {
          input: usage.prompt_tokens || usage.input_tokens || 0,
          output: usage.completion_tokens || usage.output_tokens || 0,
          total: usage.total_tokens || 0
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      provider: 'AI'
    }
  }
}

// ==========================================
// 核心逻辑
// ==========================================

/**
 * 单文本翻译 - 多服务回退机制
 */
async function translateText(originalText, targetLang, sourceLang = 'auto') {
  if (!originalText) return originalText

  // 确保输入是字符串
  if (typeof originalText !== 'string') {
    return originalText
  }

  if (originalText.trim().length === 0) {
    return originalText
  }

  // Protect technical terms
  const { text, map } = protectTerms(originalText);

  // 检查缓存
  const cacheKey = `${sourceLang}:${targetLang}:${text}`
  if (translationCache.has(cacheKey)) {
    return stripTranslationPlaceholderArtifacts(restoreTerms(translationCache.get(cacheKey), map));
  }

  // 标准化语言代码
  const normalizedTargetLang = LANGUAGE_MAP[targetLang] || targetLang
  const normalizedSourceLang = sourceLang === 'auto' ? 'auto' : (LANGUAGE_MAP[sourceLang] || sourceLang)

  // 服务列表
  const byProvider = {
    ai: () => translateWithAI(text, normalizedTargetLang, normalizedSourceLang),
    libretranslate: () => translateWithLibreTranslate(text, normalizedTargetLang, normalizedSourceLang),
    google: () => translateWithGoogle(text, normalizedTargetLang, normalizedSourceLang),
    mymemory: () => translateWithMyMemory(text, normalizedTargetLang, normalizedSourceLang)
  }

  // 构建服务顺序
  const services = []

  // 1. 优先使用配置的首选服务 (如果是 google/libretranslate/mymemory)
  // User Feedback 2026-01-07: Prioritize Free Services first. AI is fallback.
  if (PREFERRED_PROVIDER && byProvider[PREFERRED_PROVIDER] && PREFERRED_PROVIDER !== 'ai') {
    services.push(byProvider[PREFERRED_PROVIDER])
  }

  // 2. 依次加入其他免费服务
  if (PREFERRED_PROVIDER !== 'google') services.push(byProvider.google)
  if (PREFERRED_PROVIDER !== 'libretranslate') services.push(byProvider.libretranslate)
  if (PREFERRED_PROVIDER !== 'mymemory') services.push(byProvider.mymemory)

  // 3. 最后使用 AI 服务作为兜底 (Backup)，以节省成本
  // 只有当所有免费服务都失败时，且 AI 被启用时，才会调用 AI
  if (config.aiEnabled && (process.env.VITE_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY)) {
    services.push(byProvider.ai)
  }

  // 尝试所有服务
  for (const service of services) {
    try {
      console.log(`🔄 正在使用 ${service.name} 翻译: ${text.substring(0, 50)}...`)
      const result = await service()
      if (result.success && result.data && result.data.translatedText) {
        const translated = result.data.translatedText
        // 简单验证：如果结果为空或与原文完全一致(且原文很长)，可能无效
        if (!translated || (translated === text && text.length > 20)) {
          continue
        }

        // Return usage if available (only for AI provider usually)
        if (result.data.usage) {
          const restored = stripTranslationPlaceholderArtifacts(restoreTerms(translated, map));
          return { text: restored, usage: result.data.usage }
        }

        const restored = stripTranslationPlaceholderArtifacts(restoreTerms(translated, map));
        translationCache.set(cacheKey, restored)
        return restored;
      }
    } catch (e) {
      console.warn(`Translation service failed: ${e.message}`)
    }
  }

  // 全部失败，返回原文
  return originalText
}

/**
 * 批量翻译文本
 */
async function translateBatch(texts, targetLang = 'zh', sourceLang = 'auto') {
  if (!texts || texts.length === 0) return []

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
async function translateJob(job, force = false) {
  if (!job) return null

  // 如果已经翻译过且翻译内容有效，且不强制更新，直接返回
  // 增强检查：确保 translations 不为空且包含标题
  if (!force && job.isTranslated && job.translations && Object.keys(job.translations).length > 0 && job.translations.title) {
    return job
  }

  console.log(`🔄 正在翻译岗位: ${job.title} (${job.id}) [Force: ${force}]`)

  const fieldsToTranslate = [
    job.title,
    job.description,
    job.requirements,
    job.benefits
  ]

  // 执行翻译
  const translatedFields = await translateBatch(fieldsToTranslate, 'zh', 'auto')
  console.log(`✅ 岗位 (${job.id}) 翻译完成: ${translatedFields}`)

  // Aggregate usage from batch results if they are objects with usage
  let totalUsage = { input: 0, output: 0, total: 0 }

  const texts = translatedFields.map(res => {
    if (!res) return ""
    // object
    if (typeof res === 'object' && res.text) {
      if (res.usage) {
        totalUsage.input += res.usage.input || 0
        totalUsage.output += res.usage.output || 0
        totalUsage.total += res.usage.total || 0
      }
      return res.text
    }
    // string
    return res
  })

  const translations = {
    title: texts[0] || job.title,
    description: texts[1] || job.description,
    requirements: texts[2] || job.requirements,
    benefits: texts[3] || job.benefits,
    updatedAt: new Date().toISOString()
  }

  // 验证翻译结果
  // 1. 提取中文字符
  const chineseCharCount = (translations.description || '').match(/[\u4e00-\u9fa5]/g)?.length || 0;

  // 2. 比例检查
  const totalLength = (translations.description || '').replace(/\s/g, '').length;
  const chineseRatio = totalLength > 0 ? (chineseCharCount / totalLength) : 0;

  // 规则修正 (2025-01-08):
  // - 之前的 >= 20 过于严格，会导致短 JD 翻译失败。
  // - 短文本 (< 100): 只要有 5 个以上中文字符即可 (避免 "Full Time" -> "全职" 这种极短的被误杀，或者至少保证有一句话)
  // - 长文本 (>= 100): 维持 >= 20 个中文字符 且 (比例 > 10% 或 纯中文 > 100)

  let isValid = false;
  if (totalLength < 100) {
    // 宽松模式：短文本只要有一些中文即可
    isValid = chineseCharCount >= 5;
    // 极短文本保护：如果原文也很短 (<20)，且翻译后有中文，也算过
    if (job.description && job.description.length < 50 && chineseCharCount > 1) {
      isValid = true;
    }
  } else {
    // 严格模式：长文本必须有足够密度的中文
    isValid = chineseCharCount >= 20 && (chineseRatio >= 0.1 || chineseCharCount >= 100);
  }

  if (!isValid) {
    let failureReason = '';
    if (chineseCharCount === 0 && totalLength > 0) {
      failureReason = 'Zero Chinese Characters';
      console.warn(`⚠️ 岗位 ${job.id} 翻译失败: 无中文内容`);
    } else {
      failureReason = `Insuffient Chinese (Len: ${totalLength}, Count: ${chineseCharCount}, Ratio: ${chineseRatio.toFixed(2)})`;
      console.warn(`⚠️ 岗位 ${job.id} 翻译校验失败: ${failureReason}`);
    }

    // Fallback: If validation fails, mark as translated but use original text (to prevent infinite retries)
    // We assume the text is just not suitable for translation or provider failed gracefully to English
    return {
      ...job,
      translations: {
        ...translations,
        title: job.title, // Revert to original
        description: job.description, // Revert to original
        _warning: failureReason // Mark it
      },
      isTranslated: true, // Mark as processed so we don't retry forever
      translationError: failureReason
    }
  }

  return {
    ...job,
    translations,
    isTranslated: true,
    translatedAt: new Date().toISOString(),
    tokenUsage: totalUsage
  }
}

/**
 * 批量翻译岗位列表
 */
async function translateJobs(jobs, force = false) {
  if (!jobs || jobs.length === 0) return []

  console.log(`🌍 开始处理 ${jobs.length} 个岗位的翻译任务 [Force: ${force}]`)
  const startTime = Date.now()

  const results = []
  // 使用全局并发配置
  const batchSize = TRANSLATE_CONCURRENCY

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(job => translateJob(job, force)))
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
  translateText,
  translateBatch,
  translateJob,
  translateJobs,
  configure
}
