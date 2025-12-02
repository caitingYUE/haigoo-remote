import { fetchAllFeeds } from '../services/rss-fetcher.js';
import { saveRawItems } from '../api-handlers/raw-rss.js';

export default async function handler(req, res) {
  // Check for authentication if needed (Vercel cron sends a header)
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  try {
    console.log('[Cron:FetchRSS] Starting...');
    
    // 1. Fetch Feeds
    const items = await fetchAllFeeds();
    console.log(`[Cron:FetchRSS] Fetched ${items.length} items.`);

    if (items.length === 0) {
      console.log('[Cron:FetchRSS] No items found. Exiting.');
      return res.status(200).json({ message: 'No items fetched' });
    }

    // 2. Save to Raw DB (Logic handles deduplication)
    const saved = await saveRawItems(items, 'append');
    console.log(`[Cron:FetchRSS] Saved ${saved.length} unique items.`);

    return res.status(200).json({ 
      success: true, 
      fetched: items.length, 
      saved: saved.length 
    });

  } catch (error) {
    console.error('[Cron:FetchRSS] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
