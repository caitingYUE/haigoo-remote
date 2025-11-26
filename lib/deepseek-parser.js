/**
 * DeepSeek AI Parser
 * Uses DeepSeek API to enhance job descriptions and extract structured data
 */

/**
 * Get DeepSeek API key from environment
 */
function getDeepSeekApiKey() {
    // Try multiple environment variable names
    const variants = [
        'DEEPSEEK_API_KEY',
        'deepseek_api_key',
        'HAIGOO_DEEPSEEK_API_KEY',
        'haigoo_deepseek_api_key',
        'PRE_DEEPSEEK_API_KEY',
        'pre_deepseek_api_key'
    ]

    for (const key of variants) {
        if (process.env[key]) {
            return process.env[key]
        }
    }

    return null
}

/**
 * Call DeepSeek API to extract structured job information
 */
async function callDeepSeekAPI(prompt, systemPrompt = '') {
    const apiKey = getDeepSeekApiKey()

    if (!apiKey) {
        console.warn('[deepseek-parser] DeepSeek API key not found in environment variables')
        return null
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[deepseek-parser] API error:', response.status, error)
            return null
        }

        const data = await response.json()
        return data.choices?.[0]?.message?.content || null

    } catch (error) {
        console.error('[deepseek-parser] Error calling DeepSeek API:', error.message)
        return null
    }
}

/**
 * Extract requirements from job description using AI
 */
export async function extractRequirements(description) {
    if (!description || description.length < 50) {
        return []
    }

    const systemPrompt = 'You are a job description parser. Extract key requirements from job descriptions and return them as a JSON array of strings. Focus on skills, experience, and qualifications.'

    const prompt = `Extract the key requirements from this job description. Return ONLY a JSON array of strings, no other text:\n\n${description}`

    try {
        const result = await callDeepSeekAPI(prompt, systemPrompt)
        if (!result) return []

        // Try to parse JSON response
        const jsonMatch = result.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            const requirements = JSON.parse(jsonMatch[0])
            return Array.isArray(requirements) ? requirements.slice(0, 10) : []
        }

        // Fallback: split by newlines and clean
        return result
            .split('\n')
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 10 && line.length < 200)
            .slice(0, 10)

    } catch (error) {
        console.error('[deepseek-parser] Error extracting requirements:', error.message)
        return []
    }
}

/**
 * Extract benefits from job description using AI
 */
export async function extractBenefits(description) {
    if (!description || description.length < 50) {
        return []
    }

    const systemPrompt = 'You are a job description parser. Extract benefits and perks from job descriptions and return them as a JSON array of strings.'

    const prompt = `Extract the benefits and perks from this job description. Return ONLY a JSON array of strings, no other text:\n\n${description}`

    try {
        const result = await callDeepSeekAPI(prompt, systemPrompt)
        if (!result) return []

        // Try to parse JSON response
        const jsonMatch = result.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            const benefits = JSON.parse(jsonMatch[0])
            return Array.isArray(benefits) ? benefits.slice(0, 10) : []
        }

        // Fallback: split by newlines and clean
        return result
            .split('\n')
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 5 && line.length < 200)
            .slice(0, 10)

    } catch (error) {
        console.error('[deepseek-parser] Error extracting benefits:', error.message)
        return []
    }
}

/**
 * Enhance job description with AI-extracted structured data
 */
export async function enhanceJobDescription(job) {
    if (!job.description || job.description.length < 100) {
        console.log('[deepseek-parser] Job description too short, skipping AI enhancement')
        return job
    }

    console.log(`[deepseek-parser] Enhancing job: ${job.title}`)

    try {
        // Extract requirements and benefits in parallel
        const [requirements, benefits] = await Promise.all([
            extractRequirements(job.description),
            extractBenefits(job.description)
        ])

        // Only update if we got meaningful results
        if (requirements.length > 0) {
            job.requirements = requirements
            console.log(`[deepseek-parser] Extracted ${requirements.length} requirements`)
        }

        if (benefits.length > 0) {
            job.benefits = benefits
            console.log(`[deepseek-parser] Extracted ${benefits.length} benefits`)
        }

        return job

    } catch (error) {
        console.error('[deepseek-parser] Error enhancing job description:', error.message)
        return job
    }
}

/**
 * Categorize job using AI
 */
export async function categorizeJobWithAI(title, description) {
    const systemPrompt = `You are a job categorization expert. Categorize jobs into one of these categories:
全栈开发, 前端开发, 后端开发, 移动开发, 软件开发, DevOps, 数据分析, 数据科学, 人工智能, 质量保证, 网络安全,
UI/UX设计, 平面设计, 产品设计, 产品管理, 项目管理, 商业分析, 市场营销, 销售, 内容写作, 客户支持,
人力资源, 招聘, 财务, 法律, 会计, 运营, 商务拓展, 咨询, 教育培训, 其他

Return ONLY the category name, nothing else.`

    const prompt = `Categorize this job:\nTitle: ${title}\nDescription: ${description.substring(0, 500)}`

    try {
        const result = await callDeepSeekAPI(prompt, systemPrompt)
        if (result) {
            const category = result.trim()
            console.log(`[deepseek-parser] AI categorized as: ${category}`)
            return category
        }
    } catch (error) {
        console.error('[deepseek-parser] Error categorizing job:', error.message)
    }

    return null
}

/**
 * Check if DeepSeek API is available
 */
export function isDeepSeekAvailable() {
    return !!getDeepSeekApiKey()
}
