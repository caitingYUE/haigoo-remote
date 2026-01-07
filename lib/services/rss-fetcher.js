import { parseRSSFeed } from './rss-parser.js';
import neonHelper from '../../server-utils/dal/neon-helper.js';

/**
 * Fetch RSS sources from database
 */
async function getRSSSources() {
  if (!neonHelper.isConfigured) {
    console.error('[RSSFetcher] Neon is not configured');
    return [];
  }
  
  try {
    const sources = await neonHelper.query(
      'SELECT name, category, url FROM rss_sources WHERE is_active = true'
    );
    return sources || [];
  } catch (error) {
    console.error('[RSSFetcher] Failed to fetch sources from DB:', error);
    return [];
  }
}

/**
 * Fetch and parse a single RSS feed
 */
async function fetchAndParseFeed(source) {
  try {
    console.log(`[RSSFetcher] Fetching ${source.name} (${source.category})...`);
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HaigooBot/1.0; +https://haigoo.io)'
      },
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    
    // Use the enhanced backend parser
    const items = parseRSSFeed(xml, source);
    
    // Enrich items with rawContent for DB storage
    // We store the full parsed JSON structure in rawContent so stream-process-rss.js can use it
    items.forEach(item => {
        // Ensure description is not too long for JSON stringify if needed, 
        // but Postgres TEXT can handle it.
        item.rawContent = JSON.stringify(item);
    });

    console.log(`[RSSFetcher] Parsed ${items.length} items from ${source.name}`);
    return items;
  } catch (error) {
    console.error(`[RSSFetcher] Error fetching ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Fetch all RSS feeds
 */
export async function fetchAllFeeds() {
  const sources = await getRSSSources();
  console.log(`[RSSFetcher] Starting fetch for ${sources.length} sources...`);
  const allItems = [];
  
  // Process in chunks to avoid overwhelming network
  const chunkSize = 3;
  for (let i = 0; i < sources.length; i += chunkSize) {
    const chunk = sources.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(source => fetchAndParseFeed(source)));
    results.forEach(items => allItems.push(...items));
  }

  console.log(`[RSSFetcher] Total items fetched: ${allItems.length}`);
  return allItems;
}
