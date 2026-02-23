
import { crawlCompanyJobs } from './lib/job-crawler.js';

async function bug() {
    const result = await crawlCompanyJobs('chainlink-labs', 'ChainLink Labs', 'https://chainlinklabs.com/open-roles');
    // Result is filtered. Let's look at the raw jobs from ashby.
}
bug();
