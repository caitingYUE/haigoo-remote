
import { crawlCompanyJobs } from '../lib/job-crawler.js';

async function test() {
    console.log('Crawling Osome Job 12...');
    const result = await crawlCompanyJobs('osome', 'Osome', 'https://careers.osome.com/jobs', {
        fetchDetails: true,
        maxDetailFetches: 20
    });

    const job12 = result.jobs.find(j => j.title.includes('Marketing Associate') && j.location.includes('China'));

    if (job12) {
        console.log('✅ Job 12 found!');
        console.log('Title:', job12.title);
        console.log('Location:', job12.location);
        console.log('Description length:', job12.description?.length);
        console.log('Description prefix:', job12.description?.substring(0, 500));

        // Test validation
        const { validateJob } = await import('../lib/utils/job-validator.js');
        const validation = validateJob(job12, 'official');
        console.log('Validation results:', validation);
    } else {
        console.log('❌ Job 12 not found in crawl result');
    }

    process.exit(0);
}

test().catch(console.error);
