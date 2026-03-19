/**
 * 免费用户体验次数 API Handler
 * 管理三种功能的免费使用额度（累计终身，不重置）:
 *   - company-info: 企业认证信息查看 (5次)
 *   - email-apply:  邮箱直申 (5次)
 *   - referral:     帮我内推 (5次)
 *
 * GET  /api/users?resource=free-usage&type=<TYPE>  → 查询当前次数
 * POST /api/users?resource=free-usage&type=<TYPE>  → 消耗1次
 */

import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'

const FREE_LIMIT = 5;

// 映射 type → users 表列名
const TYPE_TO_COLUMN = {
    'company-info': 'free_company_info_count',
    'email-apply':  'free_email_apply_count',
    'referral':     'free_referral_count',
};

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

    // ── GET: 查询 ──────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
        if (type === 'company-info') {
            const unlocked = user.free_unlocked_companies || [];
            return res.status(200).json({
                success: true,
                usage: unlocked.length,
                limit: FREE_LIMIT,
                remaining: Math.max(0, FREE_LIMIT - unlocked.length),
                isMember: false,
                unlocked_companies: unlocked
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
        if (type === 'company-info') {
            let body = {};
            try {
                // If it's a GET masquerading as POST somehow, or just body parse
                if (req.headers['content-type']?.includes('application/json')) {
                    // This is a node API handler, body might already be parsed or we might need to parse it (Next.js/Vercel standard)
                    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
                }
            } catch (e) {
                return res.status(400).json({ success: false, error: 'Invalid JSON body' });
            }

            const companyName = body.companyName;
            if (!companyName) {
                return res.status(400).json({ success: false, error: 'companyName is required' });
            }

            const unlocked = Array.isArray(user.free_unlocked_companies) ? user.free_unlocked_companies : [];
            
            // 已经是解锁状态直接返回成功
            if (unlocked.includes(companyName)) {
                return res.status(200).json({
                    success: true,
                    usage: unlocked.length,
                    limit: FREE_LIMIT,
                    remaining: Math.max(0, FREE_LIMIT - unlocked.length),
                    isMember: false,
                    unlocked_companies: unlocked
                });
            }

            if (unlocked.length >= FREE_LIMIT) {
                return res.status(403).json({
                    success: false,
                    error: 'Free usage limit reached',
                    usage: unlocked.length,
                    limit: FREE_LIMIT,
                    remaining: 0,
                    isMember: false,
                    unlocked_companies: unlocked
                });
            }

            const newUnlocked = [...unlocked, companyName];
            try {
                await neonHelper.query(
                    `UPDATE users SET free_unlocked_companies = $1::jsonb, updated_at = NOW() WHERE user_id = $2`,
                    [JSON.stringify(newUnlocked), userId]
                );
                return res.status(200).json({
                    success: true,
                    usage: newUnlocked.length,
                    limit: FREE_LIMIT,
                    remaining: Math.max(0, FREE_LIMIT - newUnlocked.length),
                    isMember: false,
                    unlocked_companies: newUnlocked
                });
            } catch (e) {
                console.error(`[free-usage] Failed to update unlocked_companies for user ${userId}:`, e);
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
