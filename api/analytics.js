
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

    // Lazy initialization of table
    // We do this check once per cold start roughly, or we could just try INSERT and catch error.
    // But for safety let's ensure it exists.
    // Ideally this should be in a migration script, but for "drop-in" reliability:
    await ensureAnalyticsTable();

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

// Helper to ensure table exists
async function ensureAnalyticsTable() {
  try {
    await neonHelper.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        anonymous_id VARCHAR(255),
        event_name VARCHAR(255) NOT NULL,
        properties JSONB,
        url TEXT,
        referrer TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Optional: Create index on event_name and created_at for querying
      -- CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
      -- CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
    `);
  } catch (e) {
    console.error('[Analytics] Failed to ensure table:', e);
  }
}
