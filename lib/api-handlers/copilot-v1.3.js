/**
 * Copilot V1.3 Module Handlers
 * 
 * Implements the modular, state-driven Copilot:
 *   - get-state:        Read user's full Copilot state
 *   - extract-resume:   Structured resume extraction via AI
 *   - assess:           Remote readiness assessment (M1)
 *   - match-jobs:       Local algorithm job matching (M2, zero AI cost)
 *   - create-plan:      Generate phased action plan (M3)
 *   - update-progress:  Update task status + incremental AI suggestion (M3)
 */

import neonHelper from '../../server-utils/dal/neon-helper.js';
import { getResumes } from '../../server-utils/resume-storage.js';

// ─── Shared: Call Bailian with specific model ────────────────────────────────

async function callModel(prompt, systemPrompt, model = 'qwen-plus', maxTokens = 1500) {
    const apiKey =
        process.env.VITE_ALIBABA_BAILIAN_API_KEY ||
        process.env.ALIBABA_BAILIAN_API_KEY ||
        process.env.BAILIAN_API_KEY;

    if (!apiKey) {
        console.warn('[Copilot V1.3] No Bailian API key');
        return null;
    }

    const baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    for (let attempt = 0; attempt <= 2; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1200 * attempt));
        try {
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.3,
                    max_tokens: maxTokens,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
                console.error('[Copilot V1.3] API error:', response.status, err);
                return null;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || null;
            const usage = data.usage || {};
            console.log(`[Copilot V1.3] Tokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, model: ${model}`);
            return content;
        } catch (err) {
            console.error(`[Copilot V1.3] Attempt ${attempt} failed:`, err.message);
        }
    }
    return null;
}

// Parse JSON from AI response (strips markdown code blocks etc.)
function parseAIJSON(raw) {
    if (!raw) return null;
    let clean = raw;
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        clean = clean.substring(jsonStart, jsonEnd + 1);
    } else {
        clean = clean.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    }
    return JSON.parse(clean);
}

// ─── Shared: System Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT_JSON = `你是一名专业的远程职业规划顾问和招聘专家。
请严格按照指定JSON格式输出。
不要输出解释说明。
不要输出多余文字。
不要添加代码块标记。
确保JSON可被直接解析。`;

const POSITION_TYPE_KEYWORDS = {
    'full-time': ['full-time', 'full time', 'permanent', '长期', '全职'],
    'contract': ['contract', 'part-time', '兼职', '合同', 'contractor'],
    'freelance': ['freelance', 'consultant', 'consulting', '自由职业', '顾问'],
    'internship': ['intern', 'internship', '实习'],
};

const HERO_MATCH_WEIGHTS = {
    direction: 0.35,      // 用户职业方向（最高权重之一）
    positionType: 0.30,   // 岗位类型（接近筛选项）
    skillTags: 0.20,      // 后台人工技能标签
    resumeSemantic: 0.12, // 简历语义向量相似度
    freshness: 0.03,      // 新鲜度微调
};

const POSITION_TYPE_COMPATIBILITY = {
    'full-time': { 'full-time': 1, contract: 0.45, freelance: 0.4, internship: 0.35 },
    contract: { contract: 1, freelance: 0.78, 'full-time': 0.25, internship: 0.3 },
    freelance: { freelance: 1, contract: 0.78, 'full-time': 0.3, internship: 0.25 },
    internship: { internship: 1, 'full-time': 0.35, contract: 0.2, freelance: 0.2 },
};

function normalizeTerms(values = []) {
    return Array.from(new Set(
        values
            .flatMap(value => {
                if (Array.isArray(value)) return value;
                if (typeof value !== 'string') return [];
                return [value, ...value.split(/[\/,，、|\s]+/g)];
            })
            .map(value => String(value || '').trim().toLowerCase())
            .filter(value => value.length >= 2)
    ));
}

function parseStringArray(value) {
    if (Array.isArray(value)) return value.map(v => String(v || ''));
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(v => String(v || ''));
        } catch (_) {
            return value.split(/[,\n，、|/]+/g).map(v => String(v || ''));
        }
    }
    return [];
}

function normalizePositionType(input = '') {
    const text = String(input || '').toLowerCase();
    if (!text) return '';
    if (/(intern|internship|实习)/i.test(text)) return 'internship';
    if (/(freelance|consultant|consulting|自由职业|顾问)/i.test(text)) return 'freelance';
    if (/(contract|part-time|part time|兼职|合同|contractor)/i.test(text)) return 'contract';
    if (/(full-time|full time|permanent|长期|全职)/i.test(text)) return 'full-time';
    return '';
}

function computeTypeScore(targetType, job) {
    const normalizedTarget = normalizePositionType(targetType) || 'full-time';
    const normalizedJob = normalizePositionType(`${job.job_type || ''} ${job.title || ''} ${job.description || ''}`);
    if (!normalizedJob) return 0.55;
    return POSITION_TYPE_COMPATIBILITY[normalizedTarget]?.[normalizedJob] ?? 0.35;
}

function computeDirectionScore(directionTerms, manualDirection, job) {
    const titleCategory = `${job.title || ''} ${job.category || ''}`.toLowerCase();
    const description = `${job.description || ''}`.toLowerCase();
    const fullText = `${titleCategory} ${description}`;
    const directionPhrase = String(manualDirection || '').trim().toLowerCase();

    let phraseBoost = 0;
    if (directionPhrase.length >= 2) {
        if (titleCategory.includes(directionPhrase)) phraseBoost = 0.45;
        else if (fullText.includes(directionPhrase)) phraseBoost = 0.22;
    }

    if (directionTerms.length === 0) return Math.min(1, 0.45 + phraseBoost);

    const titleHits = directionTerms.filter(term => titleCategory.includes(term)).length / directionTerms.length;
    const descHits = directionTerms.filter(term => description.includes(term)).length / directionTerms.length;
    const base = titleHits * 0.74 + descHits * 0.26;
    return Math.min(1, base + phraseBoost);
}

function computeSkillTagScore(skillTerms, jobTags, jobText) {
    if (skillTerms.length === 0) return 0.45;

    const normalizedTags = normalizeTerms([jobTags]).slice(0, 24);
    const normalizedText = String(jobText || '').toLowerCase();

    if (normalizedTags.length === 0) {
        const textHits = skillTerms.filter(term => normalizedText.includes(term)).length / skillTerms.length;
        return textHits * 0.65;
    }

    const matched = new Set();
    for (const term of skillTerms) {
        const hit = normalizedTags.some(tag => tag.includes(term) || term.includes(tag));
        if (hit) matched.add(term);
    }
    const tagCoverage = matched.size / Math.min(skillTerms.length, 12);
    const textAssist = skillTerms.filter(term => normalizedText.includes(term)).length / skillTerms.length;
    return Math.min(1, tagCoverage * 0.88 + textAssist * 0.12);
}

function tokenizeForVector(text = '') {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5\+\#\.\-]/g, ' ')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length >= 2);
}

function buildTermFreq(tokens = []) {
    const tf = new Map();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    return tf;
}

function buildIdf(docTFs = []) {
    const df = new Map();
    const docCount = Math.max(1, docTFs.length);
    for (const tf of docTFs) {
        const seen = new Set(tf.keys());
        for (const term of seen) {
            df.set(term, (df.get(term) || 0) + 1);
        }
    }
    const idf = new Map();
    for (const [term, count] of df.entries()) {
        idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
    }
    return idf;
}

function toTfidf(tf = new Map(), idf = new Map()) {
    const vector = new Map();
    let norm = 0;
    for (const [term, count] of tf.entries()) {
        const weight = count * (idf.get(term) || 1);
        vector.set(term, weight);
        norm += weight * weight;
    }
    return { vector, norm: Math.sqrt(norm) };
}

function cosineSimilaritySparse(a, b) {
    if (!a || !b || a.norm === 0 || b.norm === 0) return 0;
    let dot = 0;
    const small = a.vector.size <= b.vector.size ? a.vector : b.vector;
    const large = a.vector.size <= b.vector.size ? b.vector : a.vector;
    for (const [term, weight] of small.entries()) {
        const other = large.get(term);
        if (other) dot += weight * other;
    }
    return dot / (a.norm * b.norm);
}

function extractResumeHints(resume) {
    const parsed = resume?.parseResult || {};
    return normalizeTerms([
        parsed.title,
        parsed.targetRole,
        parsed.target_role,
        parsed.industry,
        parsed.industries,
        parsed.skills,
        parsed.tools,
        parsed.technologies,
        parsed.keywords,
        parsed.roles,
    ]).slice(0, 12);
}

async function fetchResumeHints(userId, resumeId) {
    if (!userId || !resumeId) return [];
    try {
        const { resumes } = await getResumes(userId);
        const resume = resumes.find(item => item.id === resumeId);
        return resume ? extractResumeHints(resume) : [];
    } catch (e) {
        console.warn('[Copilot V1.3] Failed to fetch hero resume hints:', e.message);
        return [];
    }
}

let jobsColumnsCache = null;
async function getJobsColumns() {
    if (jobsColumnsCache !== null) return jobsColumnsCache;
    try {
        const rows = await neonHelper.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_name = 'jobs'`
        );
        jobsColumnsCache = new Set((rows || []).map((row) => row.column_name));
    } catch {
        jobsColumnsCache = new Set([
            'job_id', 'title', 'company', 'category', 'location', 'job_type',
            'experience_level', 'salary', 'description', 'published_at',
            'status', 'is_approved'
        ]);
    }
    return jobsColumnsCache;
}

async function insertCopilotSessionWithFallback({ userId, goal, timeline, background = {}, planData, module }) {
    try {
        await neonHelper.query(
            `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial, module)
             VALUES ($1, $2, $3, $4, $5, false, $6)`,
            [userId, goal, timeline, JSON.stringify(background || {}), JSON.stringify(planData), module]
        );
        return true;
    } catch (e1) {
        try {
            await neonHelper.query(
                `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial)
                 VALUES ($1, $2, $3, $4, $5, false)`,
                [userId, goal, timeline, JSON.stringify(background || {}), JSON.stringify(planData)]
            );
            return true;
        } catch (e2) {
            console.warn(`[Copilot V1.3] session log skipped (${module}):`, e2.message || e1.message);
            return false;
        }
    }
}

async function findMatchingJobs({ structured = null, manualDirection = '', positionType = 'full-time', resumeHints = [], limit = 20 }) {
    const directionTerms = normalizeTerms([manualDirection]);
    const typeTerms = normalizeTerms(POSITION_TYPE_KEYWORDS[positionType] || []);
    const profileTerms = normalizeTerms([
        directionTerms,
        typeTerms,
        structured?.roles,
        structured?.industries,
        structured?.skills,
        structured?.tools,
    ]);
    const resumeVectorTerms = normalizeTerms([
        resumeHints,
        structured?.skills,
        structured?.tools,
        structured?.roles,
        structured?.achievements_with_metrics,
    ]).slice(0, 48);

    const searchTerms = profileTerms.slice(0, 14);
    const likeTerms = (searchTerms.length > 0 ? searchTerms : typeTerms).map(term => `%${term}%`);
    const jobsColumns = await getJobsColumns();
    const tagsAvailable = jobsColumns.has('tags');
    const titleExpr = jobsColumns.has('title')
        ? "COALESCE(title, '')"
        : (jobsColumns.has('job_title') ? "COALESCE(job_title, '')" : "''");
    const categoryExpr = jobsColumns.has('category') ? "COALESCE(category, '')" : "''";
    const descriptionExpr = jobsColumns.has('description') ? "COALESCE(description, '')" : "''";
    const jobTypeExpr = jobsColumns.has('job_type')
        ? "COALESCE(job_type, '')"
        : (jobsColumns.has('type') ? "COALESCE(type, '')" : "''");
    const statusFilter = jobsColumns.has('status') ? `status = 'active'` : `TRUE`;
    const approvedFilter = jobsColumns.has('is_approved') ? `AND COALESCE(is_approved, true) = true` : '';
    const publishedOrderColumn = jobsColumns.has('published_at')
        ? 'published_at'
        : (jobsColumns.has('created_at') ? 'created_at' : (jobsColumns.has('job_id') ? 'job_id' : 'id'));

    const selectColumns = [
        jobsColumns.has('job_id') ? 'job_id' : (jobsColumns.has('id') ? 'id AS job_id' : 'ROW_NUMBER() OVER () AS job_id'),
        jobsColumns.has('title')
            ? 'title'
            : (jobsColumns.has('job_title') ? "COALESCE(job_title, '') AS title" : "''::text AS title"),
        jobsColumns.has('company') ? 'company' : (jobsColumns.has('company_name') ? 'company_name AS company' : "''::text AS company"),
        jobsColumns.has('category') ? 'category' : 'NULL::text AS category',
        jobsColumns.has('location') ? 'location' : 'NULL::text AS location',
        jobsColumns.has('job_type') ? 'job_type' : (jobsColumns.has('type') ? 'type AS job_type' : 'NULL::text AS job_type'),
        jobsColumns.has('experience_level') ? 'experience_level' : 'NULL::text AS experience_level',
        jobsColumns.has('salary') ? 'salary' : (jobsColumns.has('salary_range') ? 'salary_range AS salary' : 'NULL::text AS salary'),
        jobsColumns.has('description') ? 'description' : 'NULL::text AS description',
        jobsColumns.has('published_at') ? 'published_at' : (jobsColumns.has('created_at') ? 'created_at AS published_at' : 'NOW() AS published_at'),
        jobsColumns.has('logo') ? 'logo' : (jobsColumns.has('company_logo') ? 'company_logo AS logo' : 'NULL::text AS logo'),
        jobsColumns.has('company_website')
            ? 'company_website'
            : (jobsColumns.has('company_url')
                ? 'company_url AS company_website'
                : (jobsColumns.has('website') ? 'website AS company_website' : 'NULL::text AS company_website')),
        ...(tagsAvailable ? ['tags'] : [])
    ];

    const conditions = likeTerms.length > 0
        ? likeTerms.map((_, i) => {
            const base = `(LOWER(${titleExpr}) LIKE $${i + 1} OR LOWER(${categoryExpr}) LIKE $${i + 1} OR LOWER(${descriptionExpr}) LIKE $${i + 1} OR LOWER(${jobTypeExpr}) LIKE $${i + 1}`;
            return tagsAvailable
                ? `${base} OR LOWER(COALESCE(tags::text, '')) LIKE $${i + 1})`
                : `${base})`;
        }).join(' OR ')
        : `TRUE`;

    let rows = [];
    try {
        rows = await neonHelper.query(
            `SELECT ${selectColumns.join(', ')}
             FROM jobs
             WHERE ${statusFilter} ${approvedFilter} AND (${conditions})
             ORDER BY ${publishedOrderColumn} DESC LIMIT 120`,
            likeTerms
        ) || [];
    } catch (e) {
        console.warn('[Copilot V1.3] matching query error:', e.message);
    }

    if (rows.length === 0) {
        try {
            rows = await neonHelper.query(
                `SELECT ${selectColumns.join(', ')}
                 FROM jobs
                 WHERE ${statusFilter} ${approvedFilter}
                 ORDER BY ${publishedOrderColumn} DESC LIMIT 80`
            ) || [];
        } catch (e) {
            console.warn('[Copilot V1.3] fallback matching query error:', e.message);
            rows = [];
        }
    }

    const skillTerms = normalizeTerms([structured?.skills, structured?.tools, resumeHints]).slice(0, 16);

    const vectorDocs = rows.map(job => {
        const jobTags = tagsAvailable ? parseStringArray(job.tags) : [];
        const vectorText = [
            job.title,
            job.category,
            job.job_type,
            ...jobTags,
            (job.description || '').substring(0, 900),
        ].filter(Boolean).join(' ');
        return {
            jobId: job.job_id,
            tf: buildTermFreq(tokenizeForVector(vectorText)),
        };
    });
    const idf = buildIdf(vectorDocs.map(doc => doc.tf));
    const queryVector = toTfidf(buildTermFreq(tokenizeForVector(resumeVectorTerms.join(' '))), idf);
    const vectorLookup = new Map(vectorDocs.map(doc => [doc.jobId, toTfidf(doc.tf, idf)]));

    const scored = rows.map(job => {
        const jobText = `${job.title || ''} ${job.category || ''} ${job.job_type || ''} ${(job.description || '').substring(0, 900)}`.toLowerCase();
        const directionScore = computeDirectionScore(directionTerms, manualDirection, job);
        const typeScore = computeTypeScore(positionType, job);
        const skillTagScore = computeSkillTagScore(skillTerms, tagsAvailable ? parseStringArray(job.tags) : [], jobText);
        const resumeSemanticScore = resumeVectorTerms.length > 0
            ? cosineSimilaritySparse(queryVector, vectorLookup.get(job.job_id))
            : 0;
        const freshnessDays = job.published_at ? Math.max(0, (Date.now() - new Date(job.published_at).getTime()) / (1000 * 60 * 60 * 24)) : 30;
        const freshnessScore = freshnessDays <= 3 ? 1 : freshnessDays <= 7 ? 0.8 : freshnessDays <= 14 ? 0.6 : 0.35;

        let score =
            directionScore * HERO_MATCH_WEIGHTS.direction +
            typeScore * HERO_MATCH_WEIGHTS.positionType +
            skillTagScore * HERO_MATCH_WEIGHTS.skillTags +
            resumeSemanticScore * HERO_MATCH_WEIGHTS.resumeSemantic +
            freshnessScore * HERO_MATCH_WEIGHTS.freshness;

        // 岗位类型作为近似筛选项：明显不匹配时，整体降权（不完全过滤）
        if (typeScore < 0.4) score *= 0.65;

        return {
            job,
            score,
            signals: {
                direction: Math.round(directionScore * 100),
                positionType: Math.round(typeScore * 100),
                skillTags: Math.round(skillTagScore * 100),
                resumeSemantic: Math.round(resumeSemanticScore * 100),
                freshness: Math.round(freshnessScore * 100),
            }
        };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ job, score, signals }) => ({
        jobId: job.job_id,
        title: job.title,
        company: job.company,
        company_name: job.company,
        category: job.category,
        location: job.location || 'Remote',
        jobType: job.job_type,
        experienceLevel: job.experience_level,
        salary: job.salary || 'Competitive',
        description: job.description || '',
        companyIntro: job.category ? `${job.company} 当前开放 ${job.category} 方向岗位，适合 ${manualDirection || '相关背景'} 候选人关注。` : '',
        logo: job.logo || '',
        companyWebsite: job.company_website || '',
        matchScore: Math.round(score * 100),
        matchSignals: signals,
        publishedAt: job.published_at,
    }));
}

// ─── Shared: Upsert user state helper ───────────────────────────────────────

async function upsertUserState(userId, updates) {
    const setClauses = [];
    const values = [userId];
    let paramIdx = 2;

    for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`${key} = $${paramIdx}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        paramIdx++;
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    const insertCols = Object.keys(updates).join(', ');
    const insertVals = Object.keys(updates).map((_, i) => `$${i + 2}`).join(', ');

    const sql = `
    INSERT INTO copilot_user_state (user_id, ${insertCols}, updated_at)
    VALUES ($1, ${insertVals}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(', ')}
  `;

    await neonHelper.query(sql, values);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: get-state
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGetState(userId) {
    let rows = [];
    try {
        rows = await neonHelper.query(
            `SELECT * FROM copilot_user_state WHERE user_id = $1`, [userId]
        ) || [];
    } catch (e) {
        console.warn('[Copilot V1.3] get-state fallback without copilot_user_state:', e.message);
        rows = [];
    }

    const state = rows?.[0] || null;

    // Always fetch tasks and matches (even if no state row yet)
    let tasks = [];
    try {
        tasks = await neonHelper.query(
            `SELECT id, phase, task_name, priority, status, completed_at
             FROM copilot_tasks WHERE user_id = $1 ORDER BY id`, [userId]
        ) || [];
    } catch (e) { /* table may not exist in some envs */ }

    let jobMatches = [];
    try {
        jobMatches = await neonHelper.query(
            `SELECT cjm.job_id, cjm.match_score, cjm.match_reason,
                    j.title, j.company, j.category, j.location, j.job_type, j.salary
             FROM copilot_job_matches cjm
             LEFT JOIN jobs j ON j.job_id = cjm.job_id
             WHERE cjm.user_id = $1
             ORDER BY cjm.match_score DESC LIMIT 20`, [userId]
        ) || [];
    } catch (e) { /* table may not exist in some envs */ }

    return {
        success: true,
        state: state ? {
            resumeStructured: state.resume_structured,
            resumeVersion: state.resume_version,
            readinessData: state.readiness_data,
            readinessGeneratedAt: state.readiness_generated_at,
            currentPhase: state.current_phase,
            planData: state.plan_data,
            appliedCount: state.applied_count,
            interviewCount: state.interview_count,
            updatedAt: state.updated_at,
        } : null,
        tasks,
        jobMatches,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: extract-resume
// ═══════════════════════════════════════════════════════════════════════════

export async function handleExtractResume(userId, resumeId) {
    // 1. Get resume text
    let resumeText = '';
    try {
        const { resumes } = await getResumes(userId);
        // If no specific resumeId, use the first (latest) resume
        const matched = resumeId
            ? resumes.find(r => r.id === resumeId)
            : resumes[0];
        if (matched) {
            resumeText = matched.contentText || matched.parseResult?.text || '';
            if (resumeText.length > 4000) resumeText = resumeText.substring(0, 4000);
        }
    } catch (e) {
        console.warn('[Copilot V1.3] Failed to fetch resume:', e.message);
    }

    if (!resumeText) {
        return { error: '未找到简历内容，请先在「个人中心」上传简历' };
    }

    // 2. Call AI for structured extraction
    const prompt = `请将以下简历内容结构化提取。

简历内容：
${resumeText}

输出JSON：
{
  "career_level": "初级/中级/高级/专家",
  "years_of_experience": "数字或范围",
  "industries": ["行业1", "行业2"],
  "roles": ["角色1", "角色2"],
  "skills": ["技能1", "技能2", ...],
  "tools": ["工具1", "工具2", ...],
  "achievements_with_metrics": ["成就1", "成就2"],
  "management_experience": true或false,
  "english_related_experience": ["经历1"],
  "remote_related_experience": ["经历1"]
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 1000);
    if (!raw) return { error: 'AI 处理失败，请稍后重试' };

    try {
        const structured = parseAIJSON(raw);

        // 3. Save to state
        let currentVersion = 0;
        try {
            const currentState = await neonHelper.query(
                `SELECT resume_version FROM copilot_user_state WHERE user_id = $1`, [userId]
            );
            currentVersion = currentState?.[0]?.resume_version || 0;

            await upsertUserState(userId, {
                resume_structured: structured,
                resume_version: currentVersion + 1,
            });
        } catch (e) {
            console.warn('[Copilot V1.3] extract-resume fallback without copilot_user_state:', e.message);
        }

        // 4. Log to sessions
        await insertCopilotSessionWithFallback({
            userId,
            goal: 'extract',
            timeline: '',
            background: {},
            planData: structured,
            module: 'extract'
        });

        return { success: true, resumeStructured: structured, version: currentVersion + 1 };
    } catch (e) {
        console.error('[Copilot V1.3] extract-resume parse error:', e.message);
        return { error: '简历解析结果格式异常，请重试' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: assess (M1 - Remote Readiness Assessment)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAssess(userId, body) {
    const { goal, timeline, background, forceRefresh } = body;

    // 1. Check cache validity (7 days + same resume version)
    if (!forceRefresh) {
        try {
            const existing = await neonHelper.query(
                `SELECT readiness_data, readiness_generated_at, resume_version
       FROM copilot_user_state WHERE user_id = $1`, [userId]
            );
            const state = existing?.[0];
            if (state?.readiness_data && state?.readiness_generated_at) {
                const age = Date.now() - new Date(state.readiness_generated_at).getTime();
                if (age < 7 * 24 * 3600 * 1000) {
                    console.log('[Copilot V1.3] Returning cached readiness assessment');
                    return { success: true, cached: true, readinessData: state.readiness_data };
                }
            }
        } catch (e) {
            console.warn('[Copilot V1.3] assess fallback without copilot_user_state cache:', e.message);
        }
    }

    // 2. Get resume structured data if available
    let resumeStructured = null;
    try {
        const stateRows = await neonHelper.query(
            `SELECT resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
        );
        resumeStructured = stateRows?.[0]?.resume_structured;
    } catch (e) {
        console.warn('[Copilot V1.3] assess fallback without copilot_user_state data:', e.message);
    }

    const { education = '', industry: role = '', seniority = '', language = '' } = background || {};

    const goalLabel = {
        'full-time': '全职远程工作',
        'part-time': '兼职/副业远程增收',
        'market-watch': '关注远程市场机会',
        'freelance': '职业转型或换赛道',
    }[goal] || goal;

    // 3. Build prompt
    const resumeBlock = resumeStructured
        ? `\n简历结构化信息：\n${JSON.stringify(resumeStructured, null, 0)}`
        : '\n用户未提供简历。';

    const prompt = `根据以下用户信息，评估其远程工作适配度。

用户信息：
目标类型：${goalLabel}
规划时间：${timeline}
职业方向：${role}
工作年限/资历：${seniority}
学历：${education}
英语水平：${language}
${resumeBlock}

输出以下JSON：
{
  "remote_readiness_score": 0到100的整数,
  "readiness_level": "low或medium或high",
  "strengths": [
    {"point": "优势点", "reason": "原因"}
  ],
  "gaps": [
    {"gap": "差距点", "impact": "影响说明"}
  ],
  "priority_improvements": [
    {"action": "改进行动", "expected_benefit": "预期收益"}
  ],
  "estimated_timeline": "预估拿到offer的时间"
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 800);
    if (!raw) return { error: 'AI 评估失败，请稍后重试' };

    try {
        const readiness = parseAIJSON(raw);

        // 4. Save to state
        try {
            await upsertUserState(userId, {
                readiness_data: readiness,
                readiness_generated_at: new Date().toISOString(),
            });
        } catch (e) {
            console.warn('[Copilot V1.3] assess state persistence skipped:', e.message);
        }

        // 5. Log
        await insertCopilotSessionWithFallback({
            userId,
            goal,
            timeline,
            background,
            planData: readiness,
            module: 'assess'
        });

        return { success: true, cached: false, readinessData: readiness };
    } catch (e) {
        console.error('[Copilot V1.3] assess parse error:', e.message);
        return { error: '评估结果解析失败，请重试' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: match-jobs (M2 - Zero AI cost)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleMatchJobs(userId) {
    // 1. Get user's structured resume data
    let structured = null;
    try {
        const stateRows = await neonHelper.query(
            `SELECT resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
        );
        structured = stateRows?.[0]?.resume_structured;
    } catch (e) {
        console.warn('[Copilot V1.3] match-jobs fallback without copilot_user_state:', e.message);
    }

    if (!structured) {
        return { error: '请先完成简历解析（extract-resume），再进行岗位匹配' };
    }

    const results = await findMatchingJobs({ structured, limit: 20 });

    // 5. Cache results in copilot_job_matches (batch insert for performance)
    try {
        await neonHelper.query(`DELETE FROM copilot_job_matches WHERE user_id = $1`, [userId]);

        if (results.length > 0) {
            const insertValues = [];
            const insertParams = [];
            let pIdx = 1;
            for (const result of results) {
                insertValues.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2})`);
                insertParams.push(userId, result.jobId, result.matchScore);
                pIdx += 3;
            }
            await neonHelper.query(
                `INSERT INTO copilot_job_matches (user_id, job_id, match_score) VALUES ${insertValues.join(', ')}`,
                insertParams
            );
        }
    } catch (e) {
        console.warn('[Copilot V1.3] Failed to cache matches:', e.message);
    }

    return { success: true, matches: results, total: results.length };
}

export async function handleHeroRecommendations(userId, body) {
    const { jobDirection, positionType = 'full-time', resumeId, resumeHints: incomingResumeHints = [], limit = 5 } = body || {};

    if (!jobDirection || !String(jobDirection).trim()) {
        return { error: 'jobDirection 为必填参数' };
    }

    let structured = null;
    if (userId) {
        try {
            const stateRows = await neonHelper.query(
                `SELECT resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
            );
            structured = stateRows?.[0]?.resume_structured || null;
        } catch (e) {
            // 某些本地/预发环境尚未建表，降级为“仅基于输入与简历提示”匹配
            console.warn('[Copilot V1.3] hero-recommend fallback without copilot_user_state:', e.message);
            structured = null;
        }
    }

    let resumeHints = normalizeTerms([incomingResumeHints]);
    if (userId && resumeId) {
        const extracted = await handleExtractResume(userId, resumeId);
        if (extracted?.success && extracted.resumeStructured) {
            structured = extracted.resumeStructured;
        } else {
            resumeHints = normalizeTerms([resumeHints, await fetchResumeHints(userId, resumeId)]);
        }
    }

    const matches = await findMatchingJobs({
        structured,
        manualDirection: String(jobDirection).trim(),
        positionType,
        resumeHints,
        limit: Math.min(Math.max(Number(limit) || 1, 1), 5),
    });

    if (!matches.length) {
        return { error: '当前未检索到匹配岗位' };
    }

    return { success: true, matches, total: matches.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: create-plan (M3 - Action Plan Generation)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCreatePlan(userId, body) {
    const { goal, timeline, background } = body || {};

    // 1. Get readiness data and structured resume
    let readiness = null;
    let resumeStructured = null;
    try {
        const stateRows = await neonHelper.query(
            `SELECT readiness_data, resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
        );
        const state = stateRows?.[0];
        readiness = state?.readiness_data;
        resumeStructured = state?.resume_structured;
    } catch (e) {
        console.warn('[Copilot V1.3] create-plan fallback without copilot_user_state:', e.message);
    }

    const timelineWeeks = {
        'immediately': 4,
        '1-3 months': 12,
        '3-6 months': 24,
        'flexible': 16,
    }[timeline] || 12;

    const goalLabel = {
        'full-time': '全职远程工作',
        'part-time': '兼职/副业远程增收',
        'market-watch': '关注远程市场机会',
        'freelance': '职业转型',
    }[goal] || goal;
    const direction = String(background?.industry || '').trim();
    const availability = String(background?.availability || '').trim();

    // 2. Build prompt with real data
    const gapsBlock = readiness?.gaps
        ? `核心差距：${readiness.gaps.map(g => g.gap).join('、')}`
        : '核心差距：暂无评估数据';

    const skillsBlock = resumeStructured?.skills
        ? `已有技能：${resumeStructured.skills.join('、')}`
        : '';

    const prompt = `根据用户目标与时间规划，生成阶段性远程求职行动计划。

用户信息：
目标：${goalLabel}
时间规划：${timelineWeeks}周
目标职业方向：${direction || '未填写'}
每周可投入时间：${availability || '未填写'}
远程适配评分：${readiness?.remote_readiness_score || '未评估'}
${gapsBlock}
${skillsBlock}

输出JSON：
{
  "phases": [
    {
      "phase_name": "阶段名称",
      "phase_key": "resume或apply或network或interview或english",
      "duration_weeks": "周数",
      "focus": "核心聚焦",
      "tasks": [
        {
          "task_name": "具体任务",
          "type": "resume或apply或network或interview或english",
          "priority": "high或medium或low"
        }
      ]
    }
  ]
}

请生成3-5个阶段，每个阶段3-5个任务，覆盖${timelineWeeks}周时间线。`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 1200);
    if (!raw) return { error: '计划生成失败，请稍后重试' };

    try {
        const planData = parseAIJSON(raw);

        // 3. Save plan to state
        try {
            await upsertUserState(userId, {
                plan_data: planData,
                current_phase: planData.phases?.[0]?.phase_key || 'resume',
            });
        } catch (e) {
            console.warn('[Copilot V1.3] create-plan state persistence skipped:', e.message);
        }

        // 4. Create tasks in copilot_tasks
        // Clear existing tasks first
        try {
            await neonHelper.query(`DELETE FROM copilot_tasks WHERE user_id = $1`, [userId]);

            for (const phase of (planData.phases || [])) {
                for (const task of (phase.tasks || [])) {
                    await neonHelper.query(
                        `INSERT INTO copilot_tasks (user_id, phase, task_name, priority)
           VALUES ($1, $2, $3, $4)`,
                        [userId, task.type || phase.phase_key, task.task_name, task.priority || 'medium']
                    );
                }
            }
        } catch (e) {
            console.warn('[Copilot V1.3] create-plan task sync skipped:', e.message);
        }

        // 5. Log
        await insertCopilotSessionWithFallback({
            userId,
            goal,
            timeline,
            background,
            planData,
            module: 'plan'
        });

        return { success: true, planData };
    } catch (e) {
        console.error('[Copilot V1.3] create-plan parse error:', e.message);
        return { error: '计划解析失败，请重试' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: update-progress (M3 - Task Progress)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleUpdateProgress(userId, body) {
    const { taskId, status } = body; // status: 'completed' | 'in_progress' | 'skipped'

    if (!taskId || !status) {
        return { error: 'taskId 和 status 为必填参数' };
    }

    // 1. Update task status
    await neonHelper.query(
        `UPDATE copilot_tasks SET status = $1, completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}
         WHERE id = $2 AND user_id = $3`,
        [status, taskId, userId]
    );

    // 2. Check phase completion rate
    const taskStats = await neonHelper.query(
        `SELECT phase,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'completed') as done
     FROM copilot_tasks WHERE user_id = $1
     GROUP BY phase ORDER BY phase`,
        [userId]
    );

    // 3. Determine current phase and completion
    let suggestion = null;
    const phases = taskStats || [];
    let allPhasesDone = true;

    for (const p of phases) {
        const rate = p.total > 0 ? p.done / p.total : 0;
        if (rate < 1) {
            allPhasesDone = false;
            // If current phase > 80% complete, generate AI suggestion for next phase
            if (rate >= 0.8) {
                const prompt = `用户正在进行远程求职，当前阶段「${p.phase}」已完成 ${Math.round(rate * 100)}%。
已完成任务数：${p.done}/${p.total}

请给出简短的下一步建议。
输出JSON：
{
  "next_focus": "接下来的核心聚焦点",
  "suggestions": ["建议1", "建议2"],
  "motivation": "一句鼓励的话"
}`;
                const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 400);
                if (raw) {
                    try {
                        suggestion = parseAIJSON(raw);
                    } catch (e) { /* ignore parse errors */ }
                }
            }
            break;
        }
    }

    // 4. Update current phase in state
    const currentPhaseFromTasks = phases.find(p => p.done < p.total)?.phase || 'completed';
    await upsertUserState(userId, {
        current_phase: allPhasesDone ? 'completed' : currentPhaseFromTasks,
    });

    return {
        success: true,
        phaseProgress: phases.map(p => ({
            phase: p.phase,
            total: parseInt(p.total),
            done: parseInt(p.done),
            rate: p.total > 0 ? Math.round((p.done / p.total) * 100) : 0,
        })),
        suggestion,
    };
}
