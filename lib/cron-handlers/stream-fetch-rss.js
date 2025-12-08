import { fetchAllFeeds } from '../services/rss-fetcher.js';
import { saveRawItems } from '../api-handlers/raw-rss.js';

export default async function handler(req, res) {
  // Check for authentication if needed (Vercel cron sends a header)
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  // Set streaming headers for Edge Runtime compatibility
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    console.log('[Cron:FetchRSS] Starting...');
    
    // Send start message immediately
    res.write(JSON.stringify({
      type: 'start',
      message: 'RSS抓取任务开始执行',
      timestamp: new Date().toISOString()
    }) + '\n\n');

    // 1. Fetch Feeds
    let items = [];
    try {
      res.write(JSON.stringify({
        type: 'fetch_start',
        message: '开始抓取RSS源',
        timestamp: new Date().toISOString()
      }) + '\n\n');
      
      items = await fetchAllFeeds();
      console.log(`[Cron:FetchRSS] Fetched ${items.length} items.`);
      
      res.write(JSON.stringify({
        type: 'fetch_complete',
        message: `RSS抓取完成，共获取 ${items.length} 个项目`,
        fetchedCount: items.length,
        timestamp: new Date().toISOString()
      }) + '\n\n');
      
    } catch (fetchError) {
      console.error('[Cron:FetchRSS] Error fetching feeds:', fetchError);
      res.write(JSON.stringify({
        type: 'error',
        error: 'Failed to fetch RSS feeds',
        details: fetchError.message,
        timestamp: new Date().toISOString()
      }) + '\n\n');
      res.end();
      return;
    }

    if (items.length === 0) {
      console.log('[Cron:FetchRSS] No items found. Exiting.');
      res.write(JSON.stringify({
        type: 'complete',
        message: '未找到任何项目，任务完成',
        fetched: 0,
        saved: 0,
        timestamp: new Date().toISOString()
      }) + '\n\n');
      res.end();
      return;
    }

    // 2. Save to Raw DB (Logic handles deduplication)
    let saved = [];
    try {
      res.write(JSON.stringify({
        type: 'save_start',
        message: '开始保存项目到数据库',
        timestamp: new Date().toISOString()
      }) + '\n\n');
      
      saved = await saveRawItems(items, 'append');
      console.log(`[Cron:FetchRSS] Saved ${saved.length} unique items.`);
      
      res.write(JSON.stringify({
        type: 'save_complete',
        message: `保存完成，共保存 ${saved.length} 个唯一项目`,
        savedCount: saved.length,
        timestamp: new Date().toISOString()
      }) + '\n\n');
      
    } catch (saveError) {
      console.error('[Cron:FetchRSS] Error saving items:', saveError);
      res.write(JSON.stringify({
        type: 'error',
        error: 'Failed to save RSS items',
        details: saveError.message,
        fetched: items.length,
        timestamp: new Date().toISOString()
      }) + '\n\n');
      res.end();
      return;
    }

    console.log('[Cron:FetchRSS] Completed successfully.');

    // Send final completion message
    res.write(JSON.stringify({
      type: 'complete',
      message: 'RSS抓取任务完成',
      stats: {
        fetched: items.length,
        saved: saved.length
      },
      timestamp: new Date().toISOString()
    }) + '\n\n');
    res.end();

  } catch (error) {
    console.error('[Cron:FetchRSS] Error with unexpected exception:', error);
    res.write(JSON.stringify({
      type: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }) + '\n\n');
    res.end();
  }
}
