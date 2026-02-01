
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function simulateCrawl() {
    const { crawlCompanyJobs } = await import('../lib/job-crawler.js');
    const { syncCompanyJobs } = await import('../lib/services/job-sync-service.js');
    const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');
    const companyId = 'osome';
    const companyName = 'Osome';
    const careersUrl = 'https://careers.osome.com/jobs';

    console.log(`[Sim] Starting crawl for ${companyName}...`);

    // 1. Crawl
    const result = await crawlCompanyJobs(companyId, companyName, careersUrl, {
        fetchDetails: true,
        maxDetailFetches: 100,
        concurrency: 3,
        useAI: false
    });

    console.log(`[Sim] Crawler found ${result.jobs?.length || 0} jobs`);

    // 2. Enrich (Simulate what stream-crawl-trusted-jobs does)
    const enrichedJobs = result.jobs.map(job => ({
        ...job,
        company: companyName,
        company_id: companyId
    }));

    console.log(`[Sim] Enriched list has ${enrichedJobs.length} jobs`);

    // 3. Sync
    console.log(`[Sim] Starting sync...`);
    // Before sync, check how many jobs we are passing
    const syncResult = await syncCompanyJobs(companyId, companyName, enrichedJobs);
    console.log(`[Sim] Sync result:`, syncResult);

    // 4. Check DB
    const finalCount = await neonHelper.query("SELECT count(*) FROM jobs WHERE company = 'Osome'");
    console.log(`[Sim] Final DB count for Osome:`, finalCount[0].count);

    process.exit(0);
}

simulateCrawl().catch(console.error);
