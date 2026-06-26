import { purgeExpiredAnalyticsEvents } from '../services/user-activity-service.js';

function isAuthorizedRequest(req) {
  if (req.headers['x-vercel-cron'] === '1') return true;
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || req.headers.Authorization;
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export default async function handler(req, res) {
  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const result = await purgeExpiredAnalyticsEvents();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron:CleanupAnalytics] Failed:', error);
    return res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
}
