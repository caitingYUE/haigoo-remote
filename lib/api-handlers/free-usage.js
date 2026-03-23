/**
 * 免费用户体验次数 API Handler
 * 管理三种功能的免费使用额度（累计终身，不重置）:
 *   - company-info: 企业认证信息查看 (3次，共享)
 *   - email-apply:  邮箱直申 (3次，共享)
 *   - referral:     帮我内推 (3次，共享)
 *
 * GET  /api/users?resource=free-usage&type=<TYPE>  → 查询当前次数
 * POST /api/users?resource=free-usage&type=<TYPE>  → 消耗1次
 */

import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'

const FREE_LIMIT = 3;
const SHARED_ACCESS_TYPES = new Set(['company-info', 'email-apply', 'referral']);

// 映射 type → users 表列名
const TYPE_TO_COLUMN = {
    'company-info': 'free_company_info_count',
    'email-apply':  'free_email_apply_count',
    'referral':     'free_referral_count',
    'match-analysis': '__profile_match_analysis__',
};

function normalizeUnlockedCompanies(value) {
    return Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
}

function getSharedAccessState(user) {
    const unlockedCompanies = normalizeUnlockedCompanies(user?.free_unlocked_companies);
    const legacyUsage = [
        Number(user?.free_company_info_count) || 0,
        Number(user?.free_email_apply_count) || 0,
        Number(user?.free_referral_count) || 0,
        unlockedCompanies.length,
    ];

    return {
        usage: Math.max(0, ...legacyUsage),
        unlockedCompanies,
    };
}

async function saveSharedAccessState(userId, nextState) {
    const usage = Math.max(0, Number(nextState?.usage) || 0);
    const unlockedCompanies = normalizeUnlockedCompanies(nextState?.unlockedCompanies);

    await neonHelper.query(
        `UPDATE users
         SET free_company_info_count = $1,
             free_email_apply_count = $1,
             free_referral_count = $1,
             free_unlocked_companies = $2::jsonb,
             updated_at = NOW()
         WHERE user_id = $3`,
        [usage, JSON.stringify(unlockedCompanies), userId]
    );
}

function getMatchAnalysisState(user) {
    const freeUsage = user?.profile?.preferences?.freeUsage || {};
    const matchAnalysis = freeUsage.matchAnalysis || {};
    const unlockedJobIds = Array.isArray(matchAnalysis.unlockedJobIds)
        ? matchAnalysis.unlockedJobIds.map((item) => String(item)).filter(Boolean)
        : [];

    return {
        usage: Number(matchAnalysis.count) || 0,
        unlockedJobIds,
    };
}

async function saveMatchAnalysisState(userId, user, nextState) {
    const nextProfile = {
        ...(user?.profile || {}),
        preferences: {
            ...(user?.profile?.preferences || {}),
            freeUsage: {
                ...(user?.profile?.preferences?.freeUsage || {}),
                matchAnalysis: {
                    count: Number(nextState?.usage) || 0,
                    unlockedJobIds: Array.isArray(nextState?.unlockedJobIds) ? nextState.unlockedJobIds : [],
                }
            }
        }
    };

    await neonHelper.query(
        `UPDATE users SET profile = $1::jsonb, updated_at = NOW() WHERE user_id = $2`,
        [JSON.stringify(nextProfile), userId]
    );
}

export default async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');

    // 校验 type 参数
    const column = TYPE_TO_COLUMN[type];
    if (!column) {
        return res.status(400).json({
            success: false,
            error: `Unknown type: ${type}. Must be one of: ${Object.keys(TYPE_TO_COLUMN).join(', ')}`
        });
    }

    // 验证 token
    const token = extractToken(req);
    const payload = token ? verifyToken(token) : null;

    if (!payload || !payload.userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const userId = payload.userId;
    const user = await userHelper.getUserById(userId);

    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    // 会员用户无限制
    const isMember = user.memberStatus === 'active' || user.membershipLevel === 'paid' || user.membershipLevel === 'vip';
    if (isMember) {
        return res.status(200).json({
            success: true,
            usage: 0,
            limit: -1,
            remaining: 999,
            isMember: true,
        });
    }

    // 读取当前次数
    const currentUsage = user[column] || 0;
    const sharedState = getSharedAccessState(user);

    // ── GET: 查询 ──────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
        if (type === 'match-analysis') {
            const state = getMatchAnalysisState(user);
            return res.status(200).json({
                success: true,
                usage: state.usage,
                limit: FREE_LIMIT,
                remaining: Math.max(0, FREE_LIMIT - state.usage),
                isMember: false,
                unlocked_job_ids: state.unlockedJobIds
            });
        }

        if (SHARED_ACCESS_TYPES.has(type)) {
            return res.status(200).json({
                success: true,
                usage: sharedState.usage,
                limit: FREE_LIMIT,
                remaining: Math.max(0, FREE_LIMIT - sharedState.usage),
                isMember: false,
                unlocked_companies: sharedState.unlockedCompanies,
                sharedAccess: true,
            });
        }

        return res.status(200).json({
            success: true,
            usage: currentUsage,
            limit: FREE_LIMIT,
            remaining: Math.max(0, FREE_LIMIT - currentUsage),
            isMember: false,
        });
    }

    // ── POST: 消耗一次 ─────────────────────────────────────────────────────────
    if (req.method === 'POST') {
        if (type === 'match-analysis') {
            let body = {};
            try {
                if (req.headers['content-type']?.includes('application/json')) {
                    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
                }
            } catch (_e) {
                return res.status(400).json({ success: false, error: 'Invalid JSON body' });
            }

            const jobId = String(body.jobId || '').trim();
            if (!jobId) {
                return res.status(400).json({ success: false, error: 'jobId is required' });
            }

            const state = getMatchAnalysisState(user);
            if (state.unlockedJobIds.includes(jobId)) {
                return res.status(200).json({
                    success: true,
                    usage: state.usage,
                    limit: FREE_LIMIT,
                    remaining: Math.max(0, FREE_LIMIT - state.usage),
                    isMember: false,
                    unlocked_job_ids: state.unlockedJobIds
                });
            }

            if (state.usage >= FREE_LIMIT) {
                return res.status(403).json({
                    success: false,
                    error: 'Free usage limit reached',
                    usage: state.usage,
                    limit: FREE_LIMIT,
                    remaining: 0,
                    isMember: false,
                    unlocked_job_ids: state.unlockedJobIds
                });
            }

            const nextState = {
                usage: state.usage + 1,
                unlockedJobIds: [...state.unlockedJobIds, jobId]
            };

            try {
                await saveMatchAnalysisState(userId, user, nextState);
                return res.status(200).json({
                    success: true,
                    usage: nextState.usage,
                    limit: FREE_LIMIT,
                    remaining: Math.max(0, FREE_LIMIT - nextState.usage),
                    isMember: false,
                    unlocked_job_ids: nextState.unlockedJobIds
                });
            } catch (e) {
                console.error(`[free-usage] Failed to update match-analysis state for user ${userId}:`, e);
                return res.status(500).json({ success: false, error: 'Database update failed' });
            }
        }

        if (SHARED_ACCESS_TYPES.has(type)) {
            let body = {};
            try {
                if (req.headers['content-type']?.includes('application/json')) {
                    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
                }
            } catch (e) {
                return res.status(400).json({ success: false, error: 'Invalid JSON body' });
            }

            const companyName = String(body.companyName || '').trim();
            const unlocked = sharedState.unlockedCompanies;
            
            // 已经是解锁状态直接返回成功
            if (companyName && unlocked.includes(companyName)) {
                return res.status(200).json({
                    success: true,
                    usage: sharedState.usage,
                    limit: FREE_LIMIT,
                    remaining: Math.max(0, FREE_LIMIT - sharedState.usage),
                    isMember: false,
                    unlocked_companies: unlocked,
                    sharedAccess: true,
                });
            }

            if (sharedState.usage >= FREE_LIMIT) {
                return res.status(403).json({
                    success: false,
                    error: 'Free usage limit reached',
                    usage: sharedState.usage,
                    limit: FREE_LIMIT,
                    remaining: 0,
                    isMember: false,
                    unlocked_companies: unlocked,
                    sharedAccess: true,
                });
            }

            const newUnlocked = companyName ? [...new Set([...unlocked, companyName])] : unlocked;
            const nextUsage = Math.max(sharedState.usage + 1, newUnlocked.length);

            try {
                await saveSharedAccessState(userId, {
                    usage: nextUsage,
                    unlockedCompanies: newUnlocked
                });

                return res.status(200).json({
                    success: true,
                    usage: nextUsage,
                    limit: FREE_LIMIT,
                    remaining: Math.max(0, FREE_LIMIT - nextUsage),
                    isMember: false,
                    unlocked_companies: newUnlocked,
                    sharedAccess: true,
                });
            } catch (e) {
                console.error(`[free-usage] Failed to update shared access state for user ${userId}:`, e);
                return res.status(500).json({ success: false, error: 'Database update failed' });
            }
        }

        if (currentUsage >= FREE_LIMIT) {
            return res.status(403).json({
                success: false,
                error: 'Free usage limit reached',
                usage: currentUsage,
                limit: FREE_LIMIT,
                remaining: 0,
                isMember: false,
            });
        }

        const newUsage = currentUsage + 1;

        try {
            await neonHelper.query(
                `UPDATE users SET ${column} = $1, updated_at = NOW() WHERE user_id = $2`,
                [newUsage, userId]
            );

            return res.status(200).json({
                success: true,
                usage: newUsage,
                limit: FREE_LIMIT,
                remaining: Math.max(0, FREE_LIMIT - newUsage),
                isMember: false,
            });
        } catch (e) {
            console.error(`[free-usage] Failed to update ${column} for user ${userId}:`, e);
            return res.status(500).json({ success: false, error: 'Database update failed' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
