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

    // Also fetch pending tasks
    let tasks = [];
    if (state) {
        tasks = await neonHelper.query(
            `SELECT id, phase, task_name, priority, status, completed_at
       FROM copilot_tasks WHERE user_id = $1 ORDER BY id`, [userId]
        ) || [];
    }

    // Fetch latest job matches
    let jobMatches = [];
    if (state) {
        jobMatches = await neonHelper.query(
            `SELECT cjm.job_id, cjm.match_score, cjm.match_reason,
              j.title, j.company, j.category, j.location, j.job_type, j.salary
       FROM copilot_job_matches cjm
       LEFT JOIN jobs j ON j.job_id = cjm.job_id
       WHERE cjm.user_id = $1
       ORDER BY cjm.match_score DESC LIMIT 20`, [userId]
        ) || [];
    }

    return {
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
        const matched = resumes.find(r => r.id === resumeId);
        if (matched) {
            resumeText = matched.contentText || matched.parseResult?.text || '';
            if (resumeText.length > 4000) resumeText = resumeText.substring(0, 4000);
        }
    } catch (e) {
        console.warn('[Copilot V1.3] Failed to fetch resume:', e.message);
    }

    if (!resumeText) {
        return { error: '未找到简历内容，请先上传简历' };
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

    // 3. Search DB with expanded pool
    const likeTerms = searchTerms.map(k => `%${k}%`);
    const conditions = likeTerms
        .map((_, i) => `(LOWER(title) LIKE $${i + 1} OR LOWER(category) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`)
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

    // 5. Cache results in copilot_job_matches
    try {
        // Clear old matches
        await neonHelper.query(`DELETE FROM copilot_job_matches WHERE user_id = $1`, [userId]);

        // Insert new matches
        for (const { job, score } of top20) {
            await neonHelper.query(
                `INSERT INTO copilot_job_matches (user_id, job_id, match_score)
         VALUES ($1, $2, $3)`,
                [userId, job.job_id, Math.round(score * 100)]
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
    const { goal, timeline } = body;

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
        ? `核心差距：${readiness.gaps.map(g => g.gap).join('、')}`
        : '核心差距：暂无评估数据';

    const skillsBlock = resumeStructured?.skills
        ? `已有技能：${resumeStructured.skills.join('、')}`
        : '';

    const prompt = `根据用户目标与时间规划，生成阶段性远程求职行动计划。

用户信息：
目标：${goalLabel}
时间规划：${timelineWeeks}周
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
        await upsertUserState(userId, {
            plan_data: planData,
            current_phase: planData.phases?.[0]?.phase_key || 'resume',
        });

        // 4. Create tasks in copilot_tasks
        // Clear existing tasks first
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
// ACTION: update-progress (M3 - Task Progress)
// ═══════════════════════════════════════════════════════════════════════════

export async function handleUpdateProgress(userId, body) {
    const { taskId, status } = body; // status: 'completed' | 'in_progress' | 'skipped'

    if (!taskId || !status) {
        return { error: 'taskId 和 status 为必填参数' };
    }

    // 1. Update task status
    const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
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
