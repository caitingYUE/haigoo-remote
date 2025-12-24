
import neonHelper from '../server-utils/dal/neon-helper.js';

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

    // Batch insert
    // Construct values string
    // Table: analytics_events (user_id, anonymous_id, event_name, properties, url, referrer, created_at)
    
    for (const event of events) {
      const { userId, anonymousId, event: eventName, properties, sentAt } = event;
      
      // Extract common properties
      const url = properties?.path || '';
      const referrer = properties?.referrer || '';
      
      // Clean properties for storage
      const propsJson = JSON.stringify(properties || {});

      await neonHelper.query(`
        INSERT INTO analytics_events 
        (user_id, anonymous_id, event_name, properties, url, referrer, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId || null,
        anonymousId,
        eventName,
        propsJson,
        url,
        referrer,
        sentAt || new Date().toISOString()
      ]);
    }

    return res.status(200).json({ success: true, count: events.length });

  } catch (error) {
    console.error('[Analytics] Error:', error);
    // Don't fail the request to client if analytics fails
    return res.status(200).json({ success: false, error: error.message });
  }
}
