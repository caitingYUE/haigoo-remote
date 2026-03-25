
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'
import userHelper from '../../server-utils/user-helper.js'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import { deriveMembershipCapabilities } from '../shared/membership.js'
import { trackServerAnalyticsEvent } from '../services/analytics-event-service.js'

const TRANSLATION_FREE_LIMIT = 100;

async function trackTranslationEvent({ eventName, user, userId, req }) {
    try {
        const body = req?.body && typeof req.body === 'object' ? req.body : {};
        await trackServerAnalyticsEvent({
            event: eventName,
            properties: {
                feature_key: 'translation',
                source_key: body.source_key || body.source || 'translation_usage_api',
                entity_type: body.entity_type || 'job',
                entity_id: body.entity_id || body.jobId || null,
                flow_id: body.flow_id || null,
            }
        }, {
            user,
            userId,
            anonymousId: body.anonymous_id || null,
            pageKey: body.page_key || 'job_detail',
            module: 'membership_experience',
            featureKey: 'translation',
            sourceKey: body.source_key || body.source || 'translation_usage_api',
            entityType: body.entity_type || 'job',
            entityId: body.entity_id || body.jobId || null,
            flowId: body.flow_id || null,
        });
    } catch (error) {
        console.warn('[translation-usage] Failed to track analytics event', error?.message || error);
    }
}

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
    const capabilities = deriveMembershipCapabilities(user);
    if (capabilities.canUseTranslationUnlimited) {
        return res.status(200).json({
            success: true,
            usage: 0,
            limit: -1, // Unlimited
            isMember: true,
            remaining: 9999
        });
    }

    // Handle usage tracking for non-members
    const currentUsage = Number(user.daily_translation_count || 0);

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
            await trackTranslationEvent({ eventName: 'feature_limit_reached', user, userId, req });
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
                 SET daily_translation_count = $1, last_translation_date = NOW() 
                 WHERE user_id = $2`,
                [newUsage, userId]
            );
            await trackTranslationEvent({ eventName: 'feature_consume', user, userId, req });

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
