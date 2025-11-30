/**
 * Job Summary Generation API
 * Generates concise 30-50 character summaries for job postings using AI
 * Endpoint: POST /api/generate-job-summary
 */

// Simple translation/AI service using free APIs
async function generateSummaryWithAI(title, description, responsibilities) {
    try {
        // Construct a concise prompt for summary generation
        const responsibilitiesText = Array.isArray(responsibilities) && responsibilities.length > 0
            ? responsibilities.slice(0, 3).join('; ')
            : '';

        const descriptionSnippet = description ? description.substring(0, 500) : '';

        const prompt = `请基于以下岗位信息生成一个30-50字的简洁总结，突出岗位核心要求和亮点：

岗位标题：${title}
岗位描述：${descriptionSnippet}
${responsibilitiesText ? `主要职责：${responsibilitiesText}` : ''}

要求：
1. 30-50字
2. 突出核心技能要求
3. 说明主要工作内容
4. 语言简洁专业
5. 只返回总结文本，不要其他内容`;

        // Try using a simple summarization approach first (fallback)
        // Extract key information from title and description
        const fallbackSummary = generateFallbackSummary(title, description, responsibilities);

        // In production, you would call Alibaba Bailian API here
        // For now, return the fallback summary
        return { success: true, summary: fallbackSummary };
    } catch (error) {
        console.error('[generate-job-summary] AI generation error:', error);
        return { success: false, summary: '' };
    }
}

// Fallback: Rule-based summary generation
function generateFallbackSummary(title, description, responsibilities) {
    try {
        // Extract key skills and requirements
        const skills = extractKeySkills(description);
        const experience = extractExperience(title, description);
        const mainDuty = extractMainDuty(title, responsibilities);

        // Construct summary
        let summary = '';

        if (mainDuty) {
            summary += mainDuty;
        }

        if (experience) {
            summary += (summary ? '，' : '') + experience;
        }

        if (skills.length > 0) {
            const skillsText = skills.slice(0, 3).join('、');
            summary += (summary ? '，' : '') + `需要${skillsText}等技能`;
        }

        // Ensure summary is within 30-50 characters
        if (summary.length > 50) {
            summary = summary.substring(0, 47) + '...';
        } else if (summary.length < 30 && description) {
            // If too short, add more context from description
            const descWords = description.substring(0, 100).replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ').trim();
            summary += (summary ? '，' : '') + descWords.substring(0, 50 - summary.length);
        }

        return summary || '负责相关工作职责，需要相关技能和经验';
    } catch (error) {
        console.error('[generate-job-summary] Fallback generation error:', error);
        return '负责相关工作职责，需要相关技能和经验';
    }
}

function extractKeySkills(description) {
    const skills = [];
    const commonSkills = [
        'Python', 'JavaScript', 'React', 'Node.js', 'Java', 'Go', 'Rust', 'TypeScript',
        'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'Redis',
        'Machine Learning', 'AI', 'Data Analysis', 'Product Management', 'Marketing',
        'Design', 'UI/UX', 'Figma', 'Sketch', 'Git', 'Agile', 'Scrum'
    ];

    const lowerDesc = description.toLowerCase();
    for (const skill of commonSkills) {
        if (lowerDesc.includes(skill.toLowerCase())) {
            skills.push(skill);
            if (skills.length >= 3) break;
        }
    }

    return skills;
}

function extractExperience(title, description) {
    // Extract experience level from title or description
    const seniorityMap = {
        'senior': '资深',
        'lead': '技术负责人',
        'principal': '首席',
        'staff': '高级',
        'mid': '中级',
        'junior': '初级',
        'entry': '入门'
    };

    const combined = (title + ' ' + description).toLowerCase();

    for (const [eng, chn] of Object.entries(seniorityMap)) {
        if (combined.includes(eng)) {
            return `${chn}级别`;
        }
    }

    // Check for years of experience
    const yearsMatch = description.match(/(\d+)\+?\s*(?:years?|年)/i);
    if (yearsMatch) {
        return `需要${yearsMatch[1]}年以上经验`;
    }

    return '';
}

function extractMainDuty(title, responsibilities) {
    // Try to extract main duty from title
    const roleMap = {
        'engineer': '工程师',
        'developer': '开发',
        'designer': '设计',
        'manager': '管理',
        'analyst': '分析',
        'marketer': '营销',
        'product': '产品',
        'data': '数据',
        'backend': '后端开发',
        'frontend': '前端开发',
        'fullstack': '全栈开发',
        'devops': '运维开发',
        'qa': '质量保证',
        'sales': '销售'
    };

    const lowerTitle = title.toLowerCase();

    for (const [eng, chn] of Object.entries(roleMap)) {
        if (lowerTitle.includes(eng)) {
            return `负责${chn}相关工作`;
        }
    }

    // Try to extract from first responsibility
    if (Array.isArray(responsibilities) && responsibilities.length > 0) {
        const firstResp = responsibilities[0];
        if (firstResp && firstResp.length > 0) {
            // Take first 20 characters
            return firstResp.substring(0, 20);
        }
    }

    return '';
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { title, description, responsibilities } = req.body || {};

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        console.log(`[generate-job-summary] Generating summary for: "${title.substring(0, 50)}..."`);

        const result = await generateSummaryWithAI(title, description || '', responsibilities || []);

        if (result.success) {
            console.log(`[generate-job-summary] Generated: "${result.summary}"`);
            return res.status(200).json({
                success: true,
                summary: result.summary
            });
        } else {
            console.warn(`[generate-job-summary] Failed to generate summary for "${title}"`);
            return res.status(500).json({
                success: false,
                error: 'Failed to generate summary'
            });
        }
    } catch (error) {
        console.error('[generate-job-summary] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Summary generation failed'
        });
    }
}
