
import { parseWorkableJobs } from './lib/workable-parser.js';
import * as cheerio from 'cheerio';

async function testCrawlerFlow() {
    const url = 'https://apply.workable.com/whitespectre/';
    const companyId = 'test-company-id';

    console.log(`[Test] Starting crawl flow for ${url}`);

    // Simulate detection
    if (url.includes('apply.workable.com')) {
        console.log('[Test] Detected Workable job board (Simulated isWorkableJobBoard)');
        try {
            const result = await parseWorkableJobs(url, companyId);
            if (result && result.jobs && result.jobs.length > 0) {
                console.log(`[Test] Workable parser found ${result.jobs.length} jobs`);
                console.log('[Test] First job:', JSON.stringify(result.jobs[0], null, 2));
            } else {
                console.log('[Test] Workable parser found 0 jobs');
            }
        } catch (e) {
            console.error('[Test] Workable parser error:', e);
        }
    } else {
        console.log('[Test] Failed to detect Workable job board');
    }
}

testCrawlerFlow();
