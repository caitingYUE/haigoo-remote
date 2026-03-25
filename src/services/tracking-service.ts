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
}

function normalizeText(value: any, fallback: string | null = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
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
  if (pathname.startsWith('/job/')) return 'job_detail';
  if (pathname.startsWith('/job-bundles/')) return 'job_bundle_detail';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/membership')) return 'membership';
  if (pathname.startsWith('/companies/')) return 'company_detail';
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
  private isProcessing = false;
  private API_ENDPOINT = '/api/analytics';

  private constructor() {
    this.anonymousId = this.getAnonymousId();
    this.sessionId = this.getSessionId();
    const storedUser = getStoredUser();
    this.userId = storedUser?.user_id || storedUser?.id || null;
    setInterval(() => this.flush(), 5000);
    window.addEventListener('beforeunload', () => {
      void this.flush(true);
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

  public track(eventName: string, properties: EventProperties = {}) {
    const pathname = normalizeText(properties.path, window.location.pathname) || '/';
    const storedUser = getStoredUser();
    const resolvedUserId = this.userId || storedUser?.user_id || storedUser?.id || null;
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
      properties: {
        ...properties,
        path: pathname,
        search: properties.search ?? window.location.search,
        referrer: properties.referrer ?? document.referrer,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId,
        page_key: normalizeText(properties.page_key, derivePageKey(pathname)),
        user_segment: normalizeText(properties.user_segment, membershipContext.userSegment),
        membership_state: normalizeText(properties.membership_state, membershipContext.membershipState),
      },
      sentAt: new Date().toISOString(),
    };

    this.queue.push(event);
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

  private async flush(useBeacon = false) {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      if (useBeacon && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
        navigator.sendBeacon(this.API_ENDPOINT, blob);
        return;
      }

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
      });

      if (!response.ok) {
        console.warn('[Tracking] Failed to send events', response.status);
      }
    } catch (error) {
      console.error('[Tracking] Error sending events', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const trackingService = TrackingService.getInstance();
