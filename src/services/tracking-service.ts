// import { v4 as uuidv4 } from 'uuid';

/**
 * Tracking Service for Client-Side Analytics
 * Implements the tracking schema defined in AdminTrackingManagement
 */

interface EventProperties {
  [key: string]: any;
}

class TrackingService {
  private static instance: TrackingService;
  private anonymousId: string;
  private userId: string | null = null;
  private queue: any[] = [];
  private isProcessing = false;
  private API_ENDPOINT = '/api/analytics';

  private constructor() {
    this.anonymousId = this.getAnonymousId();
    // Flush queue periodically
    setInterval(() => this.flush(), 5000);
  }

  public static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }

  /**
   * Identify the current user
   */
  public identify(userId: string) {
    this.userId = userId;
    // Track identify event? Maybe not needed for simple analytics, 
    // but useful to link anonymous history.
  }

  /**
   * Clear user identity (logout)
   */
  public reset() {
    this.userId = null;
    // Optionally rotate anonymousId if strict privacy is needed, 
    // but usually we keep it to track device continuity.
  }

  /**
   * Track an event
   */
  public track(eventName: string, properties: EventProperties = {}) {
    const event = {
      event: eventName,
      userId: this.userId,
      anonymousId: this.anonymousId,
      properties: {
        ...properties,
        path: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer,
        timestamp: new Date().toISOString()
      },
      sentAt: new Date().toISOString()
    };

    this.queue.push(event);
    
    // If queue is large, flush immediately
    if (this.queue.length >= 5) {
      this.flush();
    }
  }

  /**
   * Track a page view
   */
  public pageView(properties: EventProperties = {}) {
    this.track('page_view', {
      title: document.title,
      ...properties
    });
  }

  /**
   * Get or create a persistent anonymous ID
   */
  private getAnonymousId(): string {
    let id = localStorage.getItem('haigoo_anonymous_id');
    if (!id) {
      id = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('haigoo_anonymous_id', id);
    }
    return id;
  }

  /**
   * Send events to backend
   */
  private async flush() {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const batch = [...this.queue];
    this.queue = []; // Clear queue

    try {
      // Use beacon if page is unloading, otherwise fetch
      // But beacon doesn't support JSON content-type easily without Blob.
      // Let's stick to fetch for now.
      
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events: batch })
      });

      if (!response.ok) {
        console.warn('[Tracking] Failed to send events', response.status);
        // Retry logic could go here (put back in queue), but skip for simplicity
      }
    } catch (error) {
      console.error('[Tracking] Error sending events', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const trackingService = TrackingService.getInstance();
