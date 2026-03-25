
import neonHelper from '../server-utils/dal/neon-helper.js';
import { insertAnalyticsEvents, normalizeAnalyticsEvent } from '../lib/services/analytics-event-service.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    if (!neonHelper.isConfigured) {
      console.warn('[Analytics] Neon DB not configured, skipping tracking');
      return res.status(200).json({ success: true, message: 'Tracking disabled (no DB)' });
    }

    const normalizedEvents = events.map((event) => normalizeAnalyticsEvent(event));
    await insertAnalyticsEvents(normalizedEvents);

    return res.status(200).json({ success: true, count: events.length });

  } catch (error) {
    console.error('[Analytics] Error:', error);
    // Don't fail the request to client if analytics fails
    return res.status(200).json({ success: false, error: error.message });
  }
}
