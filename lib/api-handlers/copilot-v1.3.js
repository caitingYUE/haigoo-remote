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
import { callBailianAPI } from '../bailian-parser.js';
import { calculateSimilarity } from '../services/job-sync-service.js';
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
    const rows = await neonHelper.query(
        `SELECT * FROM copilot_user_state WHERE user_id = $1`, [userId]
    );

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
  "career_level": "",
  "years_of_experience": "",
  "industries": [],
  "roles": [],
  "skills": [],
  "tools": [],
  "achievements_with_metrics": [],
  "management_experience": true,
  "english_related_experience": [],
  "remote_related_experience": []
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 1000);
    if (!raw) return { error: 'AI 处理失败，请稍后重试' };

    try {
        const structured = parseAIJSON(raw);

        // 3. Save to state
        const currentState = await neonHelper.query(
            `SELECT resume_version FROM copilot_user_state WHERE user_id = $1`, [userId]
        );
        const currentVersion = currentState?.[0]?.resume_version || 0;

        await upsertUserState(userId, {
            resume_structured: structured,
            resume_version: currentVersion + 1,
        });

        // 4. Log to sessions
        await neonHelper.query(
            `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial, module)
       VALUES ($1, 'extract', '', '{}', $2, false, 'extract')`,
            [userId, JSON.stringify(structured)]
        );

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
    }

    // 2. Get resume structured data if available
    const stateRows = await neonHelper.query(
        `SELECT resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
    );
    const resumeStructured = stateRows?.[0]?.resume_structured;

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
  "remote_readiness_score": 0,
  "readiness_level": "low / medium / high",
  "strengths": [
    {"point": "...", "reason": "..."}
  ],
  "gaps": [
    {"gap": "...", "impact": "..."}
  ],
  "priority_improvements": [
    {"action": "...", "expected_benefit": "..."}
  ],
  "estimated_offer_time_if_execute_well": "时间预估"
}`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 800);
    if (!raw) return { error: 'AI 评估失败，请稍后重试' };

    try {
        const readiness = parseAIJSON(raw);

        // 4. Save to state
        await upsertUserState(userId, {
            readiness_data: readiness,
            readiness_generated_at: new Date().toISOString(),
        });

        // 5. Log
        await neonHelper.query(
            `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial, module)
       VALUES ($1, $2, $3, $4, $5, false, 'assess')`,
            [userId, goal, timeline, JSON.stringify(background), JSON.stringify(readiness)]
        );

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
    const stateRows = await neonHelper.query(
        `SELECT resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
    );
    const structured = stateRows?.[0]?.resume_structured;

    if (!structured) {
        return { error: '请先完成简历解析（extract-resume），再进行岗位匹配' };
    }

    // 2. Build search keywords from structured data
    const searchTerms = [
        ...(structured.roles || []),
        ...(structured.skills || []).slice(0, 8),
        ...(structured.industries || []),
    ].filter(Boolean).map(s => s.toLowerCase());

    if (searchTerms.length === 0) {
        return { error: '简历信息不足，无法进行匹配' };
    }

    // 3. Search DB with expanded pool (only title + category for performance, avoid LIKE on description)
    const likeTerms = searchTerms.map(k => `%${k}%`);
    const conditions = likeTerms
        .map((_, i) => `(LOWER(title) LIKE $${i + 1} OR LOWER(category) LIKE $${i + 1})`)
        .join(' OR ');

    let rows = [];
    try {
        rows = await neonHelper.query(
            `SELECT job_id, title, company, category, location, job_type,
              experience_level, salary, description, published_at
       FROM jobs
       WHERE status = 'active' AND is_approved = true AND (${conditions})
       ORDER BY published_at DESC LIMIT 60`,
            likeTerms
        ) || [];
    } catch (e) {
        console.warn('[Copilot V1.3] match-jobs query error:', e.message);
    }

    // Fallback if no results
    if (rows.length === 0) {
        rows = await neonHelper.query(
            `SELECT job_id, title, company, category, location, job_type,
              experience_level, salary, description, published_at
       FROM jobs WHERE status = 'active' AND is_approved = true
       ORDER BY published_at DESC LIMIT 30`
        ) || [];
    }

    // 4. Enhanced scoring: Jaccard + skill keyword hits
    const userProfile = [
        ...(structured.roles || []),
        ...(structured.skills || []),
        ...(structured.tools || []),
        ...(structured.industries || []),
    ].join(' ').toLowerCase();

    const userSkills = (structured.skills || []).map(s => s.toLowerCase());

    const scored = rows.map(job => {
        const jobText = `${job.title} ${job.category || ''} ${(job.description || '').substring(0, 600)}`.toLowerCase();

        // Jaccard similarity
        const jaccard = calculateSimilarity(userProfile, jobText);

        // Skill keyword hits
        let skillHits = 0;
        for (const skill of userSkills) {
            if (jobText.includes(skill)) skillHits++;
        }
        const skillScore = userSkills.length > 0 ? skillHits / userSkills.length : 0;

        // Combined: 60% Jaccard + 40% skill hits
        const score = jaccard * 0.6 + skillScore * 0.4;

        return { job, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top20 = scored.slice(0, 20);

    // 5. Cache results in copilot_job_matches (batch insert for performance)
    try {
        await neonHelper.query(`DELETE FROM copilot_job_matches WHERE user_id = $1`, [userId]);

        if (top20.length > 0) {
            const insertValues = [];
            const insertParams = [];
            let pIdx = 1;
            for (const { job, score } of top20) {
                insertValues.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2})`);
                insertParams.push(userId, job.job_id, Math.round(score * 100));
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

    // 6. Return formatted results
    const results = top20.map(({ job, score }) => ({
        jobId: job.job_id,
        title: job.title,
        company: job.company,
        category: job.category,
        location: job.location || 'Remote',
        jobType: job.job_type,
        experienceLevel: job.experience_level,
        salary: job.salary || 'Competitive',
        matchScore: Math.round(score * 100),
        publishedAt: job.published_at,
    }));

    return { success: true, matches: results, total: results.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: create-plan (M3 - Action Plan Generation)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleCreatePlan(userId, body) {
    const { goal, timeline, investedHours } = body;

    // 1. Get readiness data and structured resume
    const stateRows = await neonHelper.query(
        `SELECT readiness_data, resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
    );
    const state = stateRows?.[0];
    const readiness = state?.readiness_data;
    const resumeStructured = state?.resume_structured;

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

    // 2. Build prompt with real data
    const gapsBlock = readiness?.gaps
        ? `核心差距：${readiness.gaps.map(g => g.gap || g).join('、')}`
        : '核心差距：暂无评估数据';

    const skillsBlock = resumeStructured?.skills
        ? `已有技能：${resumeStructured.skills.join('、')}`
        : '';

    const rolesBlock = resumeStructured?.roles
        ? `过往角色：${resumeStructured.roles.join('、')}`
        : '';

    // Calculate number of phases based on timeline
    const phaseCount = timelineWeeks <= 4 ? 3 : timelineWeeks <= 12 ? 4 : timelineWeeks <= 16 ? 5 : 7;
    const weeksPerPhase = Math.ceil(timelineWeeks / phaseCount);

    const prompt = `你是一名专业远程求职规划师。根据用户目标与时间规划，生成【关键行动路线图】。

用户信息：
目标：${goalLabel}
时间规划：总计 ${timelineWeeks} 周
每周可投入时间：${investedHours || '未指定'}
远程适配评分：${readiness?.remote_readiness_score || readiness?.score || '未评估'}
${gapsBlock}
${skillsBlock}
${rolesBlock}

设计要求：
1. 按时间轴倒推：从目标拿到 offer 的时间节点，向前规划每个阶段
2. 生成 ${phaseCount} 个关键行动节点（第1周到第${timelineWeeks}周），每个节点代表一个具体的突破目标
3. 节点要递进增强：从"基础建设"→"精准投递"→"面试突破"→"拿到Offer"
4. 每个阶段的任务必须非常具体可执行，包含动词+细节（如"重写简历中的3个项目描述，加入数据指标"）
5. 任务密度根据每周投入时间合理分配

输出JSON（请严格使用 phases 作为数组键名）：
{
  "phases": [
    {
      "phase_name": "第X-Y周：[具体阶段目标，如：简历重塑与远程基建]",
      "phase_key": "[关键词，如：resume/apply/interview/network/english]",
      "duration_weeks": [具体周数数字],
      "focus": "本阶段核心破局点（1句话）",
      "tasks": [
        {
          "task_name": "非常具体的可执行任务（如：整理3个项目英文STAR故事，每个不超过90秒口述）",
          "type": "resume / apply / network / interview / english",
          "priority": "high / medium / low"
        }
      ]
    }
  ]
}

要求：只输出纯JSON，不附带任何解释文本。phases 数组包含 ${phaseCount} 个阶段。每个阶段 tasks 3-5 条，均为高度可执行的具体动作。`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-plus', 1500);
    if (!raw) return { error: '计划生成失败，请稍后重试' };

    try {
        let planData = parseAIJSON(raw);

        // Compatibility layer: if AI outputs 'milestones' instead of 'phases', remap
        if (!planData.phases && planData.milestones) {
            planData.phases = planData.milestones;
            delete planData.milestones;
        }

        // Ensure phase_key exists for each phase
        const phaseKeyFallbacks = ['resume', 'apply', 'interview', 'network', 'english', 'offer', 'review'];
        if (Array.isArray(planData.phases)) {
            planData.phases = planData.phases.map((phase, idx) => ({
                ...phase,
                phase_key: phase.phase_key || phaseKeyFallbacks[idx] || `phase${idx + 1}`,
            }));
        }

        // 3. Save plan to state
        await upsertUserState(userId, {
            plan_data: planData,
            current_phase: planData.phases?.[0]?.phase_key || 'resume',
        });

        // 4. Create tasks in copilot_tasks
        await neonHelper.query(`DELETE FROM copilot_tasks WHERE user_id = $1`, [userId]);

        for (const phase of (planData.phases || [])) {
            for (const task of (phase.tasks || [])) {
                await neonHelper.query(
                    `INSERT INTO copilot_tasks (user_id, phase, task_name, priority)
           VALUES ($1, $2, $3, $4)`,
                    [userId, phase.phase_key || task.type || 'general', task.task_name, task.priority || 'medium']
                );
            }
        }

        // 5. Log
        await neonHelper.query(
            `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial, module)
       VALUES ($1, $2, $3, '{}', $4, false, 'plan')`,
            [userId, goal, timeline, JSON.stringify(planData)]
        );

        return { success: true, planData };
    } catch (e) {
        console.error('[Copilot V1.3] create-plan parse error:', e.message);
        return { error: '计划解析失败，请重试' };
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// ACTION: generate-interview-plan (M6 - 10 English Interview Questions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the goal-dynamic "motivation" question type (type 3) based on user goal.
 */
function buildMotivationQuestionType(goal, role) {
    const goalMotivations = {
        'full-time': `求职动机/全职转型 (Career Motivation): Why are you seeking a full-time remote position?`,
        'part-time': `兼职/副业动机 (Side Income Motivation): Why are you looking for a part-time or contract remote role alongside your current job?`,
        'freelance': `转型动机 (Career Pivot): Why are you pivoting your career, and how does remote work fit into your transition?`,
        'market-watch': `探索动机 (Exploration): What's driving your interest in exploring remote work opportunities right now?`,
    };
    return goalMotivations[goal] || `职业动机 (Career Motivation): Why are you pursuing remote work in the ${role || 'tech'} field?`;
}

/**
 * Generates 10 English interview questions for the user's role, goal, and background.
 * Uses the 7-category framework from the question type matrix, dynamically adapting
 * question types 3 (motivation - based on goal) and 5 (domain - based on role/industry).
 */
export async function handleGenerateInterviewPlan(userId, body) {
    const { goal, role, seniority, language, industry } = body;

    // Get resume and readiness data for personalization
    const stateRows = await neonHelper.query(
        `SELECT resume_structured, readiness_data FROM copilot_user_state WHERE user_id = $1`, [userId]
    );
    const state = stateRows?.[0];
    const resumeStructured = state?.resume_structured;
    const readiness = state?.readiness_data;

    const targetRole = role || resumeStructured?.roles?.[0] || '产品/技术岗位';
    const targetIndustry = industry || resumeStructured?.industries?.[0] || '';
    const skills = (resumeStructured?.skills || []).slice(0, 8).join(', ') || '';
    const achievements = (resumeStructured?.achievements_with_metrics || []).slice(0, 3).join('; ') || '';
    const goalLabel = {
        'full-time': '全职远程',
        'part-time': '兼职/副业',
        'freelance': '职业转型',
        'market-watch': '探索远程机会',
    }[goal] || '远程求职';

    // Dynamic question type 3: based on goal
    const motivationType = buildMotivationQuestionType(goal, targetRole);

    // Dynamic question type 5: domain questions based on actual role/industry
    const domainContext = targetIndustry
        ? `${targetRole}（${targetIndustry}行业）`
        : targetRole;

    const prompt = `你是一名专业英文面试教练。根据候选人背景，生成10道实战英文面试题。

候选人信息：
求职目标：${goalLabel} ${targetRole}
资历：${seniority || '中级'}
英语水平：${language || '商务英语'}
核心技能：${skills || '未提取'}
量化成就：${achievements || '未提取'}
目标行业：${targetIndustry || '通用'}

严格按照以下7个类型分布生成10道题（每类1-2道）：
1. 自我介绍 (Self-Introduction) — 1道
2. 项目经历 (Project Experience) — 2道（使用STAR结构）
3. ${motivationType} — 1道
4. 行为问题 (Behavioral) — 2道（冲突/压力/团队合作）
5. 专业领域 (Domain-Specific for ${domainContext}) — 2道（结合具体行业和角色）
6. 未来规划 (Future Planning) — 1道
7. 反问面试官 (Questions for Interviewer) — 1道

输出JSON：
{
  "questions": [
    {
      "index": 1,
      "questionType": "自我介绍 / Self-Introduction",
      "question": "Can you introduce yourself in 2 minutes?",
      "why": "面试官在此题考察的核心点",
      "answerHint": "结合用户背景的个性化回答提示（中文）"
    }
  ]
}

要求：
1. questions 数组必须有10道题，按上方类型顺序排列
2. 专业领域问题必须根据 ${domainContext} 量身定制，不要用通用模板
3. 每道题的 answerHint 要结合候选人实际技能（${skills || '通用技能'}）给出个性化建议
4. 只输出JSON，不要任何解释文字`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-max', 2500);
    if (!raw) return { error: '面试方案生成失败，请稍后重试' };

    try {
        const parsed = parseAIJSON(raw);
        const questions = parsed?.questions || [];

        // Save to user state for later per-question answer generation
        await upsertUserState(userId, {
            interview_plan: { questions, generatedAt: new Date().toISOString(), goal, role: targetRole },
        }).catch(() => { }); // Non-fatal if column doesn't exist yet

        return { success: true, questions, total: questions.length };
    } catch (e) {
        console.error('[Copilot V1.3] generate-interview-plan parse error:', e.message);
        return { error: '面试题生成结果解析失败，请重试' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: generate-answer (per-question STAR personalized answer)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGenerateAnswer(userId, body) {
    const { question, questionType, questionIndex, role, seniority, goal } = body;

    if (!question) {
        return { error: '请提供具体的面试题目' };
    }

    // Get resume data for personalization
    const stateRows = await neonHelper.query(
        `SELECT resume_structured FROM copilot_user_state WHERE user_id = $1`, [userId]
    );
    const resumeStructured = stateRows?.[0]?.resume_structured;
    const skills = (resumeStructured?.skills || []).slice(0, 8).join(', ') || '';
    const achievements = (resumeStructured?.achievements_with_metrics || []).slice(0, 3).join('; ') || '';
    const roles = (resumeStructured?.roles || []).slice(0, 3).join(', ') || role || '';
    const industries = (resumeStructured?.industries || []).slice(0, 2).join(', ') || '';

    const targetRole = role || resumeStructured?.roles?.[0] || '求职者';
    const goalLabel = {
        'full-time': '全职远程',
        'part-time': '兼职/副业',
        'freelance': '职业转型',
    }[goal] || '远程求职';

    const prompt = `你是一名英文面试教练。为以下面试题生成个性化回答指导。

面试题：${question}
题目类型：${questionType || '综合'}
候选人角色：${targetRole}（${seniority || '中级'}）
求职目标：${goalLabel}
核心技能：${skills || '未知'}
量化成就：${achievements || '未知'}
过往角色：${roles}
行业背景：${industries || '通用'}

要求：
1. 回答必须紧扣候选人实际背景（技能/成就/角色）
2. 使用STAR结构（Situation/Task/Action/Result）
3. 英文回答示例控制在60-90字内（口语化，可实际使用）
4. 给出中文拆解和提升技巧

输出JSON：
{
  "sampleAnswer": "A concise English sample answer (60-90 words, conversational tone)",
  "starBreakdown": {
    "situation": "场景背景建议（中文，1-2句）",
    "task": "任务/挑战描述建议（中文，1句）",
    "action": "关键行动建议，结合候选人技能（中文，2-3句）",
    "result": "量化结果表达建议（中文，1-2句）"
  },
  "tips": ["进阶建议1", "进阶建议2"],
  "commonMistakes": ["常见误区1"]
}

只输出JSON，不要解释文字。`;

    const raw = await callModel(prompt, SYSTEM_PROMPT_JSON, 'qwen-max', 1200);
    if (!raw) return { error: '参考回答生成失败，请稍后重试' };

    try {
        const parsed = parseAIJSON(raw);
        return {
            success: true,
            question,
            questionIndex,
            questionType,
            ...parsed,
        };
    } catch (e) {
        console.error('[Copilot V1.3] generate-answer parse error:', e.message);
        return { error: '回答生成结果解析失败，请重试' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION: update-progress (M3 - Task Progress)
// ═══════════════════════════════════════════════════════════════════════════


export async function handleUpdateProgress(userId, body) {
    const { taskId, taskName, phase, status } = body; // status: 'completed' | 'in_progress' | 'skipped'

    if ((!taskId && (!taskName || !phase)) || !status) {
        return { error: 'taskId 或 (taskName+phase) 和 status 为必填参数' };
    }

    // 1. Update or Insert task status
    if (taskId) {
        await neonHelper.query(
            `UPDATE copilot_tasks SET status = $1, completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}
             WHERE id = $2 AND user_id = $3`,
            [status, taskId, userId]
        );
    } else {
        // Search if it exists
        const existing = await neonHelper.query(
            `SELECT id FROM copilot_tasks WHERE user_id = $1 AND phase = $2 AND task_name = $3 LIMIT 1`,
            [userId, phase, taskName]
        );
        if (existing && existing.length > 0) {
            await neonHelper.query(
                `UPDATE copilot_tasks SET status = $1, completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}
                 WHERE id = $2`,
                [status, existing[0].id]
            );
        } else {
            // Insert new ad-hoc tracking record
            await neonHelper.query(
                `INSERT INTO copilot_tasks (user_id, phase, task_name, status, priority, completed_at)
                 VALUES ($1, $2, $3, $4, 'medium', ${status === 'completed' ? 'NOW()' : 'NULL'})`,
                [userId, phase, taskName, status]
            );
        }
    }

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
                const prompt = `根据用户当前完成情况更新下一阶段建议。

当前阶段：${p.phase}
已完成/总任务：${p.done}/${p.total}

输出JSON：
{
  "next_focus": "",
  "adjustment_suggestions": [],
  "motivation_message": ""
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
