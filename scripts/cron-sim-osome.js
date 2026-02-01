
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function simulateCronTask() {
    const { crawlCompanyJobs } = await import('../lib/job-crawler.js');
    const { syncCompanyJobs } = await import('../lib/services/job-sync-service.js');
    const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');
    const company = {
        id: 'company_1767092689853_d4cw6mnn8',
        name: 'osome',
        careersPage: 'https://careers.osome.com/jobs'
    };

    console.log(`[CronSim] Replicating cron task for ${company.name}...`);

    // 1. Crawl (exactly like stream-crawl-trusted-jobs.js line 287)
    const result = await crawlCompanyJobs(company.id, company.name, company.careersPage, {
        fetchDetails: true,
        maxDetailFetches: 100,
        concurrency: 3,
        useAI: true
    });

    console.log(`[CronSim] Crawler found ${result.jobs?.length || 0} jobs`);

    // 2. Enrich (exactly like line 322)
    const enrichedJobs = result.jobs.map(job => ({
        ...job,
        company: company.name,
        company_id: company.id
    }));

    console.log(`[CronSim] Enriched list has ${enrichedJobs.length} jobs`);

    // 3. Sync (exactly like line 328)
    const syncResult = await syncCompanyJobs(company.id, company.name, enrichedJobs);
    console.log(`[CronSim] Sync result:`, syncResult);

    process.exit(0);
}

simulateCronTask().catch(console.error);
