import fs from 'fs';
import path from 'path';

async function run() {
    // 1. Load .env manually
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            envContent.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                    process.env[key] = value;
                }
            });
            console.log('Loaded .env file');
        }
    } catch (e) {
        console.error('Failed to load .env:', e);
    }

    // 2. Dynamic import neonHelper
    let neonHelper;
    try {
        const module = await import('./server-utils/dal/neon-helper.js');
        neonHelper = module.default;
    } catch (e) {
        console.error('Failed to import neonHelper:', e);
        process.exit(1);
    }

    if (!neonHelper.isConfigured) {
        console.error('Neon not configured (DATABASE_URL missing)');
        process.exit(1);
    }

    try {
        // 3. Authenticated Data Fetch for Expanded Report

        // A. RSS Examples (Remotive Focus - Raw Only)
        console.log('--- RSS: REMOTIVE (RAW ONLY) ---');
        const remotiveRaw = await neonHelper.query(`
      SELECT raw_id, title, description, link, status, processing_error
      FROM raw_rss
      WHERE source = 'Remotive'
      LIMIT 2
    `);
        console.log(JSON.stringify(remotiveRaw, null, 2));

        // 3. Comprehensive Data Scan

        // A. "Unknown Company" Analysis (RSS)
        console.log('--- RSS: UNKNOWN COMPANY STATS ---');
        const unknownStats = await neonHelper.query(`
      SELECT source, COUNT(*) as count 
      FROM jobs 
      WHERE company = 'Unknown Company' OR company IS NULL
      GROUP BY source
    `);
        console.log(JSON.stringify(unknownStats, null, 2));

        // B. Trusted Crawler Quality Scan (Null/Short Descriptions)
        console.log('--- CRAWLER: DESCRIPTION QUALITY ISSUES ---');
        const descIssues = await neonHelper.query(`
      SELECT j.id, j.title, j.company, length(j.description) as desc_len, j.source_type
      FROM jobs j
      WHERE j.is_trusted = true AND (j.description IS NULL OR length(j.description) < 100)
      ORDER BY j.published_at DESC
      LIMIT 10
    `);
        console.log(JSON.stringify(descIssues, null, 2));

        // C. Mid-Tier Company Check (MixRank, Appwrite, Canonical, MongoDB)
        console.log('--- CRAWLER: MIXRANK (Check JD) ---');
        const mixrank = await neonHelper.query(`
      SELECT title, company, length(description) as len, description, status FROM jobs WHERE company = 'MixRank' LIMIT 1
    `);
        console.log(JSON.stringify(mixrank, null, 2));

        console.log('--- CRAWLER: APPWRITE (Check JD) ---');
        const appwrite = await neonHelper.query(`
      SELECT title, company, length(description) as len, description, status FROM jobs WHERE company = 'Appwrite' LIMIT 1
    `);
        console.log(JSON.stringify(appwrite, null, 2));

        console.log('--- CRAWLER: CANONICAL (Check JD) ---');
        const canonical = await neonHelper.query(`
      SELECT title, company, length(description) as len, description, status FROM jobs WHERE company = 'Canonical' LIMIT 1
    `);
        console.log(JSON.stringify(canonical, null, 2));

        console.log('--- CRAWLER: MONGODB (Check JD) ---');
        const mongodb = await neonHelper.query(`
      SELECT title, company, length(description) as len, description, status FROM jobs WHERE company = 'MongoDB' LIMIT 1
    `);
        console.log(JSON.stringify(mongodb, null, 2));

        console.log('--- CRAWLER: DOCKER (Check JD) ---');
        const docker = await neonHelper.query(`
        SELECT title, company, length(description) as len, description, status FROM jobs WHERE company = 'Docker' LIMIT 1
      `);
        console.log(JSON.stringify(docker, null, 2));


        // Check Remotive Jobs in Jobs table
        console.log('--- RSS: REMOTIVE (JOBS TABLE) ---');
        const remotiveJobs = await neonHelper.query(`
      SELECT id, job_id, title, company
      FROM jobs
      WHERE source = 'Remotive'
      LIMIT 2
    `);
        console.log(JSON.stringify(remotiveJobs, null, 2));


        // B. Trusted Crawler Failure Cases

        // 1. AlphaSights (Suspected missing JDs)
        console.log('--- CRAWLER: ALPHASIGHTS ---');
        const alphasights = await neonHelper.query(`
      SELECT j.id, j.title, j.company, j.location, j.tags, j.description, j.source_type, j.is_trusted, tc.source as company_source
      FROM jobs j
      JOIN trusted_companies tc ON j.company_id = tc.company_id
      WHERE j.company = 'AlphaSights'
      ORDER BY j.published_at DESC
      LIMIT 1
    `);
        console.log(JSON.stringify(alphasights, null, 2));

        // 2. Salesforce (Another large one, usually complex to crawl)
        console.log('--- CRAWLER: SALESFORCE ---');
        const salesforce = await neonHelper.query(`
      SELECT j.id, j.title, j.company, j.location, j.tags, j.description, j.source_type, j.is_trusted, tc.source as company_source
      FROM jobs j
      JOIN trusted_companies tc ON j.company_id = tc.company_id
      WHERE j.company = 'Salesforce'
      ORDER BY j.published_at DESC
      LIMIT 1
    `);
        console.log(JSON.stringify(salesforce, null, 2));

        // 3. Re-verify a good one just in case (e.g. Appwrite or Taskade)
        console.log('--- CRAWLER: TASKADE (Control) ---');
        const taskade = await neonHelper.query(`
      SELECT j.id, j.title, j.company, j.location, j.tags, j.description, j.source_type, j.is_trusted, tc.source as company_source
      FROM jobs j
      JOIN trusted_companies tc ON j.company_id = tc.company_id
      WHERE j.company = 'Taskade'
      ORDER BY j.published_at DESC
      LIMIT 1
    `);
        console.log(JSON.stringify(taskade, null, 2));




    } catch (err) {
        console.error(err);
    }
}

run();
