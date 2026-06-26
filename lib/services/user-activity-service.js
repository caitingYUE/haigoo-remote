import crypto from 'crypto';
import neonHelper from '../../server-utils/dal/neon-helper.js';

export const USER_ACTIVITY_RETENTION_DAYS = 180;

export function getRequestId(req) {
  const value = String(req?.headers?.['x-request-id'] || req?.headers?.['X-Request-ID'] || '').trim();
  return /^[a-zA-Z0-9_-]{8,64}$/.test(value) ? value : null;
}

export function normalizeOutcome(value, fallback = 'succeeded') {
  return ['started', 'succeeded', 'failed', 'blocked'].includes(value) ? value : fallback;
}

export function normalizeSeverity(value, fallback = 'info') {
  return ['debug', 'info', 'warning', 'error', 'critical'].includes(value) ? value : fallback;
}

export function createErrorFingerprint(errorCode, message = '', stack = '') {
  const source = `${String(errorCode || 'unknown').slice(0, 80)}|${String(message || '').slice(0, 240)}|${String(stack || '').split('\n').slice(0, 5).join('\n')}`;
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 32);
}

export async function purgeExpiredAnalyticsEvents(now = new Date()) {
  if (!neonHelper.isConfigured) return { deleted: 0 };
  const rows = await neonHelper.query(
    `DELETE FROM analytics_events
     WHERE created_at < $1
     RETURNING event_id`,
    [new Date(now.getTime() - USER_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()]
  );
  return { deleted: rows?.length || 0 };
}

export async function purgeUserAnalyticsEvents(userId) {
  if (!neonHelper.isConfigured || !userId) return { deleted: 0 };
  const rows = await neonHelper.query(
    'DELETE FROM analytics_events WHERE user_id = $1 RETURNING event_id',
    [userId]
  );
  return { deleted: rows?.length || 0 };
}
