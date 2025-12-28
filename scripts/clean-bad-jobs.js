import fs from 'fs';
import path from 'path';
import { validateJob } from '../lib/utils/job-validator.js';

// Manually load .env
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
        console.log('[Setup] Loaded .env file');
    }
} catch (e) {
    console.error('[Setup] Failed to load .env:', e);
}

// Dynamic import for neonHelper
const neonHelperModule = await import('../server-utils/dal/neon-helper.js');
const neonHelper = neonHelperModule.default;

async function run() {
    if (!neonHelper.isConfigured) {
        console.error('Neon not configured');
        process.exit(1);
    }

    const isDryRun = process.argv.includes('--dry-run');
    console.log(`[Start] Running in ${isDryRun ? 'DRY RUN' : 'LIVE'} mode...`);

    try {
        // 1. Fetch active jobs to scan
        // We only care about active jobs to save memory/time, or scan all? 
        // Let's scan 'active' jobs to clean up the live site first.
        console.log('[Scan] Fetching active jobs...');
        const jobs = await neonHelper.query(`
      SELECT id, title, company, description, source, source_type 
      FROM jobs 
      WHERE status = 'active'
    `);

        console.log(`[Scan] Found ${jobs.length} active jobs. Validating...`);

        const badJobs = [];
        const stats = {
            INVALID_COMPANY_NAME: 0,
            MISSING_DESCRIPTION: 0,
            DESCRIPTION_TOO_SHORT: 0,
            INVALID_DESCRIPTION_CONTENT: 0
        };

        for (const job of jobs) {
            // Default to 'official' if missing, but DB usually has it.
            // 'third-party' is RSS. 'official' is Trusted.
            const result = validateJob(job, job.source_type || 'official');
            if (!result.isValid) {
                badJobs.push({
                    id: job.id,
                    title: job.title,
                    company: job.company,
                    reason: result.reason,
                    source: job.source,
                    source_type: job.source_type
                });

                // Update stats
                const key = result.reason.split('(')[0].trim();
                stats[key] = (stats[key] || 0) + 1;
            }
        }

        console.log('\n--- SCAN RESULTS ---');
        console.log(`Total Scanned: ${jobs.length}`);
        console.log(`Bad Jobs Found: ${badJobs.length}`);
        console.log('Breakdown by Reason:');
        console.log(JSON.stringify(stats, null, 2));

        if (badJobs.length > 0) {
            console.log('\n--- EXAMPLES OF BAD JOBS ---');
            badJobs.slice(0, 5).forEach(j => {
                console.log(`[${j.id}] ${j.company} - ${j.title} | Reason: ${j.reason} | Src: ${j.source}`);
            });
        }

        if (!isDryRun && badJobs.length > 0) {
            console.log('\n[Action] Archiving bad jobs...');
            const ids = badJobs.map(j => j.id);

            // Batch update in chunks of 50 to be safe
            const chunkSize = 50;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                // Using neonHelper.query to update
                // Need to construct IN clause specifically for numbers
                const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(',');
                await neonHelper.query(`
          UPDATE jobs 
          SET status = 'archived', updated_at = NOW() 
          WHERE id IN (${placeholders})
        `, chunk);
                console.log(`[Action] Archived items ${i + 1} to ${i + chunk.length}`);
            }
            console.log('[Success] Cleanup complete.');
        } else {
            console.log('\n[Action] Dry run complete. No changes made.');
        }

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
