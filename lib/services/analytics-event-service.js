import crypto from 'crypto';
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { deriveMembershipCapabilities } from '../shared/membership.js';
import { createErrorFingerprint, normalizeOutcome, normalizeSeverity } from './user-activity-service.js';
import { sanitizeSearchTermProperties } from './search-term-normalizer.js';

const SAFE_PROPERTY_KEYS = new Set([
  'page_key', 'module', 'feature_key', 'source_key', 'entity_type', 'entity_id', 'flow_id',
  'user_segment', 'membership_state', 'method', 'from', 'job_id', 'company_id', 'resume_id',
  'apply_method', 'application_source', 'quota_type', 'stage', 'analysis_mode', 'filter_count',
  'filters', 'result_count', 'has_keyword', 'keyword_present', 'keyword_length', 'query_present',
  'query_length', 'position_type', 'job_type', 'job_direction', 'target_role', 'has_resume',
  'is_member', 'limit', 'usage', 'remaining', 'error_type', 'error_class', 'component',
  'device_type', 'browser', 'os', 'network_type', 'file_type', 'file_size_bucket', 'status',
  'reason', 'event_context', 'client_error', 'recent_events', 'is_empty_result', 'route', 'path',
  'search_term_present', 'search_term_length', 'search_term_length_bucket', 'search_term_normalized',
  'search_term_hash', 'search_term_display', 'search_term_group', 'search_source',
]);

const SENSITIVE_PROPERTY_KEY = /(?:email|password|token|authorization|cookie|resume_text|file_name|filename|content|description|notes|external_url|share_url|referrer|(^|_)url$|(^|_)search$)/i;

function sanitizePropertyValue(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => String(item ?? '').slice(0, 120));
  }
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 240);
  return null;
}

export function sanitizeAnalyticsProperties(properties = {}) {
  const safe = {};
  for (const [key, rawValue] of Object.entries(properties || {})) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) continue;
    if (normalizedKey === 'keyword' || normalizedKey === 'query') {
      const text = String(rawValue || '');
      safe[`${normalizedKey}_present`] = Boolean(text.trim());
      safe[`${normalizedKey}_length`] = Math.min(text.length, 200);
      continue;
    }
    if (!SAFE_PROPERTY_KEYS.has(normalizedKey) || SENSITIVE_PROPERTY_KEY.test(normalizedKey)) continue;
    const value = sanitizePropertyValue(rawValue);
    if (value !== null) safe[normalizedKey] = value;
  }
  if (
    Object.prototype.hasOwnProperty.call(properties || {}, 'search_term_normalized')
    || Object.prototype.hasOwnProperty.call(properties || {}, 'search_term_group')
    || Object.prototype.hasOwnProperty.call(properties || {}, 'search_term_display')
  ) {
    Object.assign(safe, sanitizeSearchTermProperties(properties));
  }
  return safe;
}

function normalizeClientContext(value) {
  if (!value || typeof value !== 'object') return null;
  const context = {};
  for (const key of ['device_type', 'browser', 'os', 'network_type']) {
    const item = String(value[key] || '').trim();
    if (item) context[key] = item.slice(0, 80);
  }
  return Object.keys(context).length ? context : null;
}

function inferEventFamily(eventName) {
  if (/error|exception|crash/i.test(eventName)) return 'client_error';
  if (/search|filter/i.test(eventName)) return 'search';
  if (/apply|referral|application/i.test(eventName)) return 'application';
  if (/resume/i.test(eventName)) return 'resume';
  if (/membership|payment|subscribe|upgrade/i.test(eventName)) return 'membership';
  if (/login|signup|auth/i.test(eventName)) return 'account';
  if (/page|view|job/i.test(eventName)) return 'journey';
  return 'interaction';
}

function normalizeString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
}

function normalizePath(value, fallback = '/') {
  const raw = normalizeString(value, fallback) || fallback;
  return raw.split(/[?#]/)[0] || '/';
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
  if (path.startsWith('/job/') || path.startsWith('/j/')) return 'job_detail';
  if (path.startsWith('/job-bundles/') || path.startsWith('/b/')) return 'job_bundle_detail';
  if (path.startsWith('/profile')) return 'profile';
  if (path.startsWith('/membership')) return 'membership';
  if (path.startsWith('/corporate-english')) return 'corporate_english';
  if (path.startsWith('/companies/') || path.startsWith('/c/')) return 'company_detail';
  if (path.startsWith('/trusted-companies')) return 'trusted_companies';
  if (path.startsWith('/login')) return 'login';
  if (path.startsWith('/register')) return 'register';
  if (path.startsWith('/admin')) return 'admin';
  return path.replace(/^\/+/, '').replace(/\//g, '_') || 'unknown';
}

export function normalizeAnalyticsEvent(event = {}, options = {}) {
  const properties = event.properties && typeof event.properties === 'object' ? event.properties : {};
  const mergedProperties = sanitizeAnalyticsProperties({
    ...properties,
    ...options.properties,
  });

  const user = options.user || null;
  const resolvedUserId = options.enforceUserId
    ? normalizeString(options.userId || user?.user_id || user?.id, null)
    : normalizeString(options.userId || event.userId || event.user_id || user?.user_id || user?.id, null);
  const fallbackAnonymousId = resolvedUserId ? `user_${resolvedUserId}` : null;
  const anonymousId = normalizeString(
    options.anonymousId || event.anonymousId || event.anonymous_id || mergedProperties.anonymous_id,
    fallbackAnonymousId || 'anonymous'
  );
  const pathname = normalizePath(
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
    eventFamily: normalizeString(options.eventFamily || event.event_family || mergedProperties.event_family, null),
    outcome: normalizeOutcome(options.outcome || event.outcome || mergedProperties.outcome, 'succeeded'),
    severity: normalizeSeverity(options.severity || event.severity || mergedProperties.severity, 'info'),
    requestId: normalizeString(options.requestId || event.request_id || mergedProperties.request_id, null),
    durationMs: Number.isFinite(Number(options.durationMs ?? event.duration_ms ?? mergedProperties.duration_ms))
      ? Math.max(0, Math.min(120000, Math.round(Number(options.durationMs ?? event.duration_ms ?? mergedProperties.duration_ms))))
      : null,
    httpStatus: Number.isFinite(Number(options.httpStatus ?? event.http_status ?? mergedProperties.http_status))
      ? Math.max(100, Math.min(599, Math.round(Number(options.httpStatus ?? event.http_status ?? mergedProperties.http_status))))
      : null,
    errorCode: normalizeString(options.errorCode || event.error_code || mergedProperties.error_code, null),
    errorFingerprint: normalizeString(options.errorFingerprint || event.error_fingerprint || mergedProperties.error_fingerprint, null),
    releaseVersion: normalizeString(options.releaseVersion || event.release_version || mergedProperties.release_version, null),
    clientContext: normalizeClientContext(options.clientContext || event.client_context || mergedProperties.client_context),
  };

  normalized.eventFamily = normalized.eventFamily || inferEventFamily(normalized.eventName);
  if ((normalized.outcome === 'failed' || normalized.outcome === 'blocked') && !normalized.errorFingerprint) {
    normalized.errorFingerprint = createErrorFingerprint(normalized.errorCode, normalized.eventName);
  }

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
    event_family: normalized.eventFamily,
    outcome: normalized.outcome,
    severity: normalized.severity,
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
    const offset = index * 28;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25}, $${offset + 26}, $${offset + 27}, $${offset + 28})`);
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
      item.membershipState,
      item.eventFamily,
      item.outcome,
      item.severity,
      item.requestId,
      item.durationMs,
      item.httpStatus,
      item.errorCode,
      item.errorFingerprint,
      item.releaseVersion,
      item.clientContext ? JSON.stringify(item.clientContext) : null
    );
  }

  try {
    await neonHelper.query(
      `
        INSERT INTO analytics_events (
          event_id, user_id, anonymous_id, session_id, event_name, properties, url, referrer, created_at,
          page_key, module, feature_key, source_key, entity_type, entity_id, flow_id, user_segment, membership_state,
          event_family, outcome, severity, request_id, duration_ms, http_status, error_code, error_fingerprint,
          release_version, client_context
        )
        VALUES ${values.join(', ')}
        ON CONFLICT (event_id) DO NOTHING
      `,
      params
    );
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!/event_id|session_id|page_key|feature_key|source_key|entity_type|entity_id|flow_id|user_segment|membership_state|event_family|outcome|severity|request_id|duration_ms|http_status|error_code|error_fingerprint|release_version|client_context/i.test(message)) {
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
