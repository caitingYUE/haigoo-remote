import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { crawlCompanyJobs } from '../lib/job-crawler.js';

async function testMixRank() {
    const company = { name: 'MixRank', url: 'https://www.ycombinator.com/companies/mixrank/jobs' };
    console.log(`\n=== Testing ${company.name} ===`);
    console.log(`URL: ${company.url}\n`);

    try {
        const result = await crawlCompanyJobs(
            'mixrank',
            company.name,
            company.url,
            { maxJobs: 3, fetchDetails: true }
        );

        if (!result || !result.jobs || result.jobs.length === 0) {
            console.log('❌ No jobs found during crawl');
            return;
        }

        console.log(`✅ Jobs found: ${result.jobs.length}`);

        const firstJob = result.jobs[0];
        console.log(`\n--- Job 1 Analysis ---`);
        console.log(`Title: ${firstJob.title}`);
        console.log(`URL: ${firstJob.url}`);

        if (firstJob.description && firstJob.description.length > 50) {
            console.log(`Description Length: ${firstJob.description.length} chars (Success)`);
        } else {
            console.log(`Description Length: ${firstJob.description?.length || 0} chars (Failed)`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testMixRank().catch(console.error);
