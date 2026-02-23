
import neonHelper from '../server-utils/dal/neon-helper.js';

async function optimizeDb() {
    console.log('[Optimization] Starting database optimization...');
    if (!neonHelper.isConfigured) {
        console.error('[Optimization] Neon DB not configured!');
        return;
    }

    const indexes = [
        // Jobs table indexes
        'CREATE INDEX IF NOT EXISTS idx_jobs_status_company_category ON jobs(status, company_id, category)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)',
        
        // Trusted Companies table indexes
        'CREATE INDEX IF NOT EXISTS idx_trusted_companies_job_count ON trusted_companies(job_count)',
        'CREATE INDEX IF NOT EXISTS idx_trusted_companies_updated_at ON trusted_companies(updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_trusted_companies_industry ON trusted_companies(industry)',
        'CREATE INDEX IF NOT EXISTS idx_trusted_companies_can_refer ON trusted_companies(can_refer)',
        
        // Search index (Trigram index for ILIKE) - requires pg_trgm extension
        // We'll skip complex extension setup for now and just rely on standard indexes or assume extension exists
        // 'CREATE EXTENSION IF NOT EXISTS pg_trgm',
        // 'CREATE INDEX IF NOT EXISTS idx_trusted_companies_name_trgm ON trusted_companies USING gin (name gin_trgm_ops)',
    ];

    for (const query of indexes) {
        try {
            console.log(`[Optimization] Executing: ${query}`);
            await neonHelper.query(query);
        } catch (e) {
            console.error(`[Optimization] Failed to execute ${query}:`, e.message);
        }
    }

    console.log('[Optimization] Completed.');
}

optimizeDb();
