import { deriveMembershipCapabilities } from '../utils/membership';

interface EventProperties {
  [key: string]: any;
}

interface TrackingEvent {
  event: string;
  eventId: string;
  userId: string | null;
  anonymousId: string;
  sessionId: string;
  properties: EventProperties;
  sentAt: string;
  page_key?: string;
  module?: string;
  feature_key?: string;
  source_key?: string;
  entity_type?: string;
  entity_id?: string;
  flow_id?: string;
  user_segment?: string;
  membership_state?: string;
  event_family?: string;
  outcome?: string;
  severity?: string;
  request_id?: string;
  duration_ms?: number;
  http_status?: number;
  error_code?: string;
  error_fingerprint?: string;
  release_version?: string;
  client_context?: Record<string, string>;
}

function normalizeText(value: any, fallback: string | null = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

const SENSITIVE_TRACKING_KEY = /(?:email|password|token|authorization|cookie|resume_text|file_name|filename|content|description|notes|external_url|share_url|referrer|(^|_)url$|(^|_)search$)/i;

function sanitizeTrackingProperties(input: EventProperties) {
  const safe: EventProperties = {};
  for (const [key, rawValue] of Object.entries(input || {})) {
    if (key === 'keyword' || key === 'query') {
      const text = String(rawValue || '');
      safe[`${key}_present`] = Boolean(text.trim());
      safe[`${key}_length`] = Math.min(text.length, 200);
      continue;
    }
    if (SENSITIVE_TRACKING_KEY.test(key)) continue;
    if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      safe[key] = typeof rawValue === 'string' ? rawValue.slice(0, 240) : rawValue;
    } else if (Array.isArray(rawValue)) {
      safe[key] = rawValue.slice(0, 20).map((value) => String(value ?? '').slice(0, 120));
    }
  }
  return safe;
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function derivePageKey(pathname = '/') {
  if (pathname === '/') return 'home';
  if (pathname === '/jobs') return 'jobs';
  if (pathname.startsWith('/job/') || pathname.startsWith('/j/')) return 'job_detail';
  if (pathname.startsWith('/job-bundles/') || pathname.startsWith('/b/')) return 'job_bundle_detail';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/membership')) return 'membership';
  if (pathname.startsWith('/corporate-english')) return 'corporate_english';
  if (pathname.startsWith('/companies/') || pathname.startsWith('/c/')) return 'company_detail';
  if (pathname.startsWith('/trusted-companies')) return 'trusted_companies';
  if (pathname.startsWith('/login')) return 'login';
  if (pathname.startsWith('/register')) return 'register';
  if (pathname.startsWith('/admin')) return 'admin';
  return pathname.replace(/^\/+/, '').replace(/\//g, '_') || 'unknown';
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('haigoo_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function resolveStoredUserId(user: any) {
  const resolved = user?.userId || user?.user_id || user?.id || null;
  const text = String(resolved ?? '').trim();
  return text || null;
}

function getMembershipContext(user: any) {
  if (!user) {
    return { userSegment: 'guest', membershipState: 'none' };
  }
  const capabilities = deriveMembershipCapabilities(user);
  return {
    userSegment: capabilities.isActive ? 'member' : 'free',
    membershipState: capabilities.memberType || 'none',
  };
}

class TrackingService {
  private static instance: TrackingService;
  private anonymousId: string;
  private sessionId: string;
  private userId: string | null = null;
  private queue: TrackingEvent[] = [];
  private recentEventNames: string[] = [];
  private isProcessing = false;
  private API_ENDPOINT = '/api/analytics';

  private constructor() {
    this.anonymousId = this.getAnonymousId();
    this.sessionId = this.getSessionId();
    const storedUser = getStoredUser();
    this.userId = resolveStoredUserId(storedUser);
    setInterval(() => this.flush(), 5000);
    window.addEventListener('beforeunload', () => {
      void this.flush(true);
    });
    window.addEventListener('error', (event) => {
      this.trackClientError('window_error', event.error || event.message, { component: 'window' });
    });
    window.addEventListener('unhandledrejection', (event) => {
      this.trackClientError('unhandled_rejection', event.reason, { component: 'promise' });
    });
  }

  public static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }

  public identify(userId: string) {
    this.userId = userId;
  }

  public reset() {
    this.userId = null;
    this.sessionId = this.createSessionId();
    sessionStorage.setItem('haigoo_session_id', this.sessionId);
  }

  public track(eventName: string, rawProperties: EventProperties = {}) {
    const properties = sanitizeTrackingProperties(rawProperties);
    const pathname = (normalizeText(properties.path, window.location.pathname) || '/').split(/[?#]/)[0] || '/';
    const storedUser = getStoredUser();
    const resolvedUserId = this.userId || resolveStoredUserId(storedUser);
    const membershipContext = getMembershipContext(storedUser);
    const event: TrackingEvent = {
      event: eventName,
      eventId: createUuid(),
      userId: resolvedUserId,
      anonymousId: this.anonymousId,
      sessionId: this.sessionId,
      page_key: normalizeText(properties.page_key, derivePageKey(pathname)) || undefined,
      module: normalizeText(properties.module, null) || undefined,
      feature_key: normalizeText(properties.feature_key, null) || undefined,
      source_key: normalizeText(properties.source_key, null) || undefined,
      entity_type: normalizeText(properties.entity_type, null) || undefined,
      entity_id: normalizeText(properties.entity_id, null) || undefined,
      flow_id: normalizeText(properties.flow_id, null) || undefined,
      user_segment: normalizeText(properties.user_segment, membershipContext.userSegment) || undefined,
      membership_state: normalizeText(properties.membership_state, membershipContext.membershipState) || undefined,
      event_family: normalizeText(properties.event_family, null) || undefined,
      outcome: normalizeText(properties.outcome, null) || undefined,
      severity: normalizeText(properties.severity, null) || undefined,
      request_id: normalizeText(properties.request_id, null) || undefined,
      duration_ms: Number.isFinite(Number(properties.duration_ms)) ? Math.max(0, Math.round(Number(properties.duration_ms))) : undefined,
      http_status: Number.isFinite(Number(properties.http_status)) ? Math.round(Number(properties.http_status)) : undefined,
      error_code: normalizeText(properties.error_code, null) || undefined,
      error_fingerprint: normalizeText(properties.error_fingerprint, null) || undefined,
      release_version: this.getReleaseVersion(),
      client_context: this.getClientContext(),
      properties: {
        ...properties,
        path: pathname,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId,
        page_key: normalizeText(properties.page_key, derivePageKey(pathname)),
        user_segment: normalizeText(properties.user_segment, membershipContext.userSegment),
        membership_state: normalizeText(properties.membership_state, membershipContext.membershipState),
      },
      sentAt: new Date().toISOString(),
    };

    this.queue.push(event);
    this.recentEventNames = [...this.recentEventNames, eventName].slice(-20);
    if (this.queue.length >= 5) {
      void this.flush();
    }
  }

  public pageView(properties: EventProperties = {}) {
    const pathname = normalizeText(properties.path, window.location.pathname) || '/';
    this.track('page_view', {
      title: document.title,
      page_key: properties.page_key || derivePageKey(pathname),
      module: properties.module || 'page',
      ...properties,
    });
  }

  public featureExposure(featureKey: string, properties: EventProperties = {}) {
    this.track('feature_exposure', {
      feature_key: featureKey,
      module: properties.module || 'feature',
      ...properties,
    });
  }

  public featureClick(featureKey: string, properties: EventProperties = {}) {
    this.track('feature_click', {
      feature_key: featureKey,
      module: properties.module || 'feature',
      ...properties,
    });
  }

  public trackClientError(errorCode: string, error: unknown, properties: EventProperties = {}) {
    const normalizedError = error instanceof Error ? error : new Error(String(error || errorCode));
    const stackSummary = String(normalizedError.stack || '')
      .split('\n')
      .slice(0, 5)
      .map((line) => line.replace(/https?:\/\/[^\s)]+/g, '[url]'))
      .join('\n');
    this.track('client_error', {
      ...properties,
      event_family: 'client_error',
      outcome: 'failed',
      severity: 'error',
      error_code: errorCode,
      error_class: normalizedError.name || 'Error',
      error_type: stackSummary || normalizedError.name || 'Error',
      recent_events: this.recentEventNames,
    });
  }

  public async trackedFetch(input: RequestInfo | URL, init: RequestInit = {}, context: EventProperties = {}) {
    const requestId = `req_${createUuid().replace(/-/g, '').slice(0, 24)}`;
    const startedAt = performance.now();
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(rawUrl, window.location.origin).pathname;
    const headers = new Headers(init.headers || {});
    const token = localStorage.getItem('haigoo_auth_token');
    headers.set('X-Request-ID', requestId);
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    try {
      const response = await fetch(input, { ...init, headers });
      const durationMs = Math.round(performance.now() - startedAt);
      this.track('api_request', {
        ...context,
        path: pathname,
        event_family: 'api',
        outcome: response.ok ? 'succeeded' : (response.status === 401 || response.status === 403 || response.status === 409 ? 'blocked' : 'failed'),
        severity: response.ok ? 'info' : 'warning',
        request_id: requestId,
        duration_ms: durationMs,
        http_status: response.status,
        error_code: response.ok ? '' : `HTTP_${response.status}`,
      });
      return response;
    } catch (error) {
      this.trackClientError('NETWORK_REQUEST_FAILED', error, {
        ...context,
        path: pathname,
        event_family: 'api',
        request_id: requestId,
        duration_ms: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  }

  private getAnonymousId(): string {
    let id = localStorage.getItem('haigoo_anonymous_id');
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem('haigoo_anonymous_id', id);
    }
    return id;
  }

  private createSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private getSessionId(): string {
    let id = sessionStorage.getItem('haigoo_session_id');
    if (!id) {
      id = this.createSessionId();
      sessionStorage.setItem('haigoo_session_id', id);
    }
    return id;
  }

  private getClientContext() {
    const userAgent = navigator.userAgent || '';
    return {
      device_type: /Mobi|Android|iPhone|iPad/i.test(userAgent) ? 'mobile' : 'desktop',
      browser: /Edg\//.test(userAgent) ? 'edge' : /Chrome\//.test(userAgent) ? 'chrome' : /Safari\//.test(userAgent) ? 'safari' : /Firefox\//.test(userAgent) ? 'firefox' : 'other',
      os: /Windows/i.test(userAgent) ? 'windows' : /Mac OS/i.test(userAgent) ? 'macos' : /Android/i.test(userAgent) ? 'android' : /iPhone|iPad/i.test(userAgent) ? 'ios' : 'other',
      network_type: (navigator as any).connection?.effectiveType || 'unknown',
    };
  }

  private getReleaseVersion() {
    return String(import.meta.env.VITE_APP_VERSION || 'web').slice(0, 80);
  }

  private async flush(useBeacon = false) {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      const token = localStorage.getItem('haigoo_auth_token');
      if (useBeacon && navigator.sendBeacon && !token) {
        const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
        navigator.sendBeacon(this.API_ENDPOINT, blob);
        return;
      }

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ events: batch }),
        keepalive: useBeacon,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        console.warn('[Tracking] Failed to send events', response.status);
        this.queue = [...batch, ...this.queue].slice(0, 100);
      }
    } catch (error) {
      console.error('[Tracking] Error sending events', error);
      this.queue = [...batch, ...this.queue].slice(0, 100);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const trackingService = TrackingService.getInstance();
