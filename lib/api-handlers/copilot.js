
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
  handleHeroRecommendations,
  handleCreatePlan,
  handleGenerateInterviewPlan,
  handleGenerateAnswer,
  handleUpdateProgress,
} from './copilot-v1.3.js';

const MATCH_DISPLAY_FLOOR = 45;
const MATCH_HIGH_THRESHOLD = 78;
const MATCH_MEDIUM_THRESHOLD = 62;
const RECOMMENDATION_CACHE_TTL = 5 * 60 * 1000;
const RECOMMENDATION_CACHE_MAX_ENTRIES = 300;
const MODULE_CACHE_TTL = 30 * 60 * 1000;
const MODULE_CACHE_MAX_ENTRIES = 300;
const AI_RECOMMENDED_MIN_GOAL_FIT = 60;
const AI_RECOMMENDED_TAG_ENABLED = String(process.env.COPILOT_AI_RECOMMENDED_TAG_ENABLED || 'true').toLowerCase() !== 'false';
const GOAL_AWARE_SCORING_ENABLED = String(process.env.COPILOT_GOAL_AWARE_SCORING_ENABLED || 'true').toLowerCase() !== 'false';
const PLAN_V2_ENABLED = String(process.env.COPILOT_PLAN_V2_ENABLED || 'true').toLowerCase() !== 'false';

if (!globalThis.__haigoo_copilot_recommendation_cache) {
  globalThis.__haigoo_copilot_recommendation_cache = new Map();
}
const RECOMMENDATION_CACHE = globalThis.__haigoo_copilot_recommendation_cache;
if (!globalThis.__haigoo_copilot_module_cache) {
  globalThis.__haigoo_copilot_module_cache = new Map();
}
const MODULE_CACHE = globalThis.__haigoo_copilot_module_cache;

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
  if (level === 'low') return '一般匹配';
  return '';
}

const SYSTEM_PROMPT_JSON = `你是一名专业的远程职业规划顾问和招聘专家。
请严格按照指定JSON格式输出。
不要输出解释说明。
不要输出多余文字。
不要添加代码块标记。
确保JSON可被直接解析。`;

function normalizeBreakdown(details = {}) {
  const raw = details?.breakdown || details || {};
  return {
    skillMatch: Math.max(0, Math.min(100, Math.round(Number(raw.skillMatch) || 0))),
    keywordSimilarity: Math.max(0, Math.min(100, Math.round(Number(raw.keywordSimilarity) || 0))),
    experienceMatch: Math.max(0, Math.min(100, Math.round(Number(raw.experienceMatch) || 0))),
    preferenceMatch: Math.max(0, Math.min(100, Math.round(Number(raw.preferenceMatch) || 0))),
  };
}

function normalizeGoal(goal = '') {
  const g = String(goal || '').trim().toLowerCase();
  if (!g) return 'full-time';
  if (g === 'part-time' || g === 'part_time' || g === 'side-income' || g === 'side_income' || g === '兼职' || g === '副业') {
    return 'side-income';
  }
  if (g === 'career-pivot' || g === 'career_pivot' || g === 'freelance') return 'career-pivot';
  if (g === 'market-watch' || g === 'market_watch') return 'market-watch';
  return 'full-time';
}

function normalizeJobType(jobType = '') {
  const t = String(jobType || '').toLowerCase();
  if (!t) return 'unknown';
  if (t.includes('part') || t.includes('兼职')) return 'part-time';
  if (t.includes('freelance') || t.includes('自由职业')) return 'freelance';
  if (t.includes('contract') || t.includes('合同')) return 'contract';
  if (t.includes('project') || t.includes('项目制')) return 'project';
  if (t.includes('intern')) return 'internship';
  if (t.includes('full') || t.includes('全职')) return 'full-time';
  return t;
}

function hasFlexibleSignal(row = {}) {
  const text = `${row?.title || ''} ${row?.description || ''}`.toLowerCase();
  return ['flexible', 'consult', 'contract-to-hire', 'part time possible', 'hourly', 'project-based', '兼职可', '灵活', '顾问', '外包']
    .some(token => text.includes(token));
}

function computeGoalFitScore(goal, row = {}) {
  const goalKey = normalizeGoal(goal);
  const jobType = normalizeJobType(row?.job_type || row?.jobType);
  const flexible = hasFlexibleSignal(row);

  if (goalKey === 'side-income') {
    if (jobType === 'part-time' || jobType === 'freelance' || jobType === 'contract' || jobType === 'project') return 95;
    if (jobType === 'full-time' && flexible) return 62;
    if (jobType === 'internship') return 45;
    return 25;
  }

  if (goalKey === 'full-time') {
    if (jobType === 'full-time') return 96;
    if (jobType === 'contract' || jobType === 'project') return 78;
    if (jobType === 'part-time' || jobType === 'freelance') return 56;
    return 68;
  }

  if (goalKey === 'career-pivot') {
    if (jobType === 'contract' || jobType === 'project' || jobType === 'freelance') return 82;
    if (jobType === 'full-time') return 72;
    return 70;
  }

  // market-watch
  if (jobType === 'contract' || jobType === 'project' || jobType === 'freelance') return 80;
  if (jobType === 'full-time') return 74;
  return 72;
}

function parseLanguageLevel(language = '') {
  const text = String(language || '').toLowerCase();
  if (text.includes('c2') || text.includes('母语')) return 100;
  if (text.includes('c1') || text.includes('流利')) return 88;
  if (text.includes('b2') || text.includes('工作')) return 78;
  if (text.includes('b1') || text.includes('日常')) return 62;
  if (text.includes('a2') || text.includes('a1') || text.includes('入门')) return 45;
  return 68;
}

function inferEnglishRequirement(row = {}) {
  const text = `${row?.title || ''} ${row?.description || ''}`.toLowerCase();
  if (/native english|c1|c2|fluent english|excellent english|英语流利|英文流利/.test(text)) return 'high';
  if (/english required|b2|business english|英语要求|英文沟通/.test(text)) return 'medium';
  if (/english preferred|b1|basic english|英语优先|英文优先/.test(text)) return 'low';
  return 'none';
}

function computeLanguageFitScore(language, row = {}) {
  const user = parseLanguageLevel(language);
  const requirement = inferEnglishRequirement(row);
  if (requirement === 'none') return 78;
  if (requirement === 'low') return user >= 52 ? 88 : 52;
  if (requirement === 'medium') return user >= 70 ? 90 : Math.max(35, user - 15);
  // high
  return user >= 82 ? 92 : Math.max(30, user - 28);
}

function computeRemoteFitScore(row = {}) {
  if (Boolean(row?.is_remote ?? row?.isRemote)) return 100;
  const locationText = String(row?.location || '').toLowerCase();
  if (locationText.includes('remote') || locationText.includes('远程')) return 92;
  return 45;
}

function clampScore(v) {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
}

function composeGoalAwareScore({ baseScore = 0, breakdown = {}, goal = '', language = '', row = {} } = {}) {
  const base = clampScore(baseScore);
  if (!GOAL_AWARE_SCORING_ENABLED) {
    const goalFitDisabled = computeGoalFitScore(goal, row);
    return {
      adjustedScore: base,
      goalFitScore: goalFitDisabled,
      skillAdjacencyScore: clampScore((Number(breakdown.skillMatch) * 0.55) + (Number(breakdown.keywordSimilarity) * 0.45)),
      languageFitScore: computeLanguageFitScore(language, row),
      remoteFitScore: computeRemoteFitScore(row),
      aiRecommended: AI_RECOMMENDED_TAG_ENABLED && base >= MATCH_MEDIUM_THRESHOLD && goalFitDisabled >= AI_RECOMMENDED_MIN_GOAL_FIT
    };
  }

  const goalKey = normalizeGoal(goal);
  const normalized = normalizeBreakdown(breakdown);
  const goalFit = computeGoalFitScore(goal, row);
  const skillFit = clampScore(normalized.skillMatch || base);
  const skillAdjacency = clampScore((normalized.skillMatch * 0.55) + (normalized.keywordSimilarity * 0.45));
  const languageFit = computeLanguageFitScore(language, row);
  const experienceFit = clampScore(normalized.experienceMatch || 65);
  const remoteFit = computeRemoteFitScore(row);

  let weighted = clampScore(
    goalFit * 0.30 +
    skillFit * 0.25 +
    skillAdjacency * 0.20 +
    languageFit * 0.10 +
    experienceFit * 0.10 +
    remoteFit * 0.05
  );

  // Cross-industry severe penalty (Floor limit): If absolute semantic/skill adjacency is terrible, filter it down explicitly
  // This prevents e.g. "Transformer Engineer" floating to the top for a "Product Manager"
  if (skillAdjacency < 20 || skillFit < 20) {
    weighted = Math.min(weighted, MATCH_DISPLAY_FLOOR - 10);
  } else if (skillAdjacency < 35 || skillFit < 35) {
    weighted = Math.min(weighted, MATCH_DISPLAY_FLOOR - 5);
  }

  // Side-income hard constraint: weak goal alignment should not float into top recommendations.
  if (goalKey === 'side-income' && goalFit < 40) {
    weighted = Math.min(weighted, MATCH_DISPLAY_FLOOR - 3);
  }

  if (goalKey === 'side-income' && goalFit < 70) {
    weighted = clampScore(weighted * 0.93);
  }

  const aiRecommended = AI_RECOMMENDED_TAG_ENABLED && weighted >= MATCH_MEDIUM_THRESHOLD && goalFit >= AI_RECOMMENDED_MIN_GOAL_FIT;

  return {
    adjustedScore: weighted,
    goalFitScore: goalFit,
    skillAdjacencyScore: skillAdjacency,
    languageFitScore: languageFit,
    remoteFitScore: remoteFit,
    aiRecommended
  };
}

function normalizeReadinessLevel(rawLevel, score = 0) {
  const level = String(rawLevel || '').trim().toLowerCase();
  if (level === 'fit' || level === 'transformable' || level === 'not-ready') return level;
  if (level === 'high' || level === 'ready') return 'fit';
  if (level === 'medium') return 'transformable';
  if (level === 'low') return 'not-ready';
  if (score >= 78) return 'fit';
  if (score >= 58) return 'transformable';
  return 'not-ready';
}

function buildRemoteReadiness(parsed = {}, fallbackScore = 0) {
  const source = parsed?.remoteReadiness || {};
  const score = clampScore(source?.score ?? source?.readinessScore ?? fallbackScore);
  const level = normalizeReadinessLevel(source?.level, score);
  const summary = String(
    source?.summary ||
    (level === 'fit'
      ? '你当前具备较好的远程工作适配基础，可直接进入高质量投递阶段。'
      : level === 'transformable'
        ? '你具备一定远程求职基础，补齐关键短板后匹配效果会明显提升。'
        : '你当前离稳定远程求职还有差距，建议先补齐基础能力再集中投递。')
  ).trim();

  const gaps = Array.isArray(source?.gaps)
    ? source.gaps.map((item) => typeof item === 'string' ? item : (item?.gap || item?.point || '')).filter(Boolean).slice(0, 3)
    : [];
  const actions = Array.isArray(source?.actions)
    ? source.actions.map((item) => typeof item === 'string' ? item : (item?.action || item?.suggestion || '')).filter(Boolean).slice(0, 3)
    : [];

  return { level, score, summary, gaps, actions };
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

function buildInitialPlanModules(parsed = {}) {
  const interviewQuestions = Array.isArray(parsed?.interviewPrep?.sampleQA)
    ? parsed.interviewPrep.sampleQA.map(item => ({ question: typeof item === 'string' ? item : item?.question, why: item?.answerHint || '' })).filter(item => item.question).slice(0, 5)
    : [];

  const interviewSummary = truncate(
    parsed?.interviewPrep?.languageTip ||
    (interviewQuestions.length > 0
      ? `已提炼 ${interviewQuestions.length} 条面试高频问题，建议先完成 STAR 结构化回答演练。`
      : '建议围绕岗位能力要求准备行为题、项目题和远程协作题。'),
    220
  );

  const milestones = Array.isArray(parsed?.applicationPlan?.milestones) ? parsed.applicationPlan.milestones : [];

  const weeklyPlan = milestones.map((m, idx) => ({
    week: m.date || m.week || `阶段 ${idx + 1}`,
    targetCount: Array.isArray(m.actions) ? m.actions.length * 5 : 5,
    tasks: Array.isArray(m.actions) ? m.actions : []
  })).slice(0, 4);

  const applySummary = truncate(
    parsed?.applicationPlan?.overview ||
    (milestones.length > 0
      ? `已生成 ${milestones.length} 个阶段里程碑，建议按阶段推进投递和复盘。`
      : '建议建立每周投递节奏，并持续复盘回信率与面试转化率。'),
    220
  );

  const roadmap = Array.isArray(parsed?.remoteReadiness?.actions)
    ? parsed.remoteReadiness.actions.map((act, i) => ({ phase: `重点${i + 1}`, focus: act }))
    : [];

  const languageSummary = truncate(
    parsed?.remoteReadiness?.actions?.[0] ||
    parsed?.interviewPrep?.languageTip ||
    '建议优先补齐岗位相关表达模板与远程协作沟通语言。',
    220
  );

  return {
    language: {
      summary: languageSummary,
      roadmap,
      status: 'ready',
      generatedAt: new Date().toISOString()
    },
    interview: {
      summary: interviewSummary,
      questions: interviewQuestions,
      status: 'ready',
      generatedAt: new Date().toISOString()
    },
    apply: {
      summary: applySummary,
      weeklyPlan,
      status: 'ready',
      generatedAt: new Date().toISOString()
    }
  };
}

function createRecommendationCacheKey({ userId, role = '', seniority = '', language = '', goal = '', topN = 5, isMember = false }) {
  if (!userId) return '';
  return [
    String(userId),
    String(role || '').trim().toLowerCase(),
    String(seniority || '').trim().toLowerCase(),
    String(language || '').trim().toLowerCase(),
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

function parseJsonSafe(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
}

function normalizeExpandModule(module = '') {
  const key = String(module || '').trim().toLowerCase();
  if (key === 'language' || key === 'interview' || key === 'apply') return key;
  return 'interview';
}

function normalizeExpandIntent(module, intent = '') {
  const value = String(intent || '').trim().toLowerCase();
  if (!value || value === 'deep-plan') return 'deep-plan';

  if (module === 'interview') {
    if (value === 'more-questions' || value === 'mock-answer') return value;
    return 'deep-plan';
  }
  if (module === 'language') {
    if (value === 'resources' || value === 'deep-plan') return value;
    return 'deep-plan';
  }
  if (module === 'apply') {
    if (value === 'sprint' || value === 'deep-plan') return value;
    return 'deep-plan';
  }
  return 'deep-plan';
}

function createModuleCacheKey({
  userId,
  module,
  intent,
  goal = '',
  timeline = '',
  role = '',
  language = '',
  resumeVersion = 0,
  planVersion = ''
} = {}) {
  return [
    String(userId || ''),
    String(module || ''),
    String(intent || ''),
    String(goal || '').trim().toLowerCase(),
    String(timeline || '').trim().toLowerCase(),
    String(role || '').trim().toLowerCase(),
    String(language || '').trim().toLowerCase(),
    Number(resumeVersion) || 0,
    String(planVersion || '')
  ].join('::');
}

function getCachedModuleResult(key) {
  if (!key) return null;
  const cached = MODULE_CACHE.get(key);
  if (!cached) return null;
  if ((Date.now() - cached.cachedAt) > MODULE_CACHE_TTL) {
    MODULE_CACHE.delete(key);
    return null;
  }
  return JSON.parse(JSON.stringify(cached.data || {}));
}

function setCachedModuleResult(key, data) {
  if (!key || !data || typeof data !== 'object') return;
  if (MODULE_CACHE.size >= MODULE_CACHE_MAX_ENTRIES) {
    const oldestKey = MODULE_CACHE.keys().next().value;
    if (oldestKey) MODULE_CACHE.delete(oldestKey);
  }
  MODULE_CACHE.set(key, { cachedAt: Date.now(), data });
}

function truncate(str = '', max = 240) {
  const raw = String(str || '').trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}...`;
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
      try {
        const stateResult = await handleGetState(userId);
        const savedPlan = stateResult?.state?.planData || null;
        if (savedPlan) {
          return res.status(200).json({
            success: true,
            plan: savedPlan,
            isHistory: true,
            source: 'user_state',
            updatedAt: stateResult?.state?.updatedAt || null,
          });
        }
      } catch (err) {
        console.warn('[Copilot] failed to read saved state plan, fallback to sessions', err?.message || err);
      }
      const sessionResult = await neonHelper.query(
        `SELECT * FROM copilot_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (sessionResult && sessionResult.length > 0) {
        const session = sessionResult[0];
        let background = { role: '', industry: '', years: '中级', seniority: '中级', education: '本科', language: '英语-工作 (B2)' };
        try {
          const parsed = JSON.parse(session.background);
          background = {
            // Support both naming conventions: 'industry' (new) and 'role' (legacy)
            role: parsed.industry || parsed.role || '',
            industry: parsed.industry || parsed.role || '',
            years: parsed.seniority || parsed.years || '中级',
            seniority: parsed.seniority || parsed.years || '中级',
            education: parsed.education || '本科',
            language: parsed.language || '英语-工作 (B2)',
          };
        } catch (e) { }

        return res.status(200).json({
          success: true,
          plan: session.plan_data,
          isTrial: session.is_trial,
          createdAt: session.created_at,
          isHistory: true,
          session: {
            goal: session.goal,
            timeline: session.timeline,
            investedHours: session.invested_hours,
            background
          }
        });
      }
      return res.status(200).json({ success: true, plan: null });
    }

    if (req.method === 'POST') {
      // ── V1.3 Action Router ──────────────────────────────────────────────
      const action = req.body?.action;
      if (action && action !== 'generate') {
        if (action === 'hero-recommend') {
          try {
            const result = await handleHeroRecommendations(isGuest ? null : userId, req.body);
            return res.status(result?.error ? 400 : 200).json(result);
          } catch (e) {
            console.error('[Copilot Hero] hero-recommend error:', e);
            return res.status(500).json({ error: 'Internal error', detail: e.message });
          }
        }

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
          const topN = isMemberForAction ? 5 : 1;
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

        if (action === 'refine-milestones') {
          if (!isMemberForAction) return res.status(403).json({ error: '深度打磨为会员专属功能' });
          const { currentMilestones, background, goal, timeline } = req.body;
          const prompt = `用户当前的远程求职里程碑：\n${JSON.stringify(currentMilestones, null, 2)}
          
职业背景：${JSON.stringify(background)}
求职目标：${goal}
预期时间：${timeline}

请作为资深远程求职导师，对当前的里程碑进行【深度打磨和延展】：
1. 补充更加实操的细节、具体平台和方法（例如明确指引去哪个平台发什么内容）。
2. 保留原有阶段结构，但将每个阶段的 tasks 扩充至 3-5 条具备极高指导意义的行动路线。
3. 必须紧紧围绕用户的具体职业方向，提供个性化引导。

返回 JSON：
{
  "milestones": [
    {
      "month": "<原阶段名>",
      "focus": "<更精准的核心任务>",
      "tasks": ["<深度打磨后的行动1>", "<行动2>", ...]
    }
  ]
}`;
          try {
            const raw = await callBailianAPIWithModel(prompt, "你是一个专门帮助用户进行远程求职规划的 AI 导师，务必输出严格格式的 JSON。", 'qwen-max', 4000);
            let clean = raw.content;
            const js = clean.indexOf('{');
            const je = clean.lastIndexOf('}');
            if (js !== -1 && je !== -1) clean = clean.substring(js, je + 1);
            else clean = clean.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();

            const parsed = JSON.parse(clean);
            if (!parsed.milestones || !Array.isArray(parsed.milestones)) throw new Error("Invalid AI format");

            const newMilestones = parsed.milestones.map(m => ({
              month: m.month || '阶段规划',
              focus: m.focus || '深度打磨',
              tasks: (() => {
                const rawTasks = m.actions || m.tasks;
                const arr = Array.isArray(rawTasks) ? rawTasks : rawTasks && typeof rawTasks === 'object' ? Object.values(rawTasks) : rawTasks && typeof rawTasks === 'string' ? [rawTasks] : [];
                return arr.map(t => typeof t === 'string' ? t.trim() : JSON.stringify(t)).filter(Boolean);
              })()
            })).filter(m => m.focus || m.tasks.length > 0);

            const sessionRes = await neonHelper.query(
              `SELECT plan_data FROM copilot_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]
            );
            if (sessionRes && sessionRes.length > 0) {
              let planData = sessionRes[0].plan_data;
              if (typeof planData === 'string') try { planData = JSON.parse(planData); } catch (e) { }
              if (planData && typeof planData === 'object') {
                planData.milestones = newMilestones;
                if (planData.plan_v2?.modules?.milestones?.content) {
                  planData.plan_v2.modules.milestones.content.phases = newMilestones;
                }
                await neonHelper.query(
                  `UPDATE copilot_sessions SET plan_data = $1 WHERE id = (SELECT id FROM copilot_sessions WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1)`,
                  [JSON.stringify(planData), userId]
                );
              }
            }
            return res.status(200).json({ success: true, milestones: newMilestones });
          } catch (err) {
            return res.status(500).json({ error: 'AI 打磨失败，请重试' });
          }
        }

        const memberOnlyActions = ['update-progress', 'align-resume', 'interview-prep', 'mock-interview', 'expand-module', 'generate-interview-plan', 'generate-answer', 'refine-milestones'];
        if (memberOnlyActions.includes(action) && !isMemberForAction) {
          return res.status(403).json({
            error: '此功能仅限会员使用',
            code: 'MEMBER_ONLY',
            message: '升级会员以解锁完整 Copilot 功能。',
          });
        }

        try {
          const actionBody = { ...req.body, __isMember: isMemberForAction };
          let result;
          switch (action) {
            case 'get-state':
              result = await handleGetState(userId);
              break;
            case 'extract-resume':
              result = await handleExtractResume(userId, req.body.resumeId);
              break;
            case 'assess':
              result = await handleAssess(userId, actionBody);
              break;
            case 'match-jobs':
              result = await handleMatchJobs(userId);
              break;
            case 'hero-recommend':
              result = await handleHeroRecommendations(userId, actionBody);
              break;
            case 'create-plan':
              result = await handleCreatePlan(userId, actionBody);
              break;
            case 'interview-prep':
              result = await handleGenerateInterviewPlan(userId, actionBody);
              break;
            case 'generate-answer':
              result = await handleGenerateAnswer(userId, actionBody);
              break;
            case 'update-progress':
              result = await handleUpdateProgress(userId, actionBody);
              break;
            case 'generate-interview-plan':
              result = await handleGenerateInterviewPlan(userId, req.body);
              break;
            case 'generate-answer':
              result = await handleGenerateAnswer(userId, req.body);
              break;
            case 'expand-module':
              result = await handleExpandModule({
                userId,
                body: req.body || {},
                isMember: isMemberForAction
              });
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
      const { goal, timeline, investedHours, background, resumeId } = req.body;

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

      // Guest: 0 real jobs. Free: 1 real jobs. Pro: 5 real jobs.
      const candidateJobs = await fetchCandidateJobs({
        userId,
        background,
        goal,
        topN: isGuest ? 0 : (isMember ? 5 : 1),
        isMember
      });

      // 5. Generate plan via AI
      const plan = await generateAIPlan(
        { goal, timeline, investedHours, background, resumeText, candidateJobs },
        isMember,
        isGuest
      );

      // 6. Save session (Bypass if Guest)
      const isTrial = !isMember;
      if (plan && !isGuest) {
        try {
          await neonHelper.query(
            `INSERT INTO copilot_sessions (user_id, goal, timeline, invested_hours, background, plan_data, is_trial)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, goal, timeline, investedHours || null, JSON.stringify(background), JSON.stringify(plan), isTrial]
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

  const { industry: role = '', seniority = '', language = '' } = background || {};
  const normalizedGoal = normalizeGoal(goal);
  const cacheKey = createRecommendationCacheKey({ userId, role, seniority, language, goal: normalizedGoal, topN, isMember });
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
          const baseScore = clampScore(Number(result?.totalScore) || 0);
          const breakdown = normalizeBreakdown(result?.breakdown || {});
          const goalAware = composeGoalAwareScore({
            baseScore,
            breakdown,
            goal: normalizedGoal,
            language,
            row: job
          });
          const score = goalAware.adjustedScore;
          const matchLevel = resolveMatchLevel(score);
          const matchDetails = buildCopilotMatchDetails({ score, details: breakdown, row: job });
          return {
            job,
            score,
            matchLevel,
            matchDetails,
            goalFitScore: goalAware.goalFitScore,
            skillAdjacencyScore: goalAware.skillAdjacencyScore,
            aiRecommended: goalAware.aiRecommended
          };
        });

        personalized.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return new Date(b.job.published_at).getTime() - new Date(a.job.published_at).getTime();
        });

        let visible = personalized.filter(item => item.matchLevel !== 'none');
        let candidates = visible.slice(0, topN);

        if (candidates.length === 0 && personalized.length > 0) {
          // Generic Jobs Fallback: if no strict matches, fall back to jobs with score >= 30
          candidates = personalized.filter(item => item.score >= 30).slice(0, topN);
          candidates.forEach(c => {
            c.matchLevel = 'low';
            c.aiRecommended = false;
            c.reason = '未发现完全匹配该方向的高级岗位，已为您降维匹配当前包含相关技能或通用属性的岗位。';
          });
        }

        const result = candidates.map(({ job, score, matchLevel, matchDetails, goalFitScore, skillAdjacencyScore, aiRecommended, reason }) => ({
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
          goalFitScore,
          skillAdjacencyScore,
          aiRecommended,
          matchDetails: isMember && matchLevel === 'high' ? matchDetails : null,
          matchDetailsLocked: !isMember && matchLevel === 'high',
          reason: reason || (isMember && matchLevel === 'high'
            ? matchDetails.summary
            : normalizedGoal === 'side-income'
              ? `${job.title} 与你的兼职/副业增收目标匹配度较高，建议优先关注。`
              : `${job.title} 与你的职业目标相关，建议优先关注并查看岗位职责要求。`)
        }));
        setCachedRecommendations(cacheKey, result);
        return result;
      }
    }

    const fallbackResult = rankAndFormat(rows, role, seniority, topN, { isMember, goal: normalizedGoal, language });
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
  const goal = normalizeGoal(options?.goal || '');
  const language = options?.language || '';

  const scored = rows.map(job => {
    const jobText = `${job.title} ${job.category || ''} ${(job.description || '').substring(0, 400)}`;
    const baseScore = Math.round(calculateSimilarity(userProfile, jobText) * 100);
    const goalAware = composeGoalAwareScore({
      baseScore,
      breakdown: {
        skillMatch: baseScore,
        keywordSimilarity: baseScore,
        experienceMatch: 65,
        preferenceMatch: 60
      },
      goal,
      language,
      row: job
    });
    const score = goalAware.adjustedScore;
    const matchLevel = resolveMatchLevel(score);
    const matchDetails = buildCopilotMatchDetails({ score, details: {}, row: job });
    return {
      job,
      score,
      matchLevel,
      matchDetails,
      goalFitScore: goalAware.goalFitScore,
      skillAdjacencyScore: goalAware.skillAdjacencyScore,
      aiRecommended: goalAware.aiRecommended,
      reason: null
    };
  });

  scored.sort((a, b) => b.score - a.score);
  let visible = scored.filter(item => item.matchLevel !== 'none').slice(0, topN);

  if (visible.length === 0 && scored.length > 0) {
    visible = scored.filter(item => item.score >= 30).slice(0, topN);
    visible.forEach(c => {
      c.matchLevel = 'low';
      c.aiRecommended = false;
      c.reason = '未发现完全匹配该方向的高级岗位，已为您降维匹配当前包含相关技能或通用属性的岗位。';
    });
  }

  return visible.map(({ job, score, matchLevel, matchDetails, goalFitScore, skillAdjacencyScore, aiRecommended, reason }) => ({
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
    goalFitScore,
    skillAdjacencyScore,
    aiRecommended,
    matchDetails: isMember && matchLevel === 'high' ? matchDetails : null,
    matchDetailsLocked: !isMember && matchLevel === 'high',
    reason: reason || (goal === 'side-income'
      ? `${matchDetails?.summary || ''}（已优先按兼职/副业目标筛选）`
      : matchDetails?.summary || '')
  }));
}

function extractJSONObject(raw = '') {
  const text = String(raw || '');
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return text.slice(jsonStart, jsonEnd + 1);
  }
  return text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
}

function getGoalLabel(goal = '') {
  const key = normalizeGoal(goal);
  return {
    'full-time': '长期全职远程工作',
    'side-income': '兼职/副业增收',
    'market-watch': '关注远程市场机会',
    'career-pivot': '职业转型'
  }[key] || '远程求职';
}

function buildModuleFallback(module, intent, context = {}) {
  const goalLabel = getGoalLabel(context.goal);
  const role = context.role || '当前方向';
  const topJobs = (context.recommendations || []).slice(0, 3).map(item => item.title).filter(Boolean);

  if (module === 'language') {
    return {
      summary: `围绕 ${goalLabel} 目标，建议优先提升与 ${role} 相关的远程沟通与书面表达。`,
      roadmap: [
        { phase: '第1周', focus: '建立表达模板', tasks: ['整理英文自我介绍 60 秒版本', '准备 3 个项目成果英文表达'] },
        { phase: '第2周', focus: '强化岗位语境', tasks: ['提炼目标岗位高频词汇', '按 JD 改写 1 版简历摘要'] },
        { phase: '第3-4周', focus: '模拟面试表达', tasks: ['完成 5 题英文问答演练', '复盘语法与逻辑问题'] }
      ],
      tips: ['优先先练可复用的开场与项目说明模板', '每次投递前做一次岗位词汇替换'],
      resources: intent === 'resources'
        ? [
          { name: 'BBC Learning English', type: 'site', reason: '适合建立职场英语输入' },
          { name: 'Grammarly', type: 'app', reason: '提升投递邮件与简历语法质量' },
          { name: 'YouGlish', type: 'site', reason: '快速校准术语发音与语境' }
        ]
        : []
    };
  }

  if (module === 'apply') {
    return {
      summary: `针对 ${goalLabel} 目标，先小规模验证方向，再逐步提高高质量投递密度。`,
      weeklyPlan: [
        { week: 'Week 1', targetCount: 8, channels: ['LinkedIn', '官网投递'], tasks: ['聚焦 1-2 个岗位方向', '建立投递追踪表'] },
        { week: 'Week 2', targetCount: 10, channels: ['社区/内推', '人才库'], tasks: ['更新简历版本', '复盘回信率和拒信原因'] }
      ],
      outreachTemplates: [
        { scene: '冷启动联系', template: '你好，我关注到你们的远程岗位，我在相关项目中完成过……希望进一步沟通。' }
      ],
      metrics: [
        { name: '每周有效投递数', target: '8-12', why: '保证机会覆盖面' },
        { name: '面试转化率', target: '>=12%', why: '校验岗位匹配质量' }
      ],
      relatedJobs: topJobs
    };
  }

  const baseQuestions = [
    '请介绍一个你主导并推动落地的项目。',
    '你如何在远程协作中管理优先级？',
    '遇到需求变化时你如何平衡速度与质量？',
    '请分享一次跨团队沟通的挑战与解决方案。',
    '你如何证明自己的业务影响力？'
  ];
  const question = context.question || baseQuestions[0];
  return {
    summary: `面试准备建议围绕 ${role} 方向的能力证明、远程协作和结果导向表达。`,
    questions: baseQuestions.map((q) => ({ question: q, answerFramework: ['场景背景', '关键动作', '结果数据'] })),
    mockAnswer: intent === 'mock-answer'
      ? {
        question,
        answer: `在该问题上建议使用 STAR 结构回答，突出你在 ${role} 场景中的关键决策、协作方式与量化结果。`,
        highlights: ['给出量化结果', '明确个人贡献', '说明复盘与优化'],
        improvements: ['避免空泛描述', '回答控制在 60-90 秒']
      }
      : null
  };
}

function buildExpandModulePrompt({ module, intent, context = {} } = {}) {
  const goalLabel = getGoalLabel(context.goal);
  const role = context.role || '未填写';
  const seniority = context.seniority || '未填写';
  const language = context.language || '未填写';
  const timeline = context.timeline || '1-3 months';
  const readiness = context.remoteReadiness?.summary || '';
  const readinessLevel = context.remoteReadiness?.level || '';
  const recommendations = (context.recommendations || []).slice(0, 5)
    .map((item, idx) => `${idx + 1}. ${item.title} @ ${item.company || 'N/A'}`)
    .join('\n');
  const skills = Array.isArray(context.resumeSkills) ? context.resumeSkills.slice(0, 10).join('、') : '';
  const investedHours = context.investedHours || '未指定';
  const question = context.question ? `\n用户指定问题：${context.question}` : '';

  const systemPrompt = `你是一名专业的远程职业规划顾问和招聘专家。
请严格按照指定JSON格式输出。
不要输出解释说明。
不要输出多余文字。
不要添加代码块标记。
确保JSON可被直接解析。`;

  if (module === 'language') {
    const userPrompt = `请为用户输出“语言准备模块”的深度极客方案。
用户信息：
- 目标：${goalLabel}
- 方向：${role} / ${seniority}
- 当前语言：${language}
- 核心技能：${skills || '无'}
- 推荐的真实匹配岗位：
${recommendations || '无'}

要求：
1. 请明确指出当前用户的语言水平（${language}）直接投定上方推荐岗位，最容易产生的交流 Gap。
2. 给出极其垂直的语言提升建议（如：用什么具体的 AI 工具模拟常见会议、推荐的垂直播客等）。
3. 学习路线要有强制力。

返回 JSON：
{
  "summary": "<1句锋利的点评（指出语言核心弱项）>",
  "roadmap": [
    { "phase": "<阶段名称>", "focus": "<突破点>", "tasks": ["<非常落地的任务1>", "<非常落地的任务2>"] }
  ],
  "tips": ["<语言交流技巧1>", "<语言交流技巧2>"],
  "resources": [
    { "name": "<具体的工具/APP名>", "type": "tool", "reason": "<为什么适合这个岗位>" }
  ]
}
要求：roadmap 最多 3 阶段；每阶段 tasks 最多 2 条；resources 最多 3 个。`;
    return { systemPrompt, userPrompt, model: 'qwen-plus', maxTokens: 1200 };
  }

  if (module === 'apply') {
    const userPrompt = `用户目标在${timeline}内拿到远程offer。
当前职业方向：${role} / ${seniority}
每周可投入时间：${investedHours}
推荐岗位：
${recommendations || '无数据'}

请根据以上前提，生成一份倒排的投递与执行计划（Backward Planning）。

要求：
1. 根据预期拿到 offer 的时间（${timeline}）倒推，将整个周期拆解为 4-6 个关键执行阶段。
2. 每个阶段的任务必须围绕目标分解，并且适应每周 ${investedHours} 的投入时间，给出高度具体的执行建议。
3. 提供一版具备极高针对性的冷启动 Outreach/Cover Letter 模板。

输出JSON：
{
  "summary": "<投递与执行破局策略，1句话>",
  "weeklyPlan": [
    { "week": "<阶段名称，如：第1周 准备期>", "targetCount": <建议投递数(数字)>, "channels": ["<渠道名1>", "<渠道名2>"], "tasks": ["<非常具体的行动动作1>", "<动作2>"] }
  ],
  "outreachTemplates": [
    { "scene": "Cold Message / Email", "template": "<模板正文，需留出[Bracket]供替换>" }
  ]
}
要求：weeklyPlan 必须生成 4-6 阶段，outreachTemplates 1-2 条。`;
    return { systemPrompt, userPrompt, model: 'qwen-max', maxTokens: 2000 };
  }

  const userPrompt = `根据以下岗位与候选人背景，生成针对远程工作的实战模拟英文面试问题。
用户信息：
目标：${goalLabel}
设定：${role} / ${seniority}
英语水平：${language}
每周可用备考时间：${investedHours}

候选人技能标签：
${skills || '未提取'}

目标预选岗位：
${recommendations || '暂无'}
${question}

要求：
1. 问题设定必须是专业性的业务挑战、结合跨时区与全异步沟通协作的痛点。
2. 梳理出10个常见的实战模拟英文面试问题。
3. 提供一句总体破局建议。

输出JSON：
{
  "summary": "<1句锋利的点评（指出语言与面试核心弱项及破局点）>",
  "questions": [
    {
      "question": "<高质量英文面试题（完整句子，以How/Why/Tell/Describe/Can you开头）>",
      "questionType": "<题型，如：项目经历 / 行为问题 / 专业领域 / 动机>",
      "answerHint": "<针对候选人背景的中文回答提示，1-2句>"
    }
  ],
  "tips": ["<语言交流与面试进阶技巧1>", "<技巧2>"]
}
严格要求：
- questions 必须生成 10 道，每项必须包含 question、questionType、answerHint 三个字段
- question 字段只能是英文面试题本身，绝对不能包含"answerHint"或中文提示
- answerHint 字段只能是中文回答建议，不能写英文题目`;
  return { systemPrompt, userPrompt, model: 'qwen-max', maxTokens: 2200 };
}

async function handleExpandModule({ userId, body = {}, isMember = false } = {}) {
  if (!userId) {
    return { error: '请先登录', code: 'LOGIN_REQUIRED' };
  }
  if (!isMember) {
    return { error: '此功能仅限会员使用', code: 'MEMBER_ONLY' };
  }

  const module = normalizeExpandModule(body.module);
  const intent = normalizeExpandIntent(module, body.intent);
  const forceRefresh = Boolean(body.forceRefresh);

  let stateRow = null;
  try {
    const stateResult = await neonHelper.query(
      `SELECT resume_structured, resume_version, readiness_data
       FROM copilot_user_state
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    stateRow = stateResult?.[0] || null;
  } catch (_err) {
    stateRow = null;
  }

  const latestRows = await neonHelper.query(
    `SELECT goal, timeline, background, plan_data, created_at, invested_hours
     FROM copilot_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const latest = latestRows?.[0] || {};
  const latestPlan = parseJsonSafe(latest.plan_data, {}) || {};
  const latestBackground = parseJsonSafe(latest.background, {}) || {};
  const planGoalContext = parseJsonSafe(latestPlan?.plan_v2?.goalContext, {}) || {};

  const goal = normalizeGoal(body.goal || planGoalContext.goal || latest.goal || 'full-time');
  const timeline = String(body.timeline || planGoalContext.timeline || latest.timeline || '1-3 months');
  const investedHours = String(body.investedHours || latest.invested_hours || '');
  const role = String(body.role || planGoalContext.role || latestBackground.industry || '').trim();
  const seniority = String(body.seniority || latestBackground.seniority || '').trim();
  const language = String(body.language || planGoalContext.language || latestBackground.language || '').trim();
  const planVersion = String(latest.created_at || latestPlan?.plan_v2?.version || '');
  const resumeVersion = Number(stateRow?.resume_version) || 0;
  const cacheKey = createModuleCacheKey({
    userId,
    module,
    intent,
    goal,
    timeline,
    role,
    language,
    resumeVersion,
    planVersion
  });

  const cached = forceRefresh ? null : getCachedModuleResult(cacheKey);
  if (cached) {
    return {
      success: true,
      cached: true,
      module,
      intent,
      moduleData: cached.moduleData,
      generatedAt: cached.generatedAt
    };
  }

  const recommendationsFromPlan = Array.isArray(latestPlan?.plan_v2?.recommendations)
    ? latestPlan.plan_v2.recommendations
    : (Array.isArray(latestPlan?.recommendations) ? latestPlan.recommendations : []);

  const candidateJobs = await fetchCandidateJobs({
    userId,
    background: { industry: role, seniority, language },
    goal,
    topN: isMember ? 5 : 1,
    isMember,
    forceRefresh: false
  });

  const recommendations = (recommendationsFromPlan.length > 0 ? recommendationsFromPlan : candidateJobs).map((item) => ({
    title: item?.title || item?.role || '',
    company: item?.company || '',
    matchLabel: item?.matchLabel || item?.match || resolveMatchLabel(item?.matchLevel || resolveMatchLevel(item?.matchScore || 0))
  })).filter(item => item.title);

  const context = {
    goal,
    timeline,
    investedHours,
    role,
    seniority,
    language,
    question: String(body.question || '').trim(),
    recommendations,
    remoteReadiness: latestPlan?.plan_v2?.remoteReadiness || latestPlan?.remoteReadiness || {},
    resumeSkills: Array.isArray(stateRow?.resume_structured?.skills) ? stateRow.resume_structured.skills : []
  };

  const { systemPrompt, userPrompt, model, maxTokens } = buildExpandModulePrompt({ module, intent, context });
  let moduleData = null;

  try {
    const result = await callBailianAPIWithModel(userPrompt, systemPrompt, model, maxTokens);
    const parsed = parseJsonSafe(extractJSONObject(result?.content || ''), null);
    if (parsed && typeof parsed === 'object') {
      moduleData = parsed;
    }
  } catch (_err) {
    moduleData = null;
  }

  if (!moduleData) {
    moduleData = buildModuleFallback(module, intent, context);
  }

  // Standardize and trim to keep rendering smooth.
  moduleData = {
    ...moduleData,
    summary: truncate(moduleData.summary || '', 260),
  };

  const payload = {
    moduleData,
    generatedAt: new Date().toISOString()
  };
  setCachedModuleResult(cacheKey, payload);

  return {
    success: true,
    cached: false,
    module,
    intent,
    moduleData: payload.moduleData,
    generatedAt: payload.generatedAt
  };
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
  const { goal, timeline, investedHours, background, resumeText, candidateJobs } = inputs;
  const { education = '', industry: role = '', seniority = '', language = '' } = background || {};

  // ── Map goal to human label ────────────────────────────────────────────
  const normalizedGoal = normalizeGoal(goal);
  const goalLabel = {
    'full-time': '找长期全职远程工作，替代或优化现有工作',
    'side-income': '兼职/副业远程增收，在现有收入基础上额外创收',
    'market-watch': '关注远程市场机会，探索阶段暂不确定是否行动',
    'career-pivot': '职业转型或换赛道，需要重新定位职业方向',
  }[normalizedGoal] || goal;

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
  const freeSystemPrompt = SYSTEM_PROMPT_JSON;

  const freeUserPrompt = `用户画像：
- 求职目标：${goalLabel}
- 期望入职时间：${timeline}（约 ${timelineWeeks} 周）
- 职业方向：${role}，资历：${seniority}，学历：${education}，工作语言：${language}
${resumeBlock}

数据库实时推荐岗位（已按相似度排序）：
${jobsBlock}

请返回以下 JSON，字段均使用中文内容：
{
  "remoteReadiness": {
    "level": "<fit|transformable|not-ready>",
    "score": <0-100整数>,
    "summary": "<评估该背景实现【${goalLabel}】的可行性结论与建议>",
    "gaps": ["<差距1>", "<差距2>"],
    "actions": ["<针对【${goalLabel}】具体的行动1>", "<行动2>"]
  },
  "resumeEval": {
    "score": <0-100的整数，基于用户背景综合评估简历竞争力>,
    "summary": "<1-2句话的整体评价>",
    "improvements": ["<改进建议1>", "<改进建议2>", "<改进建议3>"]
  },
  "recommendations": [
    {
      "title": "<岗位名>",
      "company": "<公司名>",
      "matchLevel": "<高匹配|中匹配|一般匹配>",
      "reason": "<1句话推荐理由，结合用户背景>"
    }
  ],
  "milestones": [
    { "month": "<阶段名，如：第1-2周>", "focus": "<本阶段核心目标>", "tasks": ["<具体行动1>", "<具体行动2>"] },
    { "month": "<阶段名，如：第3-4周>", "focus": "<本阶段核心目标>", "tasks": ["<具体行动1>", "<具体行动2>"] },
    { "month": "<阶段名，如：第5周起>", "focus": "<本阶段核心目标>", "tasks": ["<具体行动1>", "<具体行动2>"] }
  ]
}

recommendations 与目标必须强一致：
- 如果目标是“兼职/副业增收”，优先 part-time / contract / freelance 岗位，不要把全职作为首推。
- 如果推荐与目标不完全一致，reason 必须明确说明原因（如技能可迁移）。
recommendations 使用上方实时岗位数据（保留 matchLevel 和公司名），最多 ${candidateJobs.length > 0 ? candidateJobs.length : 3} 条。
milestones 必须生成恰好 3 个阶段，结合时间线（${timelineWeeks}周）倒推，每阶段 tasks 必须是字符串数组（不能是对象），每条控制在 30 字以内。`;

  // ── Member-tier prompt (richer, week-by-week timeline) ─────────────────
  const memberSystemPrompt = SYSTEM_PROMPT_JSON;

  const memberUserPrompt = `用户画像：
- 求职目标：${goalLabel}
- 期望入职时间：${timeline}（约 ${timelineWeeks} 周内完成）
- 职业方向：${role}，资历：${seniority}，学历：${education}，工作语言：${language}
${resumeBlock}

数据库实时推荐岗位（优先参考）：
${jobsBlock}

请返回以下 JSON（中文），所有文本字段必须填写实际内容，禁止留空：
{
  "remoteReadiness": {
    "level": "<fit|transformable|not-ready>",
    "score": <0-100整数>,
    "summary": "<评估该背景实现【${goalLabel}】的可行性结论与建议，1-2句>",
    "gaps": ["<差距1>", "<差距2>", "<差距3>"],
    "actions": ["<针对【${goalLabel}】具体的行动1>", "<行动2>", "<行动3>"]
  },
  "resumeEval": {
    "score": <0-100整数>,
    "summary": "<整体评价，2句>",
    "strengths": ["<亮点1>", "<亮点2>"],
    "improvements": [
      { "issue": "<问题>", "suggestion": "<建议>", "priority": "高|中" }
    ]
  },
  "recommendations": [
    {
      "title": "<岗位名>",
      "company": "<公司名>",
      "matchLevel": "<高匹配|中匹配|一般匹配>",
      "reason": "<推荐理由>",
      "applyTip": "<投递建议>"
    }
  ],
  "interviewPrep": {
    "keyThemes": ["<考察重点1>", "<考察重点2>"],
    "sampleQA": [
      { "question": "<高频面试题1>" },
      { "question": "<高频面试题2>" },
      { "question": "<高频面试题3>" },
      { "question": "<高频面试题4>" },
      { "question": "<高频面试题5>" }
    ],
    "languageTip": "<英语面试沟通建议>"
  },

  "applicationPlan": {
    "overview": "<整体投递策略，1-2句>"
  },
  "milestones": [
    {
      "month": "<第1-X周，如：第1-2周>",
      "focus": "<本阶段核心任务，结合目标>",
      "tasks": ["<行动1>", "<行动2>", "<行动3>"]
    },
    {
      "month": "<第Y-Z周，如：第3-4周>",
      "focus": "<本阶段核心任务>",
      "tasks": ["<行动1>", "<行动2>", "<行动3>"]
    },
    {
      "month": "<第A-B周，如：第5-6周>",
      "focus": "<本阶段核心任务>",
      "tasks": ["<行动1>", "<行动2>", "<行动3>"]
    },
    {
      "month": "<第C周起，如：第7-8周>",
      "focus": "<收尾阶段任务>",
      "tasks": ["<行动1>", "<行动2>", "<行动3>"]
    }
  ]
}

关键行动路线生成规则（严格遵守）：
1. 必须强制输出 4-6 个独立的对象到 milestones 数组中，覆盖整个 ${timelineWeeks} 周时间线，做 Backward Planning。禁止用 1 个对象概括所有阶段！
2. 每个 milestone 的 focus 必须结合用户职业方向（${role || '用户背景'}）写出具体目标，禁止写"准备阶段"等空洞描述
3. 每个 milestone 必须有 3 条 tasks，每条必须是字符串（不能是对象），每条≤30字，必须具体可操作
4. tasks 必须体现远程工作准备的特殊性：如异步沟通、远程面试、英文材料、时区协作等，而非泛泛而谈
5. 根据用户资历（${seniority || '中级'}）调整难度：初级突出技能积累和作品集，高级突出领导力和英文沟通
6. 根据目标类型（${goalLabel}）调整策略：全职优先质量投递，兼职/副业优先找发单人、优化个人接单平台档案
7. 必须在 milestones 的 tasks 中结合推荐【Haigoo Remote Club 平台】，而不仅仅推荐其他海外或国内平台
8. tasks 禁止出现 JSON 对象，必须是纯字符串数组

milestones 示例（严格按此格式）：
{ "month": "第1-2周", "focus": "打磨${role || '目标岗位'}远程简历与作品集", "tasks": ["将过往项目按 STAR 法则重写，突出量化成果", "更新 LinkedIn/Haigoo Remote Club 标题摘要并完善档案", "收集 5 个目标 JD，提炼高频关键词清单"] }
{ "month": "第3-4周", "focus": "建立远程求职基础设施", "tasks": ["针对目标岗位制作 1 份定制化英文简历模板", "注册 ${role?.includes('工程') || role?.includes('开发') ? 'GitHub/TopTal/Upwork' : 'Haigoo Remote Club/Remote.co'} 并开始接单/投递", "练习 1 次 30 分钟英文自我介绍视频录制并复盘"] }

`;
  // ── Guest-tier prompt (highly constrained) ───────────────────────────────
  const guestSystemPrompt = SYSTEM_PROMPT_JSON;

  const guestUserPrompt = `用户正在体验 AI Copilot 服务（未登录/未上传深度简历）。
用户画像：
- 求职目标：${goalLabel}
- 期望入职时间：${timeline}（约 ${timelineWeeks} 周）
- 职业方向：${role || '通用职位'}，资历：${seniority || '未指定'}，学历：${education}，工作语言：${language}
${resumeBlock}

数据库实时推荐示例岗位（已按相似度排序）：
${jobsBlock}

请基于以上基础信息，返回以下 JSON，字段均使用中文内容：
{
  "remoteReadiness": {
    "level": "<fit|transformable|not-ready>",
    "score": 50,
    "summary": "<评估该背景实现【${goalLabel}】的可行性结论与建议。最后一句鼓励用户登录并上传简历获取精准分析>",
    "gaps": ["缺少简历数据支撑核心竞争力分析", "暂无法精准匹配高阶岗位技能点"],
    "actions": ["注册并完善个人档案", "上传或解析您的最新简历"]
  },
  "resumeEval": {
    "score": 50,
    "summary": "这是基于标准化画像生成的体验版报告。登录并上传真实简历可获取深度诊断与优化建议。",
    "improvements": ["建议立即登录以保存当前进度", "补充具体项目经验以提升匹配度", "根据目标岗位补充核心技能词汇"]
  },
  "recommendations": [
    {
      "title": "<岗位名>",
      "company": "<公司名>",
      "matchLevel": "<一般匹配>",
      "reason": "<基础推荐理由，注明上传简历后可提升精准度>"
    }
  ],
  "milestones": [
    { "month": "体验期第1阶段", "focus": "了解远程求职基础设施", "tasks": ["注册平台账号", "浏览 3-5 个高匹配岗位 JD"] },
    { "month": "体验期进阶", "focus": "解锁深度定制方案", "tasks": ["完善在线简历", "开启每日系统智能推荐"] },
    { "month": "正式规划", "focus": "获取个人专属执行指南", "tasks": ["升级为完整版计划", "生成精准投递路径"] }
  ]
}

recommendations 优先使用上方实时岗位数据（最多推荐 ${candidateJobs.length > 0 ? candidateJobs.length : 3} 条）。
milestones 必须生成恰好 3 个阶段，第一阶段建议与当前职业方向相关，后续阶段引导注册或提供通用远程建议。每阶段 tasks 必须是字符串数组（不能是对象），每条控制在 30 字以内。`;

  const systemPrompt = isGuest ? guestSystemPrompt : (isMember ? memberSystemPrompt : freeSystemPrompt);
  const userPrompt = isGuest ? guestUserPrompt : (isMember ? memberUserPrompt : freeUserPrompt);
  const model = isMember ? 'qwen-max' : 'qwen-plus';
  const maxTokens = isMember ? 5000 : 2000;

  console.log(`[Copilot] Calling Bailian (${model}) | member=${isMember} | jobs=${candidateJobs.length} | resume=${resumeText ? 'yes' : 'no'}`);

  try {
    const result = await callBailianAPIWithModel(userPrompt, systemPrompt, model, maxTokens);

    if (result && result.content) {
      console.log(`[Copilot] AI raw response (first 500 chars):`, result.content.slice(0, 500));
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
        const readinessScore = parsed.readiness || parsed.resumeEval?.score || (isGuest ? 50 : 0);
        const remoteReadiness = buildRemoteReadiness(parsed, readinessScore);
        const readinessHeadline = remoteReadiness?.summary || '';

        const aiRecommendations = (parsed.recommendations?.map(r => {
          const rawScore = Number(String(r.matchScore || '').replace(/[^0-9]/g, '')) || 0;
          const rawLevel = String(r.matchLevel || '').trim();
          const inferredLevel =
            rawLevel === '高匹配' || rawLevel.toLowerCase() === 'high' ? 'high'
              : rawLevel === '中匹配' || rawLevel.toLowerCase() === 'medium' ? 'medium'
                : rawLevel === '一般匹配' || rawLevel === '低匹配' || rawLevel.toLowerCase() === 'low' ? 'low'
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
            goalFitScore: 0,
            skillAdjacencyScore: 0,
            aiRecommended: AI_RECOMMENDED_TAG_ENABLED && (inferredLevel === 'high' || inferredLevel === 'medium'),
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
            goalFitScore: job.goalFitScore || 0,
            skillAdjacencyScore: job.skillAdjacencyScore || 0,
            aiRecommended: AI_RECOMMENDED_TAG_ENABLED && Boolean(job.aiRecommended),
            matchDetails: job.matchDetails || null,
            matchDetailsLocked: Boolean(job.matchDetailsLocked),
            jobId: job.id
          };
        });

        // ONLY output real recommendations; discard AI hallucinations if candidateJobs is empty
        const normalizedRecommendations = candidateJobs.length > 0
          ? candidateRecommendations
          : [];

        // Standardize output for frontend Component <GeneratedPlanView> and <CopilotSection>
        const normalized = {
          // 1. Fields for <GeneratedPlanView> (Legacy/Guest view)
          readiness: readinessScore,
          remoteReadiness,
          summary: readinessHeadline
            ? `${readinessHeadline}\n${parsed.summary || parsed.applicationPlan?.overview || parsed.resumeEval?.summary || 'AI 匹配并分析完毕。'}`
            : (parsed.summary || parsed.applicationPlan?.overview || parsed.resumeEval?.summary || 'AI 匹配并分析完毕。'),
          strengths: parsed.strengths || parsed.resumeEval?.strengths || [],
          weaknesses: parsed.weaknesses || parsed.resumeEval?.improvements?.map(i => i.issue ? `${i.issue}: ${i.suggestion}` : i) || parsed.resumeEval?.improvements || [],
          milestones: (parsed.milestones || parsed.applicationPlan?.milestones)?.map(m => ({
            month: m.date || (m.week ? `第 ${m.week} 周` : m.month) || '阶段规划',
            focus: m.focus || m.summary || (Array.isArray(m.actions) && typeof m.actions[0] === 'string' ? m.actions[0] : '') || (Array.isArray(m.tasks) && typeof m.tasks[0] === 'string' ? m.tasks[0] : '') || '本阶段重点准备',
            tasks: (() => {
              const rawTasks = m.actions || m.tasks;
              const taskArr = Array.isArray(rawTasks) ? rawTasks
                : rawTasks && typeof rawTasks === 'object' ? Object.values(rawTasks)
                  : rawTasks && typeof rawTasks === 'string' ? [rawTasks]
                    : [];
              return taskArr.map(t =>
                typeof t === 'string' ? t.trim() : (t?.task || t?.action || t?.description || t?.focus || JSON.stringify(t))
              ).filter(Boolean);
            })(),
          })).filter(m => m.focus || m.tasks.length > 0) || (parsed.nextSteps ? parsed.nextSteps.map((step, i) => ({ month: `步骤 ${i + 1}`, focus: step, tasks: [] })) : []),

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

        console.log(`[Copilot] Normalized milestones count: ${normalized.milestones?.length || 0}`, JSON.stringify(normalized.milestones?.slice(0, 2)));

        if (PLAN_V2_ENABLED) {
          const modules = buildInitialPlanModules(parsed);
          normalized.plan_v2 = {
            version: 'v2',
            remoteReadiness,
            goalContext: {
              goal: normalizeGoal(goal),
              timeline,
              role,
              language
            },
            quickPlan: {
              summary: parsed.summary || parsed.applicationPlan?.overview || parsed.resumeEval?.summary || '',
              nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 3) : []
            },
            recommendations: normalizedRecommendations,
            modules
          };
        }

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
    return buildFallbackPlan({ role, timeline, candidateJobs, isMember, goal, language });
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
          response_format: { type: 'json_object' }
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
function buildFallbackPlan({ role, timeline, candidateJobs, isMember, goal, language }) {
  const remoteReadiness = buildRemoteReadiness({}, 65);
  const base = {
    readiness: 65,
    remoteReadiness,
    summary: `${remoteReadiness.summary} 基于您的 ${role} 背景，简历整体具备一定竞争力，但仍有优化空间。`,
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
        goalFitScore: j.goalFitScore || 0,
        skillAdjacencyScore: j.skillAdjacencyScore || 0,
        aiRecommended: AI_RECOMMENDED_TAG_ENABLED && Boolean(j.aiRecommended),
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

  if (PLAN_V2_ENABLED) {
    const modules = buildInitialPlanModules({
      remoteReadiness,
      interviewPrep: base.interviewPrep,
      applicationPlan: base.applicationPlan
    });
    base.plan_v2 = {
      version: 'v2',
      remoteReadiness,
      goalContext: {
        goal: normalizeGoal(goal),
        timeline,
        role,
        language
      },
      quickPlan: {
        summary: base.resumeEval.summary,
        nextSteps: base.nextSteps.slice(0, 3)
      },
      recommendations: base.recommendations,
      modules
    };
  }

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
