import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { parseAshbyJobsWithDescriptions, isAshbyJobBoard, fetchAshbyJobDescription } from '../lib/ashby-parser.js';

/**
 * Test script to verify Kraken (Ashby) fix
 * Usage: node scripts/test-kraken-ashby.js
 */

const KRAKEN_URL = 'https://jobs.ashbyhq.com/kraken.com';

async function fetchPage(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
}

async function main() {
    console.log('=== Testing Kraken (Ashby) Parser Fix ===\n');
    console.log(`URL: ${KRAKEN_URL}`);
    console.log(`Is Ashby: ${isAshbyJobBoard(KRAKEN_URL)}\n`);

    try {
        console.log('Fetching page...');
        const html = await fetchPage(KRAKEN_URL);

        console.log('Parsing jobs with descriptions (testing first 3 jobs)...\n');
        const result = await parseAshbyJobsWithDescriptions(html, KRAKEN_URL, 'kraken-test', { maxJobs: 3 });

        console.log(`✅ Found ${result.jobs.length} jobs\n`);

        if (result.jobs.length > 0) {
            for (let i = 0; i < Math.min(3, result.jobs.length); i++) {
                const job = result.jobs[i];
                console.log(`--- Job ${i + 1} ---`);
                console.log(`Title: ${job.title}`);
                console.log(`Location: ${job.location}`);
                console.log(`URL: ${job.url}`);
                console.log(`Description Length: ${job.description?.length || 0} chars`);
                console.log(`Description Preview: ${job.description?.substring(0, 200)}...`);
                console.log();
            }
        }

        // Verify success criteria
        const passedCriteria = result.jobs.every(job =>
            job.description &&
            job.description.length > 100 &&
            !job.description.startsWith('FullTime')
        );

        if (passedCriteria) {
            console.log('✅ SUCCESS: All jobs have full descriptions (>100 chars)');
        } else {
            console.log('❌ FAIL: Some jobs have incomplete descriptions');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main().catch(console.error);
