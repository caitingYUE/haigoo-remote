/**
 * AI Parser (Bailian / Aliyun Model Studio)
 * Uses Aliyun Bailian API to enhance job descriptions and extract structured data
 */

import { systemSettingsService } from './services/system-settings-service.js';

/**
 * Get AI Provider Configuration
 * ONLY supports Aliyun Bailian
 */
function getAiProviderConfig() {
    // Check Bailian Keys
    const bailianKey = 
        process.env.VITE_ALIBABA_BAILIAN_API_KEY || 
        process.env.ALIBABA_BAILIAN_API_KEY ||
        process.env.BAILIAN_API_KEY;

    if (bailianKey) {
        return {
            provider: 'Bailian',
            apiKey: bailianKey,
            // Use OpenAI-compatible endpoint for easier integration
            // https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            model: 'qwen-plus' 
        };
    }

    return null;
}

/**
 * Call AI API to extract structured job information
 */
async function callBailianAPI(prompt, systemPrompt = '') {
    const config = getAiProviderConfig();

    if (!config) {
        console.warn('[ai-parser] No Bailian API key found in environment variables');
        return null;
    }

    try {
        console.log(`[ai-parser] Using provider: ${config.provider} (${config.model})`);
        
        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[ai-parser] ${config.provider} API error:`, response.status, error);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || null;
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        
        // Track usage centrally
        if (usage.total_tokens > 0) {
            // Convert to format expected by systemSettingsService
            const usageStats = {
                input: usage.prompt_tokens,
                output: usage.completion_tokens,
                total: usage.total_tokens
            };
            // Fire and forget (don't block response)
            systemSettingsService.incrementTokenUsage(usageStats, 'job_processing').catch(err => {
                console.error('[ai-parser] Failed to track token usage:', err);
            });
        }

        return { content, usage };

    } catch (error) {
        console.error(`[ai-parser] Error calling ${config.provider} API:`, error.message);
        return { content: null, usage: null };
    }
}

/**
 * Check if AI is available
 */
export function isAiAvailable() {
    return !!getAiProviderConfig();
}

/**
 * Extract Job Description from raw HTML/Text using AI
 * This is a fallback strategy when selectors fail
 */
export async function extractJobDescriptionFromHtml(rawContent) {
    if (!rawContent || rawContent.length < 100) {
        return null;
    }

    // Truncate to avoid token limits (approx 15k chars should be enough for most JDs)
    const content = rawContent.substring(0, 15000);

    const systemPrompt = 'You are a smart crawler assistant. Your task is to extract the full Job Description from the provided HTML/text content. Return ONLY the description text. Do not include navigation menus, footers, or sidebars. Maintain the original formatting structure if possible (paragraphs, lists). If the content does not contain a job description (e.g. it is a login page, captcha, or search result page), return exactly "NO_JOB_DESCRIPTION".';

    const prompt = `Extract the job description from this content:\n\n${content}`;

    try {
        console.log('[ai-parser] Attempting AI extraction of JD from raw content...');
        const { content: result } = await callBailianAPI(prompt, systemPrompt);
        
        if (result && result.length > 50 && !result.includes('NO_JOB_DESCRIPTION')) {
            console.log(`[ai-parser] AI extracted description length: ${result.length}`);
            return result;
        }
        return null;

    } catch (error) {
        console.error('[ai-parser] Error extracting JD from HTML:', error.message);
        return null;
    }
}
/**
 * Extract requirements from job description using AI
 */
export async function extractRequirements(description) {
    if (!description || description.length < 50) {
        return [];
    }

    const systemPrompt = 'You are a job description parser. Extract key requirements from job descriptions and return them as a JSON array of strings. Focus on skills, experience, and qualifications.';

    const prompt = `Extract the key requirements from this job description. Return ONLY a JSON array of strings, no other text:\n\n${description}`;

    try {
        const { content: result } = await callBailianAPI(prompt, systemPrompt);
        if (!result) return [];

        // Try to parse JSON response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const requirements = JSON.parse(jsonMatch[0]);
            return Array.isArray(requirements) ? requirements.slice(0, 10) : [];
        }

        // Fallback: split by newlines and clean
        return result
            .split('\n')
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 10 && line.length < 200)
            .slice(0, 10);

    } catch (error) {
        console.error('[ai-parser] Error extracting requirements:', error.message);
        return [];
    }
}

/**
 * Extract benefits from job description using AI
 */
export async function extractBenefits(description) {
    if (!description || description.length < 50) {
        return [];
    }

    const systemPrompt = 'You are a job description parser. Extract benefits and perks from job descriptions and return them as a JSON array of strings.';

    const prompt = `Extract the benefits and perks from this job description. Return ONLY a JSON array of strings, no other text:\n\n${description}`;

    try {
        const { content: result } = await callBailianAPI(prompt, systemPrompt);
        if (!result) return [];

        // Try to parse JSON response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const benefits = JSON.parse(jsonMatch[0]);
            return Array.isArray(benefits) ? benefits.slice(0, 10) : [];
        }

        // Fallback: split by newlines and clean
        return result
            .split('\n')
            .map(line => line.replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 5 && line.length < 200)
            .slice(0, 10);

    } catch (error) {
        console.error('[ai-parser] Error extracting benefits:', error.message);
        return [];
    }
}

/**
 * Enhance job description with AI-extracted structured data
 */
export async function enhanceJobDescription(job) {
    if (!job.description || job.description.length < 100) {
        console.log('[ai-parser] Job description too short, skipping AI enhancement');
        return job;
    }

    console.log(`[ai-parser] Enhancing job: ${job.title}`);

    try {
        // Extract requirements and benefits in parallel
        const [requirements, benefits] = await Promise.all([
            extractRequirements(job.description),
            extractBenefits(job.description)
        ]);

        // Only update if we got meaningful results
        if (requirements.length > 0) {
            job.requirements = requirements;
            console.log(`[ai-parser] Extracted ${requirements.length} requirements`);
        }

        if (benefits.length > 0) {
            job.benefits = benefits;
            console.log(`[ai-parser] Extracted ${benefits.length} benefits`);
        }

        return job;

    } catch (error) {
        console.error('[ai-parser] Error enhancing job description:', error.message);
        return job;
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

Return ONLY the category name, nothing else.`;

    const prompt = `Categorize this job:\nTitle: ${title}\nDescription: ${description.substring(0, 500)}`;

    try {
        const { content: result } = await callBailianAPI(prompt, systemPrompt);
        if (result) {
            const category = result.trim();
            console.log(`[ai-parser] AI categorized as: ${category}`);
            return category;
        }
    } catch (error) {
        console.error('[ai-parser] Error categorizing job:', error.message);
    }

    return null;
}

/**
 * Comprehensive Job Analysis using AI
 * Extracts Location, Salary, Tags, Category and formats Job Description
 */
export async function analyzeJobContent(job) {
    const { title, description, location: existingLocation, salary: existingSalary } = job;
    
    if (!description || description.length < 50) return null;

    const systemPrompt = `You are an expert HR data analyst. Your task is to analyze job descriptions and extract structured data.
Output must be valid JSON only. No markdown, no explanations.

Fields to extract:
1. location: Specific city, country, and timezone (e.g. "San Francisco, USA (GMT-8)"). 
   - CRITICAL: If the job is remote, MUST specify "Remote" or "Remote - [Region]".
   - If location is missing in text, infer from company HQ or context if possible, otherwise return "Unspecified".
   - Handle Chinese location names (e.g. "上海", "远程", "美国").
2. salary: Standardized salary range (e.g. "$100k - $150k", "€30k-€50k", "¥20k-40k/Month"). 
   - Extract from 'Compensation', 'Pay', 'Salary' sections. 
   - IMPORTANT: Handle Chinese salary descriptions like "每月3000至4000美元" -> "$3000-$4000/Month", "15k-25k" -> "¥15k-25k/Month" (infer currency if implied).
   - If salary is "Open" or "Competitive" or missing, try to estimate based on job level/location if high confidence, otherwise "Open".
   - NEVER return "0", "0k", "$0" or empty string. If unknown, return "Open".
   - If the text says "Competitive salary" but gives no numbers, return "Open".
3. tags: Array of 5-10 keywords (Tech stack, skills, industry, tools).
4. category: Best fit from standard categories (e.g. "前端开发", "后端开发", "产品经理", "全栈开发", "数据分析", "AI/ML").
5. timezone: Extract timezone requirements (e.g. "GMT-5", "PST", "Asia/Shanghai", "EST to PST").
   - If multiple timezones are mentioned, list them (e.g. "EST/PST").
   - If global/anywhere, return "Anywhere".
   - If specific overlap hours required, mention them (e.g. "4 hours overlap with GMT+1").
6. chinaFriendly: Boolean (true/false).
   - Return true ONLY if:
     - Job explicitly mentions "China", "Asia", "APAC", "UTC+8".
     - Job explicitly states "Remote from Anywhere", "Work from Anywhere", "Global Remote" (and NOT just "we are a global company").
     - Timezone is explicitly GMT+8 or friendly to it (e.g. "Asynchronous", "Overlap with Europe").
   - Return false if:
     - Location is a specific city/country outside China (e.g. "South San Francisco", "New York", "London", "US", "UK") unless "Remote from Anywhere" is also stated.
     - Job requires "US Only", "North America Only", "EU Only", "Latin America Only".
     - Timezone is strictly US/Americas (e.g. "PST", "EST", "GMT-5", "GMT-8", "UTC-5") without explicit flexibility.
     - Timezone range is strictly Western Hemisphere (e.g. "GMT-5 to GMT-3", "UTC-8 to UTC-5").
     - Job requires working hours that overlap significantly with US business hours (e.g. "9am-5pm PST", "Overlap with EST").
7. formattedDescription: HTML formatted description. Use <h3> for section headers, <ul>/<li> for lists, <p> for paragraphs. Clean up layout. 
   - CRITICAL: Do NOT translate technical terms (e.g. React, Python, AWS, CI/CD, Django, Node.js) - keep them in English.
   - If the original description is in Chinese, keep it in Chinese but format it nicely.
8. language: "zh" or "en".

JSON Structure:
{
  "location": "string",
  "salary": "string",
  "tags": ["string"],
  "category": "string",
  "timezone": "string",
  "chinaFriendly": boolean,
  "formattedDescription": "string",
  "language": "string"
}`;

    const prompt = `Analyze this job:
Title: ${title}
Location (Current): ${existingLocation}
Salary (Current): ${existingSalary}
Description:
${description.substring(0, 8000)}`;

    try {
        console.log(`[ai-parser] Analyzing job via AI: ${title}`);
        const response = await callBailianAPI(prompt, systemPrompt);
        
        if (!response || !response.content) return null;
        
        const { content: result, usage } = response;

        // Clean up markdown code blocks if present
        const cleanResult = result.replace(/```json\n?|\n?```/g, '').trim();
        
        try {
            const data = JSON.parse(cleanResult);
            // Validate essential fields
            if (data.location || data.salary || data.tags?.length > 0) {
                // Attach usage stats to the result
                data.usage = usage;
                return data;
            }
        } catch (e) {
            console.error('[ai-parser] Failed to parse AI JSON response:', e);
            console.error('Raw result:', cleanResult);
        }

    } catch (error) {
        console.error('[ai-parser] Error analyzing job:', error.message);
    }

    return null;
}
