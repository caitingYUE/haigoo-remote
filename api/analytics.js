
import neonHelper from '../server-utils/dal/neon-helper.js';
import userHelper from '../server-utils/user-helper.js';
import { extractToken, verifyToken } from '../server-utils/auth-helpers.js';
import { insertAnalyticsEvents, normalizeAnalyticsEvent } from '../lib/services/analytics-event-service.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { events } = req.body;
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ success: true, message: 'No events to track' });
    }

    if (events.length > 20) {
      return res.status(400).json({ success: false, error: 'Too many events in one request' });
    }

    if (!neonHelper.isConfigured) {
      console.warn('[Analytics] Neon DB not configured, skipping tracking');
      return res.status(200).json({ success: true, message: 'Tracking disabled (no DB)' });
    }

    const token = extractToken(req);
    const payload = token ? verifyToken(token) : null;
    const authenticatedUser = payload?.userId ? await userHelper.getUserById(payload.userId) : null;
    const authenticatedUserId = authenticatedUser?.user_id || authenticatedUser?.userId || null;
    const normalizedEvents = events.map((event) => normalizeAnalyticsEvent(event, {
      user: authenticatedUser,
      userId: authenticatedUserId,
      enforceUserId: true,
    }));
    await insertAnalyticsEvents(normalizedEvents);

    return res.status(200).json({ success: true, count: events.length });

  } catch (error) {
    console.error('[Analytics] Error:', error);
    // Don't fail the request to client if analytics fails
    return res.status(200).json({ success: false, error: error.message });
  }
}
