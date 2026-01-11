
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchAllFeeds } from '../lib/services/rss-fetcher.js';
import { generateDedupKey } from '../lib/utils/job-utils.js';
import neonHelper from '../server-utils/dal/neon-helper.js';

async function testManualRSS() {
    console.log('🧪 Testing RSS Fetch and Dedup Logic...');

    // 1. Fetch Feeds (Just one for testing to be fast)
    // We mock fetchAllFeeds to only fetch one URL or just filter after
    // Actually, let's just use the real fetchAllFeeds but limit it if possible? 
    // fetchAllFeeds fetches ALL. Let's just manually fetch one using internal logic if we can, 
    // or just run it and see (might take time).
    // Better: reimplement the fetch for one URL to debug.
    
    const testSource = {
        name: 'WeWorkRemotely',
        category: '全部',
        url: 'https://weworkremotely.com/remote-jobs.rss'
    };

    console.log(`Fetching ${testSource.url}...`);
    const { parseRSSFeed } = await import('../lib/services/rss-parser.js');
    
    const response = await fetch(testSource.url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HaigooBot/1.0; +https://haigoo.io)'
        }
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const xml = await response.text();
    const items = parseRSSFeed(xml, testSource);
    
    console.log(`Parsed ${items.length} items.`);
    if (items.length === 0) return;

    // 2. Check Dedup Logic
    console.log('Checking duplicates against DB...');
    
    // Fetch existing raw items to compare (simulation of DB check)
    // In raw-rss.js: removeDuplicatesRaw checks against *itself* (the batch), 
    // but the DB insert uses ON CONFLICT (raw_id).
    // And raw_id is generated from dedup key.
    
    let newCount = 0;
    let duplicateCount = 0;
    let dbDuplicateCount = 0;

    for (const item of items) {
        // Generate ID
        const dedupKey = generateDedupKey(item);
        const rawId = dedupKey.startsWith('id:') ? dedupKey.slice(3) : dedupKey.replace('hash:', 'raw_');
        
        // Check if exists in DB
        const exists = await neonHelper.query('SELECT 1 FROM raw_rss WHERE raw_id = $1', [rawId]);
        
        if (exists && exists.length > 0) {
            dbDuplicateCount++;
            // console.log(`[Duplicate] ${item.title} (ID: ${rawId})`);
        } else {
            newCount++;
            console.log(`[NEW] ${item.title} (ID: ${rawId})`);
        }
    }

    console.log('--- Summary ---');
    console.log(`Total Parsed: ${items.length}`);
    console.log(`Existing in DB: ${dbDuplicateCount}`);
    console.log(`New Items: ${newCount}`);
    
    if (newCount === 0) {
        console.log('❌ All items are duplicates. This explains +0.');
    } else {
        console.log('✅ Found new items! The +0 might be due to processing failure or filter.');
    }
}

testManualRSS().catch(console.error);
