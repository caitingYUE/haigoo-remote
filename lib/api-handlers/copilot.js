
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { callBailianAPI } from '../bailian-parser.js';
import { calculateSimilarity } from '../services/job-sync-service.js';
import { getUserProfileForMatching, scoreJobForUserProfile } from '../services/matching-engine.js';
import { getResumes } from '../../server-utils/resume-storage.js';
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js';

// V1.3 Modular Handlers
import {
  handleGetState,
  handleExtractResume,
  handleAssess,
  handleMatchJobs,
  handleCreatePlan,
  handleUpdateProgress,
} from './copilot-v1.3.js';

const MATCH_DISPLAY_FLOOR = 45;
const MATCH_HIGH_THRESHOLD = 78;
const MATCH_MEDIUM_THRESHOLD = 62;
const RECOMMENDATION_CACHE_TTL = 5 * 60 * 1000;
const RECOMMENDATION_CACHE_MAX_ENTRIES = 300;

if (!globalThis.__haigoo_copilot_recommendation_cache) {
  globalThis.__haigoo_copilot_recommendation_cache = new Map();
}
const RECOMMENDATION_CACHE = globalThis.__haigoo_copilot_recommendation_cache;

function resolveMatchLevel(score) {
  const n = Number(score) || 0;
  if (n < MATCH_DISPLAY_FLOOR) return 'none';
  if (n >= MATCH_HIGH_THRESHOLD) return 'high';
  if (n >= MATCH_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

function resolveMatchLabel(level) {
  if (level === 'high') return '高匹配';
  if (level === 'medium') return '中匹配';
  if (level === 'low') return '低匹配';
  return '';
}

function normalizeBreakdown(details = {}) {
  const raw = details?.breakdown || details || {};
  return {
    skillMatch: Math.max(0, Math.min(100, Math.round(Number(raw.skillMatch) || 0))),
    keywordSimilarity: Math.max(0, Math.min(100, Math.round(Number(raw.keywordSimilarity) || 0))),
    experienceMatch: Math.max(0, Math.min(100, Math.round(Number(raw.experienceMatch) || 0))),
    preferenceMatch: Math.max(0, Math.min(100, Math.round(Number(raw.preferenceMatch) || 0))),
  };
}

function buildCopilotMatchDetails({ score = 0, details = {}, row = {} }) {
  const breakdown = normalizeBreakdown(details);
  const strengths = [];
  const suggestions = [];

  if (breakdown.skillMatch >= 72) strengths.push('核心技能贴合岗位要求');
  if (breakdown.keywordSimilarity >= 68) strengths.push('简历关键词与JD一致性较高');
  if (breakdown.experienceMatch >= 70) strengths.push('经验层级匹配岗位预期');
  if (breakdown.preferenceMatch >= 65) strengths.push('岗位类型与求职偏好一致');

  if (breakdown.skillMatch < 60) suggestions.push('补齐岗位关键技能与项目成果表达');
  if (breakdown.keywordSimilarity < 55) suggestions.push('增强与JD一致的关键词覆盖');
  if (breakdown.experienceMatch < 55) suggestions.push('突出可迁移经验与相关案例');

  const roleHint = row?.title || row?.category || '该岗位';
  const level = resolveMatchLevel(score);
  const summary = `${roleHint} 属于${resolveMatchLabel(level) || '可尝试'}岗位。${strengths.length ? `主要优势：${strengths.slice(0, 2).join('、')}。` : ''}${suggestions.length ? `建议：${suggestions[0]}。` : ''}`.trim();

  return {
    summary,
    strengths: strengths.slice(0, 3),
    suggestions: suggestions.slice(0, 2),
    breakdown,
    updatedAt: new Date().toISOString()
  };
}

function createRecommendationCacheKey({ userId, role = '', seniority = '', goal = '', topN = 5, isMember = false }) {
  if (!userId) return '';
  return [
    String(userId),
    String(role || '').trim().toLowerCase(),
    String(seniority || '').trim().toLowerCase(),
    String(goal || '').trim().toLowerCase(),
    Number(topN) || 5,
    isMember ? 'member' : 'free'
  ].join('::');
}

function getCachedRecommendations(key) {
  if (!key) return null;
  const cached = RECOMMENDATION_CACHE.get(key);
  if (!cached) return null;
  if ((Date.now() - cached.cachedAt) > RECOMMENDATION_CACHE_TTL) {
    RECOMMENDATION_CACHE.delete(key);
    return null;
  }
  return JSON.parse(JSON.stringify(cached.data || []));
}

function setCachedRecommendations(key, data) {
  if (!key || !Array.isArray(data)) return;
  if (RECOMMENDATION_CACHE.size >= RECOMMENDATION_CACHE_MAX_ENTRIES) {
    const oldestKey = RECOMMENDATION_CACHE.keys().next().value;
    if (oldestKey) {
      RECOMMENDATION_CACHE.delete(oldestKey);
    }
  }
  RECOMMENDATION_CACHE.set(key, { cachedAt: Date.now(), data });
}


/**
 * Remote Work Copilot API Handler
 *
 * Free users  → qwen-plus (max_tokens: 1000) — one-time trial, simplified plan
 * Members     → qwen-max  (max_tokens: 2800) — unlimited, detailed timeline-driven plan
 *                                               + real job matches with similarity scores
 */
export default async function handler(req, res) {
  // Try to get userId from body/query first
  let userId = req.method === 'GET' ? req.query.userId : req.body.userId;

  // If not provided directly, try to extract it from the authorization header if the route is protected
  // Note: For full security, we should verify the JWT and extract the sub/userId.
  // Assuming the client often passes it, but sometimes misses it.
  if (!userId) {
    try {
      const token = extractToken({ headers: req.headers }); // Vercel req object shape
      if (token) {
        const payload = verifyToken(token);
        if (payload && payload.userId) {
          userId = payload.userId;
        }
      }
    } catch (err) {
      console.warn('[Copilot] fallback token extraction failed', err.message);
    }
  }

  const isGuest = !userId;

  if (!neonHelper.isConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // ── GET: Fetch latest session ────────────────────────────────────────────
    if (req.method === 'GET') {
      if (isGuest) {
        return res.status(200).json({ success: true, plan: null });
      }
      const sessionResult = await neonHelper.query(
        `SELECT * FROM copilot_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (sessionResult && sessionResult.length > 0) {
        const session = sessionResult[0];
        return res.status(200).json({
          success: true,
          plan: session.plan_data,
          isTrial: session.is_trial,
          createdAt: session.created_at,
          isHistory: true,
        });
      }
      return res.status(200).json({ success: true, plan: null });
    }

    if (req.method === 'POST') {
      // ── V1.3 Action Router ──────────────────────────────────────────────
      const action = req.body?.action;
      if (action && action !== 'generate') {
        if (isGuest) {
          return res.status(401).json({ error: '请先登录', code: 'LOGIN_REQUIRED' });
        }

        // Member check for premium actions
        let isMemberForAction = false;
        try {
          const userResult = await neonHelper.query(
            `SELECT member_status, member_expire_at FROM users WHERE user_id = $1`, [userId]
          );
          const row = userResult?.[0];
          if (row && (row.member_status === 'active' || row.member_status === 'pro' || row.member_status === 'lifetime')) {
            const expireAt = row.member_expire_at ? new Date(row.member_expire_at) : null;
            isMemberForAction = !expireAt || expireAt > new Date();
          }
        } catch (e) { /* proceed as free user */ }

        if (action === 'refresh-recommendations') {
          const topN = isMemberForAction ? 5 : 3;
          const recommendations = await fetchCandidateJobs({
            userId,
            background: req.body?.background || {},
            goal: req.body?.goal || '',
            topN,
            isMember: isMemberForAction,
            forceRefresh: true
          });

          return res.status(200).json({
            success: true,
            recommendations,
            refreshedAt: new Date().toISOString()
          });
        }

        const memberOnlyActions = ['create-plan', 'update-progress', 'align-resume', 'interview-prep', 'mock-interview'];
        if (memberOnlyActions.includes(action) && !isMemberForAction) {
          return res.status(403).json({
            error: '此功能仅限会员使用',
            code: 'MEMBER_ONLY',
            message: '升级会员以解锁完整 Copilot 功能。',
          });
        }

        try {
          let result;
          switch (action) {
            case 'get-state':
              result = await handleGetState(userId);
              break;
            case 'extract-resume':
              result = await handleExtractResume(userId, req.body.resumeId);
              break;
            case 'assess':
              result = await handleAssess(userId, req.body);
              break;
            case 'match-jobs':
              result = await handleMatchJobs(userId);
              break;
            case 'create-plan':
              result = await handleCreatePlan(userId, req.body);
              break;
            case 'update-progress':
              result = await handleUpdateProgress(userId, req.body);
              break;
            default:
              return res.status(400).json({ error: `Unknown action: ${action}` });
          }
          return res.status(result?.error ? 400 : 200).json(result);
        } catch (e) {
          console.error(`[Copilot V1.3] Action "${action}" error:`, e);
          return res.status(500).json({ error: 'Internal error', detail: e.message });
        }
      }

      // ── Legacy V1.2 Generate Flow (unchanged) ──────────────────────────
      const { goal, timeline, background, resumeId } = req.body;

      let userRow;
      let isMember = false;
      let hasUsedTrial = false;

      if (!isGuest) {
        // 1. Fetch user status gracefully
        try {
          const userResult = await neonHelper.query(
            `SELECT has_used_copilot_trial, member_status, member_expire_at
             FROM users WHERE user_id = $1`,
            [userId]
          );
          userRow = userResult?.[0];
        } catch (err) {
          if (err.message && err.message.includes('has_used_copilot_trial')) {
            console.warn('[Copilot] Column has_used_copilot_trial missing, falling back...');
            const fallbackResult = await neonHelper.query(
              `SELECT member_status, member_expire_at FROM users WHERE user_id = $1`,
              [userId]
            );
            userRow = fallbackResult?.[0];
            if (userRow) userRow.has_used_copilot_trial = false;
          } else {
            throw err;
          }
        }

        if (userRow) {
          // Support both legacy `is_member` boolean and newer `member_status` varchar
          if (userRow.member_status === 'active' || userRow.member_status === 'pro' || userRow.member_status === 'lifetime') {
            const expireAt = userRow.member_expire_at ? new Date(userRow.member_expire_at) : null;
            isMember = !expireAt || expireAt > new Date();
          }
          hasUsedTrial = userRow.has_used_copilot_trial;
        }

        // 2. Permission check
        if (!isMember && hasUsedTrial) {
          return res.status(403).json({
            error: 'Trial limit reached',
            code: 'TRIAL_EXPIRED',
            message: '您的免费生成次数已用完，升级会员获取无限次使用权限。',
          });
        }
      }

      // 3. Fetch resume text if provided (only for logged-in users anyway)
      let resumeText = '';
      if (resumeId && !isGuest) {
        try {
          const { resumes } = await getResumes(userId);
          const matchedResume = resumes.find(r => r.id === resumeId);
          if (matchedResume) {
            resumeText = matchedResume.contentText || matchedResume.parseResult?.text || '';
            if (resumeText.length > 3000) resumeText = resumeText.substring(0, 3000);
          }
        } catch (e) {
          console.warn('[Copilot] Failed to fetch resume text:', e.message);
        }
      }

      // 4. Fetch real candidate jobs from DB & score by similarity
      // Guest: 0 real jobs. Free: 3 real jobs. Pro: 5 real jobs.
      const candidateJobs = await fetchCandidateJobs({
        userId,
        background,
        goal,
        topN: isGuest ? 0 : (isMember ? 5 : 3),
        isMember
      });

      // 5. Generate plan via AI
      const plan = await generateAIPlan(
        { goal, timeline, background, resumeText, candidateJobs },
        isMember,
        isGuest
      );

      // 6. Save session (Bypass if Guest)
      const isTrial = !isMember;
      if (plan && !isGuest) {
        try {
          await neonHelper.query(
            `INSERT INTO copilot_sessions (user_id, goal, timeline, background, plan_data, is_trial)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, goal, timeline, JSON.stringify(background), JSON.stringify(plan), isTrial]
          );
        } catch (err) {
          console.warn('[Copilot] Failed to save session (table may not exist):', err.message);
        }

        // 7. Mark trial consumed for free users
        if (isTrial && !hasUsedTrial) {
          try {
            await neonHelper.query(
              `UPDATE users SET has_used_copilot_trial = true WHERE user_id = $1`,
              [userId]
            );
          } catch (err) {
            console.warn('[Copilot] Failed to update trial status (column may not exist):', err.message);
          }
        }
      }

      return res.status(200).json({ success: true, plan, isTrial });
    }

    // ── OPTIONS: Handle CORS preflight ───────────────────────────────────────
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed` });

  } catch (error) {
    console.error('[Copilot] Error:', error);
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
}

// ── Job Similarity Lookup ────────────────────────────────────────────────────

/**
 * Search DB for jobs relevant to the user's background, then rank by keyword similarity.
 * Returns top N formatted job objects for use in the AI prompt.
 */
async function fetchCandidateJobs({ userId, background = {}, goal = '', topN = 5, isMember = false, forceRefresh = false } = {}) {
  if (!neonHelper.isConfigured || topN <= 0) return [];

  const { industry: role = '', seniority = '' } = background || {};
  const cacheKey = createRecommendationCacheKey({ userId, role, seniority, goal, topN, isMember });
  const cachedRecommendations = forceRefresh ? null : getCachedRecommendations(cacheKey);
  if (cachedRecommendations) {
    return cachedRecommendations;
  }

  try {
    const keywords = role.toLowerCase().split(/[\s/,，]+/).filter(w => w.length > 1);
    const likeTerms = keywords.map(k => `%${k}%`);
    let rows = [];

    if (likeTerms.length > 0) {
      const conditions = likeTerms
        .map((_, i) => `(LOWER(title) LIKE $${i + 1} OR LOWER(category) LIKE $${i + 1})`)
        .join(' OR ');

      rows = await neonHelper.query(
        `SELECT job_id, title, company, category, location, job_type,
                experience_level, salary, description, published_at, tags, is_remote, industry
         FROM jobs
         WHERE status = 'active'
           AND is_approved = true
           AND (${conditions})
         ORDER BY published_at DESC
         LIMIT 80`,
        likeTerms
      ) || [];
    }

    if (!rows.length) {
      rows = await neonHelper.query(
        `SELECT job_id, title, company, category, location, job_type,
                experience_level, salary, description, published_at, tags, is_remote, industry
         FROM jobs
         WHERE status = 'active' AND is_approved = true
         ORDER BY published_at DESC
         LIMIT 50`
      ) || [];
    }

    if (!rows.length) return [];

    if (userId) {
      const userProfile = await getUserProfileForMatching(userId);
      if (userProfile) {
        const personalized = rows.map(job => {
          const result = scoreJobForUserProfile(userProfile, job);
          const score = Math.max(0, Math.min(100, Math.round(Number(result?.totalScore) || 0)));
          const matchLevel = resolveMatchLevel(score);
          const matchDetails = buildCopilotMatchDetails({ score, details: result?.breakdown || {}, row: job });
          return { job, score, matchLevel, matchDetails };
        });

        personalized.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(b.job.published_at).getTime() - new Date(a.job.published_at).getTime();
        });

        const visible = personalized.filter(item => item.matchLevel !== 'none');
        const candidates = visible.slice(0, topN);

        const result = candidates.map(({ job, score, matchLevel, matchDetails }) => ({
          id: job.job_id,
          title: job.title,
          company: job.company,
          category: job.category,
          location: job.location || 'Remote',
          jobType: job.job_type,
          experienceLevel: job.experience_level,
          salary: job.salary || 'Competitive',
          matchScore: score,
          matchLevel,
          matchLabel: resolveMatchLabel(matchLevel),
          matchDetails: isMember && matchLevel === 'high' ? matchDetails : null,
          matchDetailsLocked: !isMember && matchLevel === 'high',
          reason: isMember && matchLevel === 'high'
            ? matchDetails.summary
            : `${job.title} 与你的职业方向相关，建议优先关注并查看岗位职责要求。`
        }));
        setCachedRecommendations(cacheKey, result);
        return result;
      }
    }

    const fallbackResult = rankAndFormat(rows, role, seniority, topN, { isMember });
    setCachedRecommendations(cacheKey, fallbackResult);
    return fallbackResult;
  } catch (e) {
    console.error('[Copilot] fetchCandidateJobs error:', e.message);
    return [];
  }
}

function rankAndFormat(rows, role, seniority, topN, options = {}) {
  const userProfile = `${role} ${seniority}`.toLowerCase();
  const isMember = Boolean(options?.isMember);

  const scored = rows.map(job => {
    const jobText = `${job.title} ${job.category || ''} ${(job.description || '').substring(0, 400)}`;
    const score = Math.round(calculateSimilarity(userProfile, jobText) * 100);
    const matchLevel = resolveMatchLevel(score);
    const matchDetails = buildCopilotMatchDetails({ score, details: {}, row: job });
    return { job, score, matchLevel, matchDetails };
  });

  scored.sort((a, b) => b.score - a.score);
  const visible = scored.filter(item => item.matchLevel !== 'none').slice(0, topN);

  return visible.map(({ job, score, matchLevel, matchDetails }) => ({
    id: job.job_id,
    title: job.title,
    company: job.company,
    category: job.category,
    location: job.location || 'Remote',
    jobType: job.job_type,
    experienceLevel: job.experience_level,
    salary: job.salary || 'Competitive',
    matchScore: score,
    matchLevel,
    matchLabel: resolveMatchLabel(matchLevel),
    matchDetails: isMember && matchLevel === 'high' ? matchDetails : null,
    matchDetailsLocked: !isMember && matchLevel === 'high',
    reason: matchDetails.summary
  }));
}

// ── AI Plan Generation ───────────────────────────────────────────────────────

/**
 * Build and call the Bailian (Qwen) API to generate a personalised plan.
 *
 * Tier differences:
 *   Free  → qwen-plus, 1000 tokens, simplified 3-section output
 *   Member → qwen-max,  2800 tokens, full 4-section output with week-by-week timeline
 */
async function generateAIPlan(inputs, isMember, isGuest) {
  const { goal, timeline, background, resumeText, candidateJobs } = inputs;
  const { education = '', industry: role = '', seniority = '', language = '' } = background || {};

  // ── Map goal to human label ────────────────────────────────────────────
  const goalLabel = {
    'full-time': '找长期全职远程工作，替代或优化现有工作',
    'part-time': '兼职/副业远程增收，在现有收入基础上额外创收',
    'market-watch': '关注远程市场机会，探索阶段暂不确定是否行动',
    'freelance': '职业转型或换赛道，需要重新定位职业方向',
  }[goal] || goal;

  // ── Map timeline to weeks ──────────────────────────────────────────────
  const timelineWeeks = {
    'immediately': 4,
    '1-3 months': 12,
    '3-6 months': 24,
    'flexible': 16,
  }[timeline] || 12;

  // ── Real job context block ─────────────────────────────────────────────
  const jobsBlock = candidateJobs.length > 0
    ? candidateJobs.map((j, i) =>
      `  ${i + 1}. [${j.matchLabel || resolveMatchLabel(j.matchLevel)}] ${j.title} @ ${j.company} (${j.jobType || 'Remote'}, ${j.salary})`
    ).join('\n')
    : '  暂无实时岗位数据，请基于职业画像给出典型岗位推荐。';

  // ── Resume context block ───────────────────────────────────────────────
  const resumeBlock = resumeText
    ? `\n用户简历内容（部分）：\n${resumeText}`
    : `\n用户未上传简历。请基于其"${role}"岗位和"${seniority}"资历，假设其具备该层级通用的技能组合，为你生成一份完整的求职计划。务必包含语言准备、时间线规划和面试准备建议。`;

  // ── Free-tier prompt (Chinese, concise) ───────────────────────────────
  const freeSystemPrompt = `你是一名专业的远程工作求职教练。请根据用户画像，生成一份简洁实用的远程工作准备建议，严格以 JSON 输出，不含 markdown 代码块，不含额外文字。`;

  const freeUserPrompt = `用户画像：
- 求职目标：${goalLabel}
- 期望入职时间：${timeline}（约 ${timelineWeeks} 周）
- 职业方向：${role}，资历：${seniority}，学历：${education}，工作语言：${language}
${resumeBlock}

数据库实时推荐岗位（已按相似度排序）：
${jobsBlock}

请返回以下 JSON，字段均使用中文内容：
{
  "resumeEval": {
    "score": <0-100的整数，基于用户背景综合评估简历竞争力>,
    "summary": "<1-2句话的整体评价>",
    "improvements": ["<改进建议1>", "<改进建议2>", "<改进建议3>"]
  },
  "recommendations": [
    {
      "title": "<岗位名>",
      "company": "<公司名>",
      "matchLevel": "<高匹配|中匹配|低匹配>",
      "reason": "<1句话推荐理由，结合用户背景>"
    }
  ],
  "nextSteps": ["<最重要的行动第1步>", "<第2步>", "<第3步>"]
}

recommendations 使用上方实时岗位数据（保留 matchLevel 和公司名），最多 ${candidateJobs.length > 0 ? candidateJobs.length : 3} 条。nextSteps 要结合时间线（${timelineWeeks}周）倒推，给出最关键的 3 个行动步骤。`;

  // ── Member-tier prompt (richer, week-by-week timeline) ─────────────────
  const memberSystemPrompt = `你是一名顶级远程工作职业规划师。
请根据用户的详细画像和当前日期（${new Date().toLocaleDateString('zh-CN')}），生成高质量的远程求职全程方案。
关键要求：
1. 里程碑（milestones）必须包含具体的日期规划（如“3月上旬”、“4月中旬”），而不仅仅是周数。
2. 严格以 JSON 输出，不含 markdown 代码块。`;

  const memberUserPrompt = `用户画像：
- 求职目标：${goalLabel}
- 期望入职时间：${timeline}（约 ${timelineWeeks} 周内完成）
- 职业方向：${role}，资历：${seniority}，学历：${education}，工作语言：${language}
${resumeBlock}

数据库实时推荐岗位（优先参考）：
${jobsBlock}

请返回以下 JSON（中文）：
{
  "resumeEval": {
    "score": <0-100整数>,
    "summary": "<2-3句整体评价>",
    "strengths": ["<亮点1>", "<亮点2>"],
    "improvements": [
      { "issue": "<问题>", "suggestion": "<建议>", "priority": "高|中" }
    ]
  },
  "recommendations": [
    {
      "title": "<岗位名>",
      "company": "<公司名>",
      "matchLevel": "<高匹配|中匹配|低匹配>",
      "reason": "<推荐理由>",
      "applyTip": "<投递建议>"
    }
  ],
  "applicationPlan": {
    "overview": "<整体策略>",
    "milestones": [
      { "date": "<具体时间，如3月上旬>", "focus": "<本阶段重点>", "actions": ["<行动1>", "<行动2>"], "priority": "高" }
    ]
  },
  "interviewPrep": {
    "keyThemes": ["<主题1>", "<主题2>"],
    "sampleQA": [
      { "question": "<问题>", "answerHint": "<回答要点>" }
    ],
    "languageTip": "<语言建议>"
  }
}

applicationPlan.milestones 请按时间顺序规划，覆盖${timelineWeeks}周。`;

  // ── Guest-tier prompt (Extremely concise, no real jobs passed) ─────────
  const guestSystemPrompt = `你是一名远程工作求职启航教练。根据用户基本画像，生成一份极简版远程能力诊断。严格以 JSON 输出，不含 markdown 代码块。`;
  const guestUserPrompt = `
  用户画像：
  目标：${goalLabel}
  设定：${role} / ${seniority}

  由于未登录且未提供详细简历，请返回如下 JSON 结构的数据兜底分析：
  {
    "summary": "AI 已收到您的基本求职资料。检测到您想作为 ${role} 进行发展，目前整体市场需求较热。",
    "strengths": ["根据常理对该岗位的远程通用优势1", "优势2"],
    "weaknesses": ["需跨越时区沟通", "需要自驱力管理进度"],
    "milestones": [
      { "month": "起步规划", "focus": "个人定位与包装", "tasks": ["注册会员查看隐藏真实岗位匹配度", "将过往经历按照 STAR 法则拆解"] },
      { "focus": "能力补齐", "tasks": ["建立个人全职作品集网页", "主动模拟全英文线上面试"] }
    ],
    "recommendations": []
  }`;

  const systemPrompt = isGuest ? guestSystemPrompt : (isMember ? memberSystemPrompt : freeSystemPrompt);
  const userPrompt = isGuest ? guestUserPrompt : (isMember ? memberUserPrompt : freeUserPrompt);
  const model = isMember ? 'qwen-max' : 'qwen-plus';
  const maxTokens = isMember ? 2800 : 2000; // Increased from 1000 to prevent JSON truncation

  console.log(`[Copilot] Calling Bailian (${model}) | member=${isMember} | jobs=${candidateJobs.length} | resume=${resumeText ? 'yes' : 'no'}`);

  try {
    const result = await callBailianAPIWithModel(userPrompt, systemPrompt, model, maxTokens);

    if (result && result.content) {
      // Better JSON extraction to handle surrounding markdown or text
      let clean = result.content;
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        clean = clean.substring(jsonStart, jsonEnd + 1);
      } else {
        clean = clean.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
      }

      try {
        const parsed = JSON.parse(clean);
        const aiRecommendations = (parsed.recommendations?.map(r => {
          const rawScore = Number(String(r.matchScore || '').replace(/[^0-9]/g, '')) || 0;
          const rawLevel = String(r.matchLevel || '').trim();
          const inferredLevel =
            rawLevel === '高匹配' || rawLevel.toLowerCase() === 'high' ? 'high'
              : rawLevel === '中匹配' || rawLevel.toLowerCase() === 'medium' ? 'medium'
                : rawLevel === '低匹配' || rawLevel.toLowerCase() === 'low' ? 'low'
                  : resolveMatchLevel(rawScore);
          const label = resolveMatchLabel(inferredLevel);
          return {
            role: r.title || r.role,
            title: r.title || r.role,
            company: r.company,
            reason: r.reason,
            match: label,
            matchScore: label,
            matchLevel: inferredLevel,
            matchLabel: label,
            matchDetails: null,
            matchDetailsLocked: false
          };
        }) || []).filter(r => r.matchLevel !== 'none');

        const candidateRecommendations = (candidateJobs || []).map((job) => {
          const level = job.matchLevel || resolveMatchLevel(job.matchScore);
          const label = job.matchLabel || resolveMatchLabel(level);
          return {
            role: job.title,
            title: job.title,
            company: job.company,
            reason: job.reason || (job.matchDetails?.summary || ''),
            match: label,
            matchScore: label,
            matchLevel: level,
            matchLabel: label,
            matchDetails: job.matchDetails || null,
            matchDetailsLocked: Boolean(job.matchDetailsLocked),
            jobId: job.id
          };
        });

        const normalizedRecommendations = candidateRecommendations.length > 0
          ? candidateRecommendations
          : aiRecommendations;

        // Standardize output for frontend Component <GeneratedPlanView> and <CopilotSection>
        const normalized = {
          // 1. Fields for <GeneratedPlanView> (Legacy/Guest view)
          readiness: parsed.readiness || parsed.resumeEval?.score || (isGuest ? 50 : 0),
          summary: parsed.summary || parsed.applicationPlan?.overview || parsed.resumeEval?.summary || 'AI 匹配并分析完毕。',
          strengths: parsed.strengths || parsed.resumeEval?.strengths || [],
          weaknesses: parsed.weaknesses || parsed.resumeEval?.improvements?.map(i => i.issue ? `${i.issue}: ${i.suggestion}` : i) || parsed.resumeEval?.improvements || [],
          milestones: parsed.milestones || parsed.applicationPlan?.milestones?.map(m => ({
            month: m.date || (m.week ? `第 ${m.week} 周` : m.month),
            focus: m.focus,
            tasks: m.actions || m.tasks || [],
          })) || (parsed.nextSteps ? [{ month: '近期规划', focus: '关键步', tasks: parsed.nextSteps }] : []),

          // 2. Fields for <CopilotSection> (Main Home View)
          resumeEval: parsed.resumeEval || { score: 0, strengths: [], improvements: [] },
          interviewPrep: {
            focusAreas: parsed.interviewPrep?.keyThemes || [],
            commonQuestions: parsed.interviewPrep?.sampleQA?.map(q => q.question) || [],
            languageTip: parsed.interviewPrep?.languageTip || ''
          },
          applicationPlan: parsed.applicationPlan ? {
            timeline: parsed.applicationPlan.overview || '',
            steps: parsed.applicationPlan.milestones?.map(m => ({
              week: m.date || (m.week ? `第${m.week}周` : ''), // Map date to 'week' field for frontend compatibility
              action: m.focus,
              priority: m.priority || 'High'
            })) || []
          } : undefined,

          // 3. Shared Recommendations
          recommendations: normalizedRecommendations
        };

        return normalized;
      } catch (jsonError) {
        console.error('[Copilot] JSON parse error:', jsonError, 'Raw content:', result.content);
        // Do not throw immediately, fallback to a safe plan below instead.
      }
    }
    throw new Error('Empty AI response');
  } catch (e) {
    console.error('[Copilot] AI generation failed:', e);
    // Return a graceful fallback so the user isn't left with nothing
    return buildFallbackPlan(role, timeline, candidateJobs, isMember);
  }
}

/**
 * Calls Bailian using the OpenAI-compatible endpoint, overriding the model name.
 * This wraps callBailianAPI from bailian-parser.js but lets us pass a different model.
 */
async function callBailianAPIWithModel(prompt, systemPrompt, model, maxTokens) {
  const apiKey =
    process.env.VITE_ALIBABA_BAILIAN_API_KEY ||
    process.env.ALIBABA_BAILIAN_API_KEY ||
    process.env.BAILIAN_API_KEY;

  if (!apiKey) {
    console.warn('[Copilot] No Bailian API key — falling back to callBailianAPI default');
    return callBailianAPI(prompt, systemPrompt);
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
          temperature: 0.4,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}: ${err}`);
        console.error('[Copilot] Bailian API error:', response.status, err);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || null;
      const usage = data.usage || {};
      console.log(`[Copilot] Tokens used — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}`);
      return { content, usage };
    } catch (err) {
      console.error(`[Copilot] Attempt ${attempt} failed:`, err.message);
    }
  }
  return null;
}

// ── Fallback plan (when AI call fails) ──────────────────────────────────────
function buildFallbackPlan(role, timeline, candidateJobs, isMember) {
  const base = {
    resumeEval: {
      score: 65,
      summary: `基于您的 ${role} 背景，简历整体具备一定竞争力，但仍有优化空间。`,
      improvements: [
        '补充量化数据（如项目影响、用户规模、增长指标）',
        '突出与远程工作相关的自驱能力和异步沟通经验',
        '在技能栏添加常用远程协作工具（Slack、Notion、Jira 等）',
      ],
    },
    recommendations: candidateJobs.length > 0
      ? candidateJobs.map(j => ({
        role: j.title,
        title: j.title,
        company: j.company,
        match: j.matchLabel || resolveMatchLabel(j.matchLevel),
        matchScore: j.matchLabel || resolveMatchLabel(j.matchLevel),
        matchLevel: j.matchLevel || resolveMatchLevel(j.matchScore),
        matchLabel: j.matchLabel || resolveMatchLabel(j.matchLevel),
        matchDetails: j.matchDetails || null,
        matchDetailsLocked: Boolean(j.matchDetailsLocked),
        reason: j.reason || `与您的 ${role} 背景高度匹配，值得优先申请。`,
        jobId: j.id,
      }))
      : [],
    nextSteps: [
      '根据目标岗位 JD，优化简历中的关键词匹配度',
      '准备一段 60 秒的英文自我介绍（video intro）',
      '在 LinkedIn 上更新 "Open to Work" 并注明 Remote',
    ],
  };

  if (isMember) {
    base.applicationPlan = {
      overview: `根据您的时间线（${timeline}），建议分阶段推进：简历优化 → 批量投递 → 面试冲刺。`,
      milestones: [
        { week: 1, focus: '简历优化', actions: ['按 JD 关键词重写简历', '请同行朋友 review'], priority: '高' },
        { week: 3, focus: '投递启动', actions: ['每周投递 10-15 家', '搭建投递追踪表'], priority: '高' },
        { week: 6, focus: '面试准备', actions: ['练习 STAR 法则回答', '完成至少 2 次模拟面试'], priority: '高' },
      ],
    };
    base.interviewPrep = {
      keyThemes: ['远程自我管理能力', '技术/专业向深度问题', '跨文化沟通经验'],
      sampleQA: [
        { question: 'Tell me about a time you worked with a fully remote team.', answerHint: '使用 STAR 法则，重点描述如何克服时区和沟通挑战。' },
      ],
      languageTip: '建议每天进行 15 分钟的英文口语练习，并准备一份针对远程面试的英文简历版本。',
    };
  }

  return base;
}
