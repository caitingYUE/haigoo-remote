import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { crawlCompanyJobs, fetchJobDetails } from '../lib/job-crawler.js';

async function testOsome() {
    const company = { name: 'Osome', url: 'https://careers.osome.com/jobs' };
    console.log(`\n=== Testing ${company.name} ===`);
    console.log(`URL: ${company.url}\n`);

    try {
        // First test the crawl to get a valid job URL
        const result = await crawlCompanyJobs(
            'osome',
            company.name,
            company.url,
            { maxJobs: 3, fetchDetails: true }
        );

        if (!result || !result.jobs || result.jobs.length === 0) {
            console.log('❌ No jobs found during crawl');
            return;
        }

        console.log(`✅ Jobs found: ${result.jobs.length}`);

        // Pick the first job and try to fetch details explicitly to see debug logs
        const firstJob = result.jobs[0];
        console.log(`\n--- Job 1 Analysis ---`);
        console.log(`Title: ${firstJob.title}`);
        console.log(`URL: ${firstJob.url}`);

        if (firstJob.description && firstJob.description.length > 50) {
            console.log(`Crawl Description Length: ${firstJob.description.length} chars (Success)`);
        } else {
            console.log(`Crawl Description Length: ${firstJob.description?.length || 0} chars (Failed)`);

            // Try fetching details directly with debug enabled
            console.log(`\n[Test] Fetching details directly for: ${firstJob.url}`);
            const details = await fetchJobDetails(firstJob.url, false);
            console.log(`Direct Fetch Description Length: ${details.description?.length || 0} chars`);
            if (details.description) {
                console.log(`Preview: ${details.description.substring(0, 100)}...`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testOsome().catch(console.error);
