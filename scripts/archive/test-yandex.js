import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { crawlCompanyJobs, fetchJobDetails } from '../lib/job-crawler.js';

async function testYandex() {
    const company = { name: 'Yandex', url: 'https://yandex.com/jobs' };
    console.log(`\n=== Testing ${company.name} ===`);
    console.log(`URL: ${company.url}\n`);

    try {
        const result = await crawlCompanyJobs(
            'yandex',
            company.name,
            company.url,
            { maxJobs: 5, fetchDetails: true }
        );

        if (!result || !result.jobs || result.jobs.length === 0) {
            console.log('❌ No jobs found during crawl');
            // Check if we can fetch HTML to see what's wrong
            return;
        }

        console.log(`✅ Jobs found: ${result.jobs.length}`);

        const firstJob = result.jobs[0];
        console.log(`\n--- Job 1 Analysis ---`);
        console.log(`Title: ${firstJob.title}`);
        console.log(`URL: ${firstJob.url}`);

        if (firstJob.description && firstJob.description.length > 100) {
            console.log(`Description Length: ${firstJob.description.length} chars (Success)`);
        } else {
            console.log(`Description Length: ${firstJob.description?.length || 0} chars (Failed - Summary only)`);
            if (firstJob.description) console.log(`Content: ${firstJob.description.substring(0, 100)}...`);

            // Specific debugging for Yandex
            const details = await fetchJobDetails(firstJob.url, false);
            console.log(`Direct Fetch Description Length: ${details.description?.length || 0}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testYandex().catch(console.error);
