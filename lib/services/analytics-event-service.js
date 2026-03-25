import crypto from 'crypto';
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { deriveMembershipCapabilities } from '../shared/membership.js';

function normalizeString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
}

export function deriveMembershipState(user) {
  if (!user) return 'none';
  const capabilities = deriveMembershipCapabilities(user);
  return capabilities.memberType || 'none';
}

export function deriveUserSegment(user) {
  if (!user) return 'guest';
  const capabilities = deriveMembershipCapabilities(user);
  return capabilities.isActive ? 'member' : 'free';
}

export function derivePageKey(pathname = '') {
  const path = String(pathname || '').split('?')[0] || '/';
  if (path === '/') return 'home';
  if (path === '/jobs') return 'jobs';
  if (path.startsWith('/job/')) return 'job_detail';
  if (path.startsWith('/job-bundles/')) return 'job_bundle_detail';
  if (path.startsWith('/profile')) return 'profile';
  if (path.startsWith('/membership')) return 'membership';
  if (path.startsWith('/companies/')) return 'company_detail';
  if (path.startsWith('/trusted-companies')) return 'trusted_companies';
  if (path.startsWith('/login')) return 'login';
  if (path.startsWith('/register')) return 'register';
  if (path.startsWith('/admin')) return 'admin';
  return path.replace(/^\/+/, '').replace(/\//g, '_') || 'unknown';
}

export function normalizeAnalyticsEvent(event = {}, options = {}) {
  const properties = event.properties && typeof event.properties === 'object' ? { ...event.properties } : {};
  const mergedProperties = {
    ...properties,
    ...options.properties,
  };

  const user = options.user || null;
  const resolvedUserId = normalizeString(
    options.userId || event.userId || event.user_id || user?.user_id || user?.id,
    null
  );
  const fallbackAnonymousId = resolvedUserId ? `user_${resolvedUserId}` : null;
  const anonymousId = normalizeString(
    options.anonymousId || event.anonymousId || event.anonymous_id || mergedProperties.anonymous_id,
    fallbackAnonymousId || 'anonymous'
  );
  const pathname = normalizeString(
    options.url || options.path || event.url || mergedProperties.path,
    '/'
  );
  const pageKey = normalizeString(
    options.pageKey || event.page_key || mergedProperties.page_key,
    derivePageKey(pathname)
  );

  const normalized = {
    eventId: normalizeString(options.eventId || event.eventId || event.event_id, crypto.randomUUID()),
    eventName: normalizeString(options.eventName || event.event || event.eventName || event.event_name, 'unknown_event'),
    userId: resolvedUserId,
    anonymousId,
    sessionId: normalizeString(options.sessionId || event.sessionId || event.session_id || mergedProperties.session_id, null),
    properties: mergedProperties,
    url: pathname,
    referrer: normalizeString(options.referrer || event.referrer || mergedProperties.referrer, null),
    createdAt: normalizeString(options.createdAt || event.sentAt || event.createdAt || event.created_at, new Date().toISOString()),
    pageKey,
    module: normalizeString(options.module || event.module || mergedProperties.module, null),
    featureKey: normalizeString(options.featureKey || event.feature_key || mergedProperties.feature_key, null),
    sourceKey: normalizeString(options.sourceKey || event.source_key || mergedProperties.source_key, null),
    entityType: normalizeString(options.entityType || event.entity_type || mergedProperties.entity_type, null),
    entityId: normalizeString(options.entityId || event.entity_id || mergedProperties.entity_id, null),
    flowId: normalizeString(options.flowId || event.flow_id || mergedProperties.flow_id, null),
    userSegment: normalizeString(
      options.userSegment || event.user_segment || mergedProperties.user_segment,
      deriveUserSegment(user) || (resolvedUserId ? 'free' : 'guest')
    ),
    membershipState: normalizeString(
      options.membershipState || event.membership_state || mergedProperties.membership_state,
      deriveMembershipState(user)
    ),
  };

  normalized.properties = {
    ...normalized.properties,
    page_key: normalized.pageKey,
    module: normalized.module,
    feature_key: normalized.featureKey,
    source_key: normalized.sourceKey,
    entity_type: normalized.entityType,
    entity_id: normalized.entityId,
    flow_id: normalized.flowId,
    user_segment: normalized.userSegment,
    membership_state: normalized.membershipState,
  };

  return normalized;
}

export async function insertAnalyticsEvents(events = []) {
  if (!neonHelper.isConfigured || !Array.isArray(events) || events.length === 0) {
    return { success: true, count: 0 };
  }

  const values = [];
  const params = [];

  for (const [index, item] of events.entries()) {
    const offset = index * 18;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18})`);
    params.push(
      item.eventId,
      item.userId,
      item.anonymousId,
      item.sessionId,
      item.eventName,
      JSON.stringify(item.properties || {}),
      item.url,
      item.referrer,
      item.createdAt,
      item.pageKey,
      item.module,
      item.featureKey,
      item.sourceKey,
      item.entityType,
      item.entityId,
      item.flowId,
      item.userSegment,
      item.membershipState
    );
  }

  try {
    await neonHelper.query(
      `
        INSERT INTO analytics_events (
          event_id, user_id, anonymous_id, session_id, event_name, properties, url, referrer, created_at,
          page_key, module, feature_key, source_key, entity_type, entity_id, flow_id, user_segment, membership_state
        )
        VALUES ${values.join(', ')}
        ON CONFLICT (event_id) DO NOTHING
      `,
      params
    );
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!/event_id|session_id|page_key|feature_key|source_key|entity_type|entity_id|flow_id|user_segment|membership_state/i.test(message)) {
      throw error;
    }

    const fallbackValues = [];
    const fallbackParams = [];
    for (const [index, item] of events.entries()) {
      const offset = index * 7;
      fallbackValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
      fallbackParams.push(
        item.userId,
        item.anonymousId,
        item.eventName,
        JSON.stringify(item.properties || {}),
        item.url,
        item.referrer,
        item.createdAt
      );
    }

    await neonHelper.query(
      `
        INSERT INTO analytics_events (
          user_id, anonymous_id, event_name, properties, url, referrer, created_at
        )
        VALUES ${fallbackValues.join(', ')}
      `,
      fallbackParams
    );
  }

  return { success: true, count: events.length };
}

export async function trackServerAnalyticsEvent(event = {}, options = {}) {
  const normalized = normalizeAnalyticsEvent(event, options);
  return await insertAnalyticsEvents([normalized]);
}
