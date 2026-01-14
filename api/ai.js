
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // === Action: Translate Jobs (Merged from translate-jobs.js) ===
    if (action === 'translate-jobs') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' })
        }

        // Get page and pageSize from request body
        const { page = 1, pageSize = 20 } = req.body || {}

        console.log(`[translate-jobs API] ========== 开始翻译 ==========`)
        console.log(`[translate-jobs API] 页码: ${page}, 每页: ${pageSize}`)

        try {
            console.log(`[translate-jobs API] Step 1: 读取所有岗位...`)
            const allJobs = await getAllJobs()
            console.log(`[translate-jobs API] ✅ 读取到 ${allJobs.length} 个岗位`)

            if (!allJobs || allJobs.length === 0) {
                console.log(`[translate-jobs API] ⚠️ 数据库中没有岗位`)
                return res.status(200).json({
                    success: true,
                    translated: 0,
                    skipped: 0,
                    failed: 0,
                    totalPages: 0,
                    message: 'No jobs found in database'
                })
            }

            // 手动分页
            const start = (page - 1) * pageSize
            const end = start + pageSize
            const jobs = allJobs.slice(start, end)
            const totalPages = Math.ceil(allJobs.length / pageSize)

            console.log(`[translate-jobs API] Step 2: 分页数据 - 第${page}/${totalPages}页, ${jobs.length}个岗位`)

            // 过滤未翻译的岗位
            const untranslated = jobs.filter(job => !job.isTranslated)
            const alreadyTranslated = jobs.length - untranslated.length

            console.log(`[translate-jobs API] Step 3: 过滤 - ${untranslated.length}个待翻译, ${alreadyTranslated}个已翻译`)

            if (untranslated.length === 0) {
                console.log(`[translate-jobs API] ✅ 本页所有岗位已翻译`)
                return res.status(200).json({
                    success: true,
                    translated: 0,
                    skipped: alreadyTranslated,
                    failed: 0,
                    totalPages,
                    message: 'All jobs on this page are already translated'
                })
            }

            // 翻译岗位
            console.log(`[translate-jobs API] Step 4: 开始翻译 ${untranslated.length} 个岗位...`)
            let translated = []
            try {
                translated = await translateJobs(untranslated)
                console.log(`[translate-jobs API] ✅ 翻译完成`)
            } catch (translationError) {
                console.error(`[translate-jobs API] ❌ 翻译失败:`, translationError)
                return res.status(500).json({
                    success: false,
                    error: 'Translation failed',
                    message: translationError.message,
                    details: translationError.stack
                })
            }

            // 统计结果
            const successCount = translated.filter(j => j.isTranslated).length
            const failCount = translated.length - successCount

            console.log(`[translate-jobs API] Step 5: 翻译结果 - 成功:${successCount}, 失败:${failCount}`)

            // 保存翻译结果
            if (successCount > 0) {
                const toSave = translated.filter(j => j.isTranslated)
                console.log(`[translate-jobs API] Step 6: 保存 ${toSave.length} 个翻译结果...`)

                try {
                    console.log(`[translate-jobs API] 使用 writeJobsToNeon 保存 (skipFilter=true)...`)
                    await writeJobsToNeon(toSave, 'upsert', true)
                    console.log(`[translate-jobs API] ✅ 保存成功`)
                } catch (saveError) {
                    console.error(`[translate-jobs API] ❌ 保存失败:`, saveError)
                    // 不中断，返回部分成功
                }
            }

            return res.status(200).json({
                success: true,
                translated: successCount,
                skipped: alreadyTranslated,
                failed: failCount,
                totalPages,
                message: `Translated ${successCount} jobs, failed ${failCount}, skipped ${alreadyTranslated}`
            })

        } catch (error) {
            console.error(`[translate-jobs API] ❌ 全局错误:`, error)
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error.message
            })
        }
    }

    // === Action: Translate Text (for ProxyTranslationService) ===
    if (action === 'translate') {
      const { text, targetLanguage = 'zh', sourceLanguage = 'auto' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY || process.env.ALIBABA_BAILIAN_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Translation Service Not Configured (Missing API Key)' });
      }

      const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      const targetLangName = targetLanguage === 'zh' || targetLanguage === 'zh-CN' ? 'Chinese' : targetLanguage;
      
      const requestBody = {
        model: 'qwen-plus',
        input: {
          messages: [
            { role: "system", content: `You are a professional translator. Translate the following text to ${targetLangName}. Keep technical terms (like React, Java, Python, API, etc.) in their original English form. Only output the translated text without explanations.` },
            { role: "user", content: text }
          ]
        },
        parameters: {
          temperature: 0.3
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Translation API Error:', data);
        return res.status(response.status).json({ 
          success: false, 
          error: data.message || data.code || 'Translation Provider Error',
          details: data
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          translatedText: data.output?.text || text,
          sourceLanguage,
          targetLanguage,
          confidence: 0.95,
          provider: 'Bailian'
        }
      });
    }

    // === Action: Analyze Resume ===
    if (action === 'analyze-resume') {
      const body = req.body;
      const { messages, model, provider = 'bailian', parameters } = body;

      let apiUrl = '';
      let apiKey = '';
      let requestBody = {};
      let headers = {
        'Content-Type': 'application/json',
      };

      if (provider === 'bailian') {
        apiKey = process.env.VITE_ALIBABA_BAILIAN_API_KEY;
        if (!apiKey) {
          throw new Error('Alibaba Bailian API Key not configured');
        }
        
        apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        headers['Authorization'] = `Bearer ${apiKey}`;
        
        requestBody = {
          model: model || 'qwen-plus',
          input: { messages },
          parameters: parameters || {}
        };
      } else {
        throw new Error('Invalid provider (Only Bailian is supported)');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('AI API Error:', data);
        return res.status(response.status).json({ 
          success: false, 
          error: data.message || data.code || 'Provider Error',
          details: data
        });
      }

      // Normalize response to Bailian format
      let normalizedData = data;

      return res.status(200).json({
        success: true,
        data: normalizedData
      });
    }

    // === Action: Generate Job Summary ===
    if (action === 'generate-job-summary') {
      const { title, description, responsibilities } = req.body;

      // Construct a concise prompt for summary generation
      const responsibilitiesText = Array.isArray(responsibilities) && responsibilities.length > 0
          ? responsibilities.slice(0, 3).join('; ')
          : '';

      const descriptionSnippet = description ? description.substring(0, 500) : '';

      // Fallback Summary Logic (ported from generate-job-summary.js)
      // Since we don't have the full AI logic active there, we keep the fallback behavior
      // but structured within this handler.
      
      const fallbackSummary = generateFallbackSummary(title, description, responsibilities);
      return res.status(200).json({ success: true, summary: fallbackSummary });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('AI Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
}

// Helper for Job Summary Fallback
function generateFallbackSummary(title, description, responsibilities) {
    try {
        const skills = extractKeySkills(description);
        const mainDuty = extractMainDuty(title, responsibilities);
        
        let summary = `招聘${title}`;
        if (mainDuty) summary += `，负责${mainDuty}`;
        if (skills.length > 0) summary += `。要求熟悉${skills.slice(0, 3).join('、')}`;
        
        return summary.length > 50 ? summary.substring(0, 48) + '...' : summary;
    } catch (e) {
        return `${title} - 查看详情了解更多`;
    }
}

function extractKeySkills(text) {
    if (!text) return [];
    const commonSkills = ['React', 'Vue', 'Node.js', 'Python', 'Java', 'Go', 'SQL', 'AWS', 'Docker', 'Kubernetes'];
    return commonSkills.filter(skill => text.toLowerCase().includes(skill.toLowerCase()));
}

function extractMainDuty(title, responsibilities) {
    if (Array.isArray(responsibilities) && responsibilities.length > 0) {
        return responsibilities[0].substring(0, 15);
    }
    return '';
}
