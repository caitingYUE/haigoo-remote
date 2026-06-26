import neonHelper from '../../server-utils/dal/neon-helper.js';
import userHelper from '../../server-utils/user-helper.js';

const MAX_LIMIT = 100;

function parseDate(value, fallback) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1';
}

function toInt(value) {
  return Number.parseInt(value || 0, 10) || 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = await userHelper.validateAdminRequest(req);
  if (!auth.valid) {
    return res.status(auth.error === 'Forbidden' ? 403 : 401).json({ success: false, error: auth.error || 'Unauthorized' });
  }
  if (!neonHelper.isConfigured) {
    return res.status(503).json({ success: false, error: 'Database not configured' });
  }

  const email = String(req.query.email || '').trim();
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const userRows = await neonHelper.query(
    `SELECT user_id, email, username, created_at, last_login_at
     FROM users WHERE email ILIKE $1 LIMIT 1`,
    [email]
  );
  const user = userRows?.[0];
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, now.toISOString());
  const cursor = parseDate(req.query.cursor, null);
  const eventFamily = String(req.query.eventFamily || '').trim();
  const onlyFailures = parseBoolean(req.query.onlyFailures);
  const limit = Math.min(MAX_LIMIT, Math.max(10, Number.parseInt(String(req.query.limit || 50), 10) || 50));
  const params = [user.user_id, from, to];
  const filters = ['ae.user_id = $1', 'ae.created_at >= $2', 'ae.created_at <= $3'];

  if (eventFamily) {
    params.push(eventFamily);
    filters.push(`COALESCE(ae.event_family, ae.properties->>'event_family', 'interaction') = $${params.length}`);
  }
  if (onlyFailures) {
    filters.push(`COALESCE(ae.outcome, ae.properties->>'outcome', 'succeeded') IN ('failed', 'blocked')`);
  }
  if (cursor) {
    params.push(cursor);
    filters.push(`ae.created_at < $${params.length}`);
  }
  params.push(limit + 1);

  try {
    const [summaryRows, activityRows] = await Promise.all([
      neonHelper.query(
        `SELECT
           MAX(created_at) AS last_activity_at,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS events_7d,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND COALESCE(outcome, properties->>'outcome', 'succeeded') = 'succeeded') AS succeeded_7d,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND COALESCE(outcome, properties->>'outcome', 'succeeded') IN ('failed', 'blocked')) AS failed_7d
         FROM analytics_events WHERE user_id = $1`,
        [user.user_id]
      ),
      neonHelper.query(
        `SELECT ae.event_id, ae.event_name, ae.created_at, ae.page_key, ae.module, ae.feature_key,
                ae.entity_type, ae.entity_id, ae.flow_id, ae.event_family, ae.outcome, ae.severity,
                ae.request_id, ae.duration_ms, ae.http_status, ae.error_code, ae.error_fingerprint,
                ae.release_version, ae.client_context, ae.properties
         FROM analytics_events ae
         WHERE ${filters.join(' AND ')}
         ORDER BY ae.created_at DESC
         LIMIT $${params.length}`,
        params
      )
    ]);

    const rows = activityRows || [];
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map((row) => ({
      eventId: row.event_id,
      eventName: row.event_name,
      occurredAt: row.created_at,
      pageKey: row.page_key || row.properties?.page_key || null,
      module: row.module || row.properties?.module || null,
      featureKey: row.feature_key || row.properties?.feature_key || null,
      entityType: row.entity_type || row.properties?.entity_type || null,
      entityId: row.entity_id || row.properties?.entity_id || null,
      flowId: row.flow_id || row.properties?.flow_id || null,
      eventFamily: row.event_family || row.properties?.event_family || 'interaction',
      outcome: row.outcome || row.properties?.outcome || 'succeeded',
      severity: row.severity || row.properties?.severity || 'info',
      requestId: row.request_id || null,
      durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
      httpStatus: row.http_status == null ? null : Number(row.http_status),
      errorCode: row.error_code || null,
      errorFingerprint: row.error_fingerprint || null,
      releaseVersion: row.release_version || null,
      clientContext: row.client_context || null,
      properties: row.properties || {},
    }));
    const summary = summaryRows?.[0] || {};
    return res.status(200).json({
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        username: user.username,
        registeredAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      summary: {
        lastActivityAt: summary.last_activity_at || null,
        events7d: toInt(summary.events_7d),
        succeeded7d: toInt(summary.succeeded_7d),
        failed7d: toInt(summary.failed_7d),
      },
      events,
      nextCursor: hasMore ? events[events.length - 1]?.occurredAt || null : null,
    });
  } catch (error) {
    console.error('[UserActivity] Failed to load activity:', error);
    return res.status(500).json({ success: false, error: 'Failed to load user activity' });
  }
}
