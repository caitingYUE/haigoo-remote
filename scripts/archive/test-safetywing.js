import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { crawlSafetyWingJobs } from '../lib/api-handlers/special-crawlers.js';

async function testSafetyWing() {
    const url = 'https://safetywing.pinpointhq.com/';
    console.log(`\n=== Testing SafetyWing ===`);
    console.log(`URL: ${url}\n`);

    try {
        const jobs = await crawlSafetyWingJobs(url);

        console.log(`✅ Parser finished successfully`);
        console.log(`Jobs found: ${jobs.length}`);

        if (jobs.length > 0) {
            const firstJob = jobs[0];
            console.log(`\n--- Job 1 ---`);
            console.log(`Title: ${firstJob.title}`);
            console.log(`URL: ${firstJob.url}`);
            console.log(`Location: ${firstJob.location}`);
        } else {
            console.log('Note: 0 jobs is expected if the site truly has no listings currently.');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testSafetyWing().catch(console.error);
