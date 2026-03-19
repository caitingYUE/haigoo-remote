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
