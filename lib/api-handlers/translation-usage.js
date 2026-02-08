
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'
import userHelper from '../server-utils/user-helper.js'
import neonHelper from '../server-utils/dal/neon-helper.js'

const TRANSLATION_FREE_LIMIT = 3;

export default async function handler(req, res) {
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

    // Check member status - members have unlimited usage
    const isMember = user.memberStatus === 'active' || user.membershipLevel === 'paid' || user.membershipLevel === 'vip';
    if (isMember) {
        return res.status(200).json({
            success: true,
            usage: 0,
            limit: -1, // Unlimited
            isMember: true,
            remaining: 9999
        });
    }

    // Handle usage tracking for non-members
    const today = new Date().toISOString().split('T')[0];
    const lastDate = user.last_translation_date ? new Date(user.last_translation_date).toISOString().split('T')[0] : null;

    let currentUsage = user.daily_translation_count || 0;

    // Reset if new day
    if (lastDate !== today) {
        currentUsage = 0;
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            usage: currentUsage,
            limit: TRANSLATION_FREE_LIMIT,
            isMember: false,
            remaining: Math.max(0, TRANSLATION_FREE_LIMIT - currentUsage)
        });
    }

    if (req.method === 'POST') {
        // Increment usage
        if (currentUsage >= TRANSLATION_FREE_LIMIT) {
            return res.status(403).json({
                success: false,
                error: 'Translation limit reached',
                usage: currentUsage,
                limit: TRANSLATION_FREE_LIMIT,
                isMember: false
            });
        }

        const newUsage = currentUsage + 1;
        
        // Update DB
        try {
            await neonHelper.query(
                `UPDATE users 
                 SET daily_translation_count = $1, last_translation_date = $2 
                 WHERE user_id = $3`,
                [newUsage, today, userId]
            );

            return res.status(200).json({
                success: true,
                usage: newUsage,
                limit: TRANSLATION_FREE_LIMIT,
                isMember: false,
                remaining: Math.max(0, TRANSLATION_FREE_LIMIT - newUsage)
            });
        } catch (e) {
            console.error('Failed to update translation usage:', e);
            return res.status(500).json({ success: false, error: 'Database update failed' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
