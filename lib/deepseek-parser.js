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
        const content = data.choices?.[0]?.message?.content || null
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        
        return { content, usage }

    } catch (error) {
        console.error('[deepseek-parser] Error calling DeepSeek API:', error.message)
        return { content: null, usage: null }
    }
}

/**
 * Check if DeepSeek is available
 */
export function isDeepSeekAvailable() {
    return !!getDeepSeekApiKey()
}

/**
 * Extract Job Description from raw HTML/Text using AI
 * This is a fallback strategy when selectors fail
 */
export async function extractJobDescriptionFromHtml(rawContent) {
    if (!rawContent || rawContent.length < 100) {
        return null
    }

    // Truncate to avoid token limits (approx 15k chars should be enough for most JDs)
    const content = rawContent.substring(0, 15000)

    const systemPrompt = 'You are a smart crawler assistant. Your task is to extract the full Job Description from the provided HTML/text content. Return ONLY the description text. Do not include navigation menus, footers, or sidebars. Maintain the original formatting structure if possible (paragraphs, lists).'

    const prompt = `Extract the job description from this content:\n\n${content}`

    try {
        console.log('[deepseek-parser] Attempting AI extraction of JD from raw content...')
        const { content: result } = await callDeepSeekAPI(prompt, systemPrompt)
        
        if (result && result.length > 50) {
            console.log(`[deepseek-parser] AI extracted description length: ${result.length}`)
            return result
        }
        return null

    } catch (error) {
        console.error('[deepseek-parser] Error extracting JD from HTML:', error.message)
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
        const { content: result } = await callDeepSeekAPI(prompt, systemPrompt)
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
        const { content: result } = await callDeepSeekAPI(prompt, systemPrompt)
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
        const { content: result } = await callDeepSeekAPI(prompt, systemPrompt)
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
 * Comprehensive Job Analysis using AI
 * Extracts Location, Salary, Tags, Category and formats Job Description
 */
export async function analyzeJobContent(job) {
    const { title, description, location: existingLocation, salary: existingSalary } = job
    
    if (!description || description.length < 50) return null

    const systemPrompt = `You are an expert HR data analyst. Your task is to analyze job descriptions and extract structured data.
Output must be valid JSON only. No markdown, no explanations.

Fields to extract:
1. location: Specific city and country (e.g. "San Francisco, USA", "Beijing, China"). If remote, specify "Remote" or "Remote - [Region]".
2. salary: Standardized salary range (e.g. "$100k - $150k", "¥20k-40k/Month"). Keep original currency.
3. tags: Array of 5-10 keywords (Tech stack, skills, industry).
4. category: Best fit from standard categories (e.g. "前端开发", "后端开发", "产品经理").
5. formattedDescription: HTML formatted description. Use <h3> for section headers, <ul>/<li> for lists, <p> for paragraphs. Clean up layout.
6. language: "zh" or "en".

JSON Structure:
{
  "location": "string",
  "salary": "string",
  "tags": ["string"],
  "category": "string",
  "formattedDescription": "string",
  "language": "string"
}`

    const prompt = `Analyze this job:
Title: ${title}
Location (Current): ${existingLocation}
Salary (Current): ${existingSalary}
Description:
${description.substring(0, 8000)}`

    try {
        console.log(`[deepseek-parser] Analyzing job via AI: ${title}`)
        const { content: result, usage } = await callDeepSeekAPI(prompt, systemPrompt)
        
        if (!result) return null

        // Clean up markdown code blocks if present
        const cleanResult = result.replace(/```json\n?|\n?```/g, '').trim()
        
        try {
            const data = JSON.parse(cleanResult)
            // Validate essential fields
            if (data.location || data.salary || data.tags?.length > 0) {
                // Attach usage stats to the result
                if (usage) {
                    data.usage = {
                        input: usage.prompt_tokens,
                        output: usage.completion_tokens,
                        total: usage.total_tokens
                    }
                }
                return data
            }
        } catch (e) {
            console.error('[deepseek-parser] JSON parse error:', e)
        }
    } catch (error) {
        console.error('[deepseek-parser] Analysis error:', error)
    }
    return null
}

