import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { crawlCompanyJobs } from '../lib/job-crawler.js';

async function testChainLink() {
    const company = { name: 'ChainLink Labs', url: 'https://chainlinklabs.com/open-roles' };
    console.log(`\n=== Testing ${company.name} ===`);
    console.log(`URL: ${company.url}\n`);

    try {
        const result = await crawlCompanyJobs(
            'chainlink-labs',
            company.name,
            company.url,
            { maxJobs: 5 }
        );

        if (!result || !result.jobs) {
            console.log('❌ No result returned');
            return;
        }

        console.log(`✅ Jobs found: ${result.jobs.length}`);

        if (result.jobs.length > 0) {
            const firstJob = result.jobs[0];
            const descLen = firstJob.description?.length || 0;

            console.log(`\n--- Job 1 ---`);
            console.log(`Title: ${firstJob.title}`);
            console.log(`URL: ${firstJob.url}`);
            console.log(`Description Length: ${descLen} chars`);
            if (descLen > 100) {
                console.log(`Preview: ${firstJob.description.substring(0, 100)}...`);
                console.log('✅ PASS: Full description found');
            } else {
                console.log('❌ FAIL: Description missing or too short');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testChainLink().catch(console.error);
