import { fetchAllFeeds } from '../services/rss-fetcher.js';
import { saveRawItems } from '../api-handlers/raw-rss.js';

export default async function handler(req, res) {
  // Check for authentication if needed (Vercel cron sends a header)
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  try {
    console.log('[Cron:FetchRSS] Starting...');

    // 1. Fetch Feeds
    let items = [];
    try {
      items = await fetchAllFeeds();
      console.log(`[Cron:FetchRSS] Fetched ${items.length} items.`);
    } catch (fetchError) {
      console.error('[Cron:FetchRSS] Error fetching feeds:', fetchError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch RSS feeds',
        details: fetchError.message
      });
    }

    if (items.length === 0) {
      console.log('[Cron:FetchRSS] No items found. Exiting.');
      return res.status(200).json({
        success: true,
        message: 'No items fetched',
        fetched: 0,
        saved: 0
      });
    }

    // 2. Save to Raw DB (Logic handles deduplication)
    let saved = [];
    try {
      saved = await saveRawItems(items, 'append');
      console.log(`[Cron:FetchRSS] Saved ${saved.length} unique items.`);
    } catch (saveError) {
      console.error('[Cron:FetchRSS] Error saving items:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save RSS items',
        details: saveError.message,
        fetched: items.length
      });
    }

    console.log('[Cron:FetchRSS] Completed successfully.');

    return res.status(200).json({
      success: true,
      fetched: items.length,
      saved: saved.length
    });

  } catch (error) {
    console.error('[Cron:FetchRSS] Error with unexpected exception:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
