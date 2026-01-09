
import { crawlCompanyJobs } from '../lib/job-crawler.js';

// Get args
const args = process.argv.slice(2);
const companyName = args[0];
const url = args[1];

if (!companyName || !url) {
    console.error('Usage: node scripts/test-crawler.js <companyName> <url>');
    process.exit(1);
}

console.log(`Testing crawler for ${companyName} at ${url}...`);

try {
    const result = await crawlCompanyJobs('test-id', companyName, url, { fetchDetails: true, maxDetailFetches: 1, useAI: false });
    console.log('--- Result ---');
    console.log(`Found ${result.jobs.length} jobs`);
    if (result.jobs.length > 0) {
        console.log('First job sample:');
        console.log(JSON.stringify(result.jobs[0], null, 2));
    } else {
        console.log('No jobs found.');
    }
} catch (error) {
    console.error('Error:', error);
}
