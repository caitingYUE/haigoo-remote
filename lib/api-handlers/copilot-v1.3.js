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
import { readJobsFromNeon } from './processed-jobs.js';
import {
    calibrateDisplayScore,
    resolveMatchLevelFromDisplayBand
} from '../services/match-score-calibration.js';

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

const DIRECTION_SYNONYM_MAP = {
    '研发': ['研发', '技术', '开发', '工程师', '程序员', 'software', 'developer', 'engineer', 'backend', 'frontend', 'full stack', 'devops', 'qa', '测试', '算法', 'data', 'ai', 'machine learning'],
    '技术研发': ['研发', '技术', '开发', '工程师', 'software', 'developer', 'engineer', 'backend', 'frontend', 'full stack', 'devops', '测试', '算法'],
    '开发': ['开发', '工程师', '程序员', 'software', 'developer', 'engineer', 'backend', 'frontend', 'full stack'],
    '后端': ['后端', 'backend', 'java', 'golang', 'python', 'node', 'server'],
    '前端': ['前端', 'frontend', 'react', 'vue', 'javascript', 'typescript', 'web'],
    '全栈': ['全栈', 'full stack', 'backend', 'frontend'],
    '测试': ['测试', 'qa', 'quality assurance', 'automation test', 'sdet'],
    '运维': ['运维', 'devops', 'sre', 'platform', 'infrastructure', 'cloud'],
    '数据': ['数据', 'data', 'analyst', 'analytics', 'bi', 'sql'],
    '算法': ['算法', 'ai', 'machine learning', 'ml', 'nlp', 'cv', 'research'],
    '产品': ['产品', 'product', 'pm', 'product manager', 'product owner'],
    '设计': ['设计', 'designer', 'ux', 'ui', 'product design', 'visual'],
    '运营': ['运营', 'operation', 'ops', 'growth', 'community', '内容'],
    '市场': ['市场', 'marketing', 'brand', 'growth marketing', 'seo', 'content marketing'],
    '销售': ['销售', 'sales', 'account executive', 'bd', 'business development'],
    '客服': ['客服', 'support', 'customer success', 'csm', 'customer service'],
    '财务': ['财务', 'finance', 'accounting', 'controller', 'fp&a', 'bookkeeper'],
    '人力': ['hr', 'recruiter', 'talent', 'people', 'human resources', '招聘'],
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

function expandDirectionTerms(input = '') {
    const base = normalizeTerms([input]);
    const expanded = new Set(base);
    const raw = String(input || '').trim().toLowerCase();
    for (const [key, synonyms] of Object.entries(DIRECTION_SYNONYM_MAP)) {
        const normalizedKey = key.toLowerCase();
        if (raw.includes(normalizedKey) || normalizedKey.includes(raw)) {
            for (const term of synonyms) {
                expanded.add(String(term || '').trim().toLowerCase());
            }
        }
    }
    return Array.from(expanded).filter(Boolean);
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
    const normalizedJob = normalizePositionType(`${job.job_type || job.jobType || job.type || ''} ${job.title || ''} ${job.description || ''}`);
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

const tableAvailabilityCache = new Map();
async function hasTable(tableName) {
    if (tableAvailabilityCache.has(tableName)) return tableAvailabilityCache.get(tableName);
    try {
        const rows = await neonHelper.query(
            `SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            ) AS exists`,
            [tableName]
        );
        const exists = !!rows?.[0]?.exists;
        tableAvailabilityCache.set(tableName, exists);
        return exists;
    } catch {
        tableAvailabilityCache.set(tableName, false);
        return false;
    }
}

async function hasCopilotUserStateTable() {
    return hasTable('copilot_user_state');
}

async function hasCopilotTasksTable() {
    return hasTable('copilot_tasks');
}

async function hasCopilotJobMatchesTable() {
    return hasTable('copilot_job_matches');
}

async function queryCopilotUserState(sql, params = [], fallback = []) {
    if (!(await hasCopilotUserStateTable())) return fallback;
    try {
        return await neonHelper.query(sql, params) || fallback;
    } catch (e) {
        if (/copilot_user_state/i.test(String(e?.message || '')) && /(does not exist|不存在)/i.test(String(e?.message || ''))) {
            tableAvailabilityCache.set('copilot_user_state', false);
            console.warn('[Copilot V1.3] copilot_user_state missing, skip state query');
            return fallback;
        }
        throw e;
    }
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
    const directionTerms = expandDirectionTerms(manualDirection);
    const profileTerms = normalizeTerms([
        directionTerms,
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
    let rows = [];
    try {
        rows = await readJobsFromNeon(
            {
                status: 'active',
                isApproved: true,
                sortBy: 'recent',
            },
            { page: 1, limit: 120 }
        );
    } catch (e) {
        console.warn('[Copilot V1.3] matching query error:', e.message);
        rows = [];
    }

    const skillTerms = normalizeTerms([structured?.skills, structured?.tools, resumeHints]).slice(0, 16);

    const vectorDocs = rows.map(job => {
        const jobTags = parseStringArray(job.tags);
        const vectorText = [
            job.title,
            job.category,
            job.jobType || job.type,
            ...jobTags,
            (job.description || '').substring(0, 900),
        ].filter(Boolean).join(' ');
        return {
            jobId: job.id,
            tf: buildTermFreq(tokenizeForVector(vectorText)),
        };
    });
    const idf = buildIdf(vectorDocs.map(doc => doc.tf));
    const queryVector = toTfidf(buildTermFreq(tokenizeForVector(resumeVectorTerms.join(' '))), idf);
    const vectorLookup = new Map(vectorDocs.map(doc => [doc.jobId, toTfidf(doc.tf, idf)]));

    const scored = rows.map(job => {
        const jobType = job.jobType || job.type || '';
        const titleCategoryText = `${job.title || ''} ${job.category || ''} ${jobType}`.toLowerCase();
        const jobText = `${titleCategoryText} ${(job.description || '').substring(0, 900)}`.toLowerCase();
        const directionScore = computeDirectionScore(directionTerms, manualDirection, job);
        const typeScore = computeTypeScore(positionType, job);
        const skillTagScore = computeSkillTagScore(skillTerms, parseStringArray(job.tags), jobText);
        const resumeSemanticScore = resumeVectorTerms.length > 0
            ? cosineSimilaritySparse(queryVector, vectorLookup.get(job.id))
            : 0;
        const freshnessAnchor = job.publishedAt || job.createdAt;
        const freshnessDays = freshnessAnchor ? Math.max(0, (Date.now() - new Date(freshnessAnchor).getTime()) / (1000 * 60 * 60 * 24)) : 30;
        const freshnessScore = freshnessDays <= 3 ? 1 : freshnessDays <= 7 ? 0.8 : freshnessDays <= 14 ? 0.6 : 0.35;

        let score =
            directionScore * HERO_MATCH_WEIGHTS.direction +
            typeScore * HERO_MATCH_WEIGHTS.positionType +
            skillTagScore * HERO_MATCH_WEIGHTS.skillTags +
            resumeSemanticScore * HERO_MATCH_WEIGHTS.resumeSemantic +
            freshnessScore * HERO_MATCH_WEIGHTS.freshness;

        // 岗位类型作为近似筛选项：明显不匹配时，整体降权（不完全过滤）
        if (typeScore < 0.4) score *= 0.65;
        if (directionTerms.length > 0 && directionScore < 0.12) score *= 0.12;
        else if (directionTerms.length > 0 && directionScore < 0.25) score *= 0.38;

        const hasStrongDirectionHit = directionTerms.length === 0 || directionTerms.some(term => titleCategoryText.includes(term));

        return {
            job,
            score,
            hasStrongDirectionHit,
            signals: {
                direction: Math.round(directionScore * 100),
                positionType: Math.round(typeScore * 100),
                skillTags: Math.round(skillTagScore * 100),
                resumeSemantic: Math.round(resumeSemanticScore * 100),
                freshness: Math.round(freshnessScore * 100),
            }
        };
    });

    const filtered = directionTerms.length > 0
        ? scored.filter(item => item.hasStrongDirectionHit || item.signals.direction >= 28)
        : scored;
    const ranked = (filtered.length > 0 ? filtered : scored).sort((a, b) => b.score - a.score);

    return ranked.slice(0, limit).map(({ job, score, signals }) => {
        const trueScore = Math.round(score * 100);
        const calibrated = calibrateDisplayScore({ trueScore });
        return {
            jobId: job.id,
            id: job.id,
            title: job.title,
            company: job.company,
            company_name: job.company,
            companyId: job.companyId,
            category: job.category,
            location: job.location || 'Remote',
            jobType: job.jobType || job.type,
            experienceLevel: job.experienceLevel,
            salary: job.salary || '薪资Open',
            description: job.description || '',
            companyIntro: job.companyDescription || job.description || '',
            companyDescription: job.companyDescription || '',
            companyTranslations: job.companyTranslations || null,
            logo: job.logo || job.companyLogo || '',
            companyWebsite: job.companyWebsite || '',
            sourceUrl: job.sourceUrl || job.url || '',
            url: job.url || job.sourceUrl || '',
            timezone: job.timezone || '',
            translations: job.translations || null,
            isTranslated: !!job.isTranslated,
            isTrusted: !!job.isTrusted,
            matchScore: calibrated.displayScore,
            trueMatchScore: trueScore,
            displayMatchScore: calibrated.displayScore,
            displayBand: calibrated.displayBand,
            matchLevel: resolveMatchLevelFromDisplayBand(calibrated.displayBand),
            matchSignals: signals,
            publishedAt: job.publishedAt,
        };
    });
}

// ─── Shared: Upsert user state helper ───────────────────────────────────────

async function upsertUserState(userId, updates) {
    if (!(await hasCopilotUserStateTable())) return false;
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

    await queryCopilotUserState(sql, values, false);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: get-state
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGetState(userId) {
    let rows = [];
    try {
        rows = await queryCopilotUserState(
            `SELECT * FROM copilot_user_state WHERE user_id = $1`, [userId], []
        );
    } catch (e) {
        console.warn('[Copilot V1.3] get-state fallback without copilot_user_state:', e.message);
        rows = [];
    }

    const state = rows?.[0] || null;

    // Always fetch tasks and matches (even if no state row yet)
    let tasks = [];
    try {
        if (await hasCopilotTasksTable()) {
        tasks = await neonHelper.query(
            `SELECT id, phase, task_name, priority, status, completed_at
             FROM copilot_tasks WHERE user_id = $1 ORDER BY id`, [userId]
        ) || [];
        }
    } catch (e) { /* table may not exist in some envs */ }

    let jobMatches = [];
    try {
        if (await hasCopilotJobMatchesTable()) {
        jobMatches = await neonHelper.query(
            `SELECT cjm.job_id, cjm.match_score, cjm.match_reason,
                    j.title, j.company, j.category, j.location, j.job_type, j.salary
             FROM copilot_job_matches cjm
             LEFT JOIN jobs j ON j.job_id = cjm.job_id
             WHERE cjm.user_id = $1
             ORDER BY cjm.match_score DESC LIMIT 20`, [userId]
        ) || [];
        }
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
            const currentState = await queryCopilotUserState(
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
            const existing = await queryCopilotUserState(
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
        const stateRows = await queryCopilotUserState(
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
        const stateRows = await queryCopilotUserState(
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
        if (!(await hasCopilotJobMatchesTable())) {
            return { success: true, matches: results, total: results.length };
        }
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
            const stateRows = await queryCopilotUserState(
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

function normalizePlanText(value = '') {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isPlanContextReusable(planData, options = {}) {
    if (!planData || typeof planData !== 'object') return false;
    const goalContext = planData.goal_context || {};
    const defaults = planData.defaults || {};
    const resumeCompatible = !options.hasResume || Boolean(goalContext.has_resume);

    return normalizePlanText(goalContext.job_direction).toLowerCase() === normalizePlanText(options.direction).toLowerCase()
        && normalizePlanText(goalContext.position_type).toLowerCase() === normalizePlanText(options.positionTypeLabel).toLowerCase()
        && normalizePlanText(defaults.english_level).toLowerCase() === normalizePlanText(options.defaultEnglish).toLowerCase()
        && normalizePlanText(defaults.education_level).toLowerCase() === normalizePlanText(options.defaultEducation).toLowerCase()
        && normalizePlanText(defaults.preparation_time).toLowerCase() === normalizePlanText(options.defaultPreparation).toLowerCase()
        && normalizePlanText(defaults.weekly_commitment).toLowerCase() === normalizePlanText(options.availability || '5-10小时').toLowerCase()
        && resumeCompatible;
}

function toTextArray(items = [], preferredKeys = []) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                for (const key of preferredKeys) {
                    if (item[key]) return item[key];
                }
            }
            return '';
        })
        .map((item) => normalizePlanText(item))
        .filter(Boolean);
}

function normalizeInterviewQuestions(items = [], startIndex = 1) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item, idx) => {
            const question = normalizePlanText(typeof item === 'string' ? item : item?.question || item?.title || '');
            if (!question) return null;
            return {
                id: typeof item === 'object' && item?.id ? String(item.id) : `q${startIndex + idx}`,
                question,
                focus: normalizePlanText(typeof item === 'object' ? item?.focus || item?.theme || '' : ''),
                hint: normalizePlanText(typeof item === 'object' ? item?.hint || item?.tip || item?.why_it_matters || '' : ''),
            };
        })
        .filter(Boolean);
}

function timelineToWeeks(timeline = '') {
    return {
        immediately: 4,
        '1-3 months': 12,
        '3-6 months': 24,
        flexible: 16,
        '1个月内': 4,
        '1-3个月': 12,
        '3-6个月': 24,
        '尽快入职': 4,
    }[timeline] || 12;
}

function timelineToLabel(timeline = '') {
    return {
        immediately: '1个月内',
        '1-3 months': '1-3个月',
        '3-6 months': '3-6个月',
        flexible: '灵活安排',
        '1个月内': '1个月内',
        '1-3个月': '1-3个月',
        '3-6个月': '3-6个月',
        '尽快入职': '1个月内',
    }[timeline] || '1-3个月';
}

function goalToLabel(goal = '') {
    return {
        'full-time': '全职远程',
        contract: '合同/兼职',
        freelance: '自由职业',
        internship: '实习',
        'part-time': '兼职/副业远程增收',
        'market-watch': '关注远程市场机会',
    }[goal] || goal || '全职远程';
}

function buildSuitabilityFallback(readiness = null, direction = '') {
    const score = Number(readiness?.remote_readiness_score || 0);
    const level = score >= 78 ? 'ready' : score >= 58 ? 'prepare_more' : 'stretch';
    const headline = level === 'ready'
        ? `适合开始尝试 ${direction || '远程岗位'}，重点在于尽快形成稳定投递与面试节奏。`
        : level === 'prepare_more'
            ? `可以尝试 ${direction || '远程岗位'}，但建议先补齐几项关键准备再集中发力。`
            : `当前更适合先做准备，再冲刺 ${direction || '远程岗位'}。`;

    return {
        level,
        headline,
        summary: normalizePlanText(headline),
        strengths: toTextArray(readiness?.strengths, ['point', 'reason']).slice(0, 3),
        risks: toTextArray(readiness?.gaps, ['gap', 'impact']).slice(0, 3),
        action_focus: toTextArray(readiness?.priority_improvements, ['action', 'expected_benefit']).slice(0, 4),
    };
}

function buildPlanPhases(planData, timelineWeeks) {
    const direction = planData?.goal_context?.job_direction || '目标岗位';
    const actionFocus = toTextArray(planData?.suitability?.action_focus || []).slice(0, 4);
    const riskFocus = toTextArray(planData?.suitability?.risks || []).slice(0, 3);
    const interviewQuestions = normalizeInterviewQuestions(planData?.english_interview?.questions || []).slice(0, 3);

    const foundationWeeks = Math.max(2, Math.round(timelineWeeks * 0.3));
    const applicationWeeks = Math.max(3, Math.round(timelineWeeks * 0.35));
    const interviewWeeks = Math.max(2, timelineWeeks - foundationWeeks - applicationWeeks);

    const foundationTasks = [
        ...(actionFocus.slice(0, 2).map((task) => ({ task_name: task, type: 'resume', priority: 'high' }))),
        ...(riskFocus.slice(0, 1).map((task) => ({ task_name: `优先处理：${task}`, type: 'resume', priority: 'high' }))),
    ]

    return [
        {
            phase_name: '准备基础校准',
            phase_key: 'resume',
            duration_weeks: foundationWeeks,
            focus: '明确远程求职可行性，并补齐最影响转化的基础短板',
            tasks: foundationTasks.length > 0
                ? foundationTasks
                : [
                    { task_name: `明确 ${direction} 的目标岗位画像与核心门槛`, type: 'resume', priority: 'high' },
                    { task_name: '梳理当前背景与目标岗位之间的关键差距', type: 'resume', priority: 'high' },
                    { task_name: '安排固定的英语表达与远程协作练习时间', type: 'resume', priority: 'medium' },
                ],
        },
        {
            phase_name: '岗位匹配与投递准备',
            phase_key: 'apply',
            duration_weeks: applicationWeeks,
            focus: '围绕目标方向优化材料，并建立稳定投递节奏',
            tasks: [
                { task_name: `梳理 ${direction} 的核心岗位画像与关键词`, type: 'apply', priority: 'high' },
                { task_name: '优化中文/英文简历里的项目结果与量化表达', type: 'apply', priority: 'high' },
                { task_name: '建立每周固定投递与复盘节奏', type: 'apply', priority: 'medium' },
            ],
        },
        {
            phase_name: '英文面试冲刺',
            phase_key: 'interview',
            duration_weeks: interviewWeeks,
            focus: '围绕高频英文问题完成结构化演练与表达修正',
            tasks: interviewQuestions.length > 0
                ? interviewQuestions.map((item, idx) => ({
                    task_name: `练习第 ${idx + 1} 题：${item.question}`,
                    type: 'interview',
                    priority: idx === 0 ? 'high' : 'medium',
                }))
                : [
                    { task_name: '准备 60 秒英文自我介绍', type: 'interview', priority: 'high' },
                    { task_name: '整理 3 个 STAR 项目案例', type: 'interview', priority: 'high' },
                    { task_name: '模拟一次远程视频面试表达', type: 'interview', priority: 'medium' },
                ],
        },
    ];
}

export async function handleCreatePlan(userId, body) {
    const { goal, timeline, background, forceRefresh } = body || {};
    const isMember = Boolean(body?.__isMember);

    let readiness = null;
    let resumeStructured = null;
    let existingPlan = null;
    try {
        const stateRows = await queryCopilotUserState(
            `SELECT readiness_data, resume_structured, plan_data FROM copilot_user_state WHERE user_id = $1`, [userId]
        );
        const state = stateRows?.[0];
        readiness = state?.readiness_data;
        resumeStructured = state?.resume_structured;
        existingPlan = state?.plan_data;
    } catch (e) {
        console.warn('[Copilot V1.3] create-plan fallback without copilot_user_state:', e.message);
    }

    const timelineWeeks = timelineToWeeks(timeline);
    const goalLabel = goalToLabel(goal);
    const direction = String(background?.industry || '').trim();
    const availability = String(background?.availability || '').trim();
    const defaultEnglish = String(background?.language || '中等（可借助翻译软件线上交流）').trim();
    const defaultEducation = String(background?.education || '大学本科').trim();
    const defaultPreparation = String(background?.preparationTime || timelineToLabel(timeline)).trim();
    const positionTypeLabel = String(background?.positionTypeLabel || goalLabel || '全职远程').trim();
    const questionLimit = isMember ? 10 : 5;

    if (!forceRefresh && isPlanContextReusable(existingPlan, {
        direction,
        positionTypeLabel,
        defaultEnglish,
        defaultEducation,
        defaultPreparation,
        availability,
        hasResume: Boolean(resumeStructured),
    })) {
        return {
            success: true,
            cached: true,
            planData: existingPlan,
            plan: existingPlan,
        };
    }

    const gapsBlock = readiness?.gaps
        ? `核心差距：${readiness.gaps.map((g) => g.gap).join('、')}`
        : '核心差距：暂无评估数据';
    const skillsBlock = resumeStructured?.skills
        ? `已有技能：${resumeStructured.skills.join('、')}`
        : '';
    const resumeBlock = resumeStructured
        ? `简历结构化信息：${JSON.stringify(resumeStructured)}`
        : '未上传简历，仅基于职业方向和默认背景生成。';

    const prompt = `请基于用户背景生成一份远程求职规划。请保持专业、具体、可执行，全部使用简体中文输出。

用户信息：
职业方向：${direction || '未填写'}
岗位类型：${positionTypeLabel}
准备周期：${defaultPreparation}
每周可投入时间：${availability || '5-10小时'}
英语能力：${defaultEnglish}
学历：${defaultEducation}
远程适配评分：${readiness?.remote_readiness_score || '未评估'}
${gapsBlock}
${skillsBlock}
${resumeBlock}

要求：
1. 方案结构只围绕默认项、总概括结论、英文面试准备三部分。
2. 总概括结论要判断用户是否适合远程工作。若职业背景偏传统、学历较低或英语明显偏弱，请明确提示需要更多准备，但表达要专业且建设性。
3. 英文面试准备请生成 ${questionLimit} 道问题，覆盖自我介绍、项目经历、远程协作、英文沟通、岗位专业能力。如果有简历，尽量贴合简历经历；没有简历则给通用版。
4. 只输出合法 JSON，不要输出 markdown，不要输出额外解释。

输出 JSON：
{
  "plan_version": "copilot_plan_v3",
  "defaults": {
    "english_level": "${defaultEnglish}",
    "education_level": "${defaultEducation}",
    "preparation_time": "${defaultPreparation}",
    "weekly_commitment": "${availability || '5-10小时'}"
  },
  "goal_context": {
    "job_direction": "${direction || '未填写'}",
    "position_type": "${positionTypeLabel}",
    "has_resume": ${resumeStructured ? 'true' : 'false'}
  },
  "suitability": {
    "level": "ready或prepare_more或stretch",
    "headline": "一句核心判断",
    "summary": "2-3句总结",
    "strengths": ["优势1", "优势2"],
    "risks": ["风险1", "风险2"],
    "action_focus": ["优先动作1", "优先动作2", "优先动作3"]
  },
  "english_interview": {
    "summary": "这一组题目该如何使用",
    "question_limit": ${questionLimit},
    "member_maximum": 30,
    "resume_personalized": ${resumeStructured ? 'true' : 'false'},
    "questions": [
      {
        "question": "英文面试问题",
        "focus": "考察重点",
        "hint": "简短回答提示"
      }
    ]
  }
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, isMember ? 'qwen-max' : 'qwen-plus', isMember ? 2200 : 1400);
    if (!raw) return { error: '计划生成失败，请稍后重试' };

    try {
        const parsed = parseAIJSON(raw);
        const fallbackSuitability = buildSuitabilityFallback(readiness, direction);
        const defaults = {
            english_level: normalizePlanText(parsed?.defaults?.english_level || defaultEnglish),
            education_level: normalizePlanText(parsed?.defaults?.education_level || defaultEducation),
            preparation_time: normalizePlanText(parsed?.defaults?.preparation_time || defaultPreparation),
            weekly_commitment: normalizePlanText(parsed?.defaults?.weekly_commitment || availability || '5-10小时'),
        };
        const suitability = {
            ...fallbackSuitability,
            ...(parsed?.suitability || {}),
            headline: normalizePlanText(parsed?.suitability?.headline || fallbackSuitability.headline),
            summary: normalizePlanText(parsed?.suitability?.summary || fallbackSuitability.summary),
            strengths: toTextArray(parsed?.suitability?.strengths || fallbackSuitability.strengths).slice(0, 4),
            risks: toTextArray(parsed?.suitability?.risks || fallbackSuitability.risks).slice(0, 4),
            action_focus: toTextArray(parsed?.suitability?.action_focus || fallbackSuitability.action_focus).slice(0, 5),
        };
        const fallbackSeedQuestions = normalizeInterviewQuestions([
            { question: 'Can you introduce yourself in one minute and explain why you want this remote role?', focus: '英文自我介绍', hint: '先讲当前职责，再讲远程求职动机。' },
            { question: 'Tell me about a project where you solved a difficult problem with cross-functional teammates.', focus: '项目经历', hint: '使用 STAR 结构并量化结果。' },
            { question: 'How do you stay aligned with teammates when working asynchronously?', focus: '远程协作', hint: '强调文档、同步机制和反馈节奏。' },
            { question: 'What makes you a strong fit for this position?', focus: '岗位匹配度', hint: '把你的经验和岗位要求逐项对应。' },
            { question: 'How do you handle communication challenges in English during meetings or interviews?', focus: '英文表达', hint: '说明你的准备方式和应对策略。' },
            { question: 'What backend or product decisions are you most proud of, and why?', focus: '专业能力', hint: '强调判断过程和业务结果。' },
            { question: 'How do you prioritise tasks when multiple deadlines arrive at the same time?', focus: '优先级判断', hint: '说明方法论和沟通方式。' },
            { question: 'Describe a time when you received critical feedback and improved your work.', focus: '反馈迭代', hint: '突出复盘与成长。' },
            { question: 'What does effective remote collaboration look like to you?', focus: '远程工作认知', hint: '回答流程、透明度和信任机制。' },
            { question: 'What result from your previous work would you highlight to an international hiring manager?', focus: '结果表达', hint: '优先选择最量化、最有代表性的成果。' },
        ]).slice(0, questionLimit);
        const questions = normalizeInterviewQuestions(parsed?.english_interview?.questions || []).slice(0, questionLimit);
        const finalQuestions = questions.length > 0 ? questions : fallbackSeedQuestions;
        const planData = {
            plan_version: 'copilot_plan_v3',
            generated_at: new Date().toISOString(),
            defaults,
            goal_context: {
                job_direction: normalizePlanText(parsed?.goal_context?.job_direction || direction),
                position_type: normalizePlanText(parsed?.goal_context?.position_type || positionTypeLabel),
                has_resume: Boolean(resumeStructured),
            },
            readiness: readiness?.remote_readiness_score,
            remoteReadiness: readiness ? {
                score: readiness.remote_readiness_score,
                level: readiness.readiness_level,
            } : undefined,
            summary: suitability.summary,
            suitability,
            english_interview: {
                summary: normalizePlanText(parsed?.english_interview?.summary || (Boolean(resumeStructured)
                    ? '以下问题已结合你的目标方向与简历背景生成，建议优先练习前 5 题。'
                    : '当前未检测到简历，以下为基于目标方向生成的通用版英文面试提纲。')),
                question_limit: questionLimit,
                member_maximum: 30,
                resume_personalized: Boolean(resumeStructured),
                questions: finalQuestions,
            },
        };

        planData.interviewPrep = {
            focusAreas: finalQuestions.map((item) => item.focus).filter(Boolean).slice(0, 5),
            sampleQA: finalQuestions.map((item) => ({ question: item.question })),
            languageTip: planData.english_interview.summary,
        };
        planData.phases = buildPlanPhases(planData, timelineWeeks);

        try {
            await upsertUserState(userId, {
                plan_data: planData,
                current_phase: planData.phases?.[0]?.phase_key || 'resume',
            });
        } catch (e) {
            console.warn('[Copilot V1.3] create-plan state persistence skipped:', e.message);
        }

        try {
            if (await hasCopilotTasksTable()) {
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
            }
        } catch (e) {
            console.warn('[Copilot V1.3] create-plan task sync skipped:', e.message);
        }

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

export async function handleGenerateInterviewPlan(userId, body = {}) {
    const state = await handleGetState(userId);
    const planData = state?.state?.planData || null;
    const readiness = state?.state?.readinessData || null;
    const structured = state?.state?.resumeStructured || null;
    const existingQuestions = normalizeInterviewQuestions(body?.existingQuestions || planData?.english_interview?.questions || []);
    const remaining = Math.max(0, 30 - existingQuestions.length);

    if (remaining <= 0) {
        return { success: true, questions: existingQuestions, total: existingQuestions.length, maxQuestions: 30, hasMore: false };
    }

    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 10, 5), remaining);
    const direction = String(body?.jobDirection || planData?.goal_context?.job_direction || structured?.roles?.[0] || '远程目标岗位').trim();
    const positionType = String(body?.positionType || planData?.goal_context?.position_type || '远程岗位').trim();
    const existingBlock = existingQuestions.map((item) => item.question).join('；');

    const prompt = `请继续为用户补充英文面试问题，全部使用简体中文说明字段，但 question 必须是英文面试题目本身。

用户方向：${direction}
岗位类型：${positionType}
远程适配评分：${readiness?.remote_readiness_score || '未评估'}
简历角色：${Array.isArray(structured?.roles) ? structured.roles.join('、') : '未提供'}
简历技能：${Array.isArray(structured?.skills) ? structured.skills.join('、') : '未提供'}
已有问题（避免重复）：${existingBlock || '暂无'}

请新增 ${batchSize} 道不重复的问题，覆盖项目经历、协作沟通、业务判断、英文表达、岗位专业能力。

输出 JSON：
{
  "questions": [
    {
      "question": "英文问题",
      "focus": "考察重点",
      "hint": "回答提示"
    }
  ]
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, body?.__isMember ? 'qwen-max' : 'qwen-plus', 1200);
    const fallbackQuestions = [
        { question: 'How do you prioritise backend work when product requirements change quickly?', focus: '优先级判断', hint: '突出取舍标准、风险意识与沟通方式。' },
        { question: 'Tell me about a time you improved reliability or observability in a production system.', focus: '项目深度', hint: '用问题、动作、结果三段式回答。' },
        { question: 'How do you collaborate with product and frontend teams in a remote environment?', focus: '远程协作', hint: '强调异步沟通、文档与反馈节奏。' },
        { question: 'What trade-offs do you usually consider when designing a scalable backend service?', focus: '技术判断', hint: '从性能、复杂度、成本与迭代速度展开。' },
        { question: 'Why are you specifically interested in this remote role right now?', focus: '求职动机', hint: '把职业目标和岗位要求对齐。' },
    ];

    let addedQuestions = [];
    if (raw) {
        try {
            addedQuestions = normalizeInterviewQuestions(parseAIJSON(raw)?.questions || [], existingQuestions.length + 1);
        } catch (e) {
            console.warn('[Copilot V1.3] interview-prep parse fallback:', e.message);
        }
    }
    if (!addedQuestions.length) {
        addedQuestions = normalizeInterviewQuestions(fallbackQuestions, existingQuestions.length + 1).slice(0, batchSize);
    }

    const deduped = [];
    const seen = new Set(existingQuestions.map((item) => item.question.toLowerCase()));
    for (const item of addedQuestions) {
        const key = item.question.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
        }
    }

    const mergedQuestions = [...existingQuestions, ...deduped].slice(0, 30).map((item, idx) => ({
        ...item,
        id: item.id || `q${idx + 1}`,
    }));

    let updatedPlan = null;
    if (planData) {
        updatedPlan = {
            ...planData,
            english_interview: {
                ...(planData.english_interview || {}),
                member_maximum: 30,
                question_limit: mergedQuestions.length,
                questions: mergedQuestions,
            },
            interviewPrep: {
                ...(planData.interviewPrep || {}),
                focusAreas: mergedQuestions.map((item) => item.focus).filter(Boolean).slice(0, 6),
                sampleQA: mergedQuestions.map((item) => ({ question: item.question })),
            },
        };
        updatedPlan.phases = buildPlanPhases(updatedPlan, timelineToWeeks(updatedPlan?.defaults?.preparation_time));
        try {
            await upsertUserState(userId, {
                plan_data: updatedPlan,
                current_phase: updatedPlan.phases?.[0]?.phase_key || 'resume',
            });
            await insertCopilotSessionWithFallback({
                userId,
                goal: body?.goal || planData?.goal_context?.position_type || 'plan',
                timeline: updatedPlan?.defaults?.preparation_time || '',
                background: {
                    industry: updatedPlan?.goal_context?.job_direction,
                    availability: updatedPlan?.defaults?.weekly_commitment,
                },
                planData: updatedPlan,
                module: 'plan'
            });
        } catch (e) {
            console.warn('[Copilot V1.3] interview-prep persistence skipped:', e.message);
        }
    }

    return {
        success: true,
        questions: mergedQuestions,
        addedQuestions: deduped,
        total: mergedQuestions.length,
        maxQuestions: 30,
        hasMore: mergedQuestions.length < 30,
        planData: updatedPlan,
    };
}

export async function handleGenerateAnswer(userId, body = {}) {
    const question = String(body?.question || '').trim();
    if (!question) {
        return { error: 'question 为必填参数' };
    }

    const state = await handleGetState(userId);
    const readiness = state?.state?.readinessData || null;
    const structured = state?.state?.resumeStructured || null;

    const prompt = `请基于用户远程求职背景，为下面的英文面试问题生成一版可直接练习的英文回答草稿，并给出中文提示。

问题：${question}
目标岗位：${body?.jobTitle || '远程目标岗位'}
用户技能：${Array.isArray(structured?.skills) ? structured.skills.join('、') : '未提供'}
用户经历方向：${Array.isArray(structured?.roles) ? structured.roles.join('、') : '未提供'}
远程适配评分：${readiness?.remote_readiness_score || '未评估'}

输出 JSON：
{
  "answer": "<120-220词英文回答草稿>",
  "highlights": ["<中文亮点1>", "<中文亮点2>"],
  "followUp": "<中文补充建议>"
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, body?.__isMember ? 'qwen-max' : 'qwen-plus', 800);
    if (!raw) {
        return {
            success: true,
            answer: 'I would answer this with a STAR structure: first explain the context and goal, then describe the actions you personally drove, and finally close with measurable results and how you coordinated remotely with stakeholders.',
            highlights: ['使用量化结果', '突出跨团队协作'],
            followUp: '补充一个能体现远程沟通或异步协作能力的案例。'
        };
    }

    try {
        const parsed = parseAIJSON(raw);
        return { success: true, ...parsed };
    } catch {
        return {
            success: true,
            answer: raw,
            highlights: ['回答已生成'],
            followUp: '建议再补充量化结果与岗位相关细节。'
        };
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

    if (!(await hasCopilotTasksTable())) {
        return { error: '当前环境暂未启用任务进度功能' };
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
