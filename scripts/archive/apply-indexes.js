
import neonHelper from './server-utils/dal/neon-helper.js';

async function applyIndexes() {
    console.log('Applying database indexes...');
    
    try {
        await neonHelper.query(`
            CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
            CREATE INDEX IF NOT EXISTS idx_jobs_company_lower ON jobs(lower(company));
            CREATE INDEX IF NOT EXISTS idx_trusted_companies_name_lower ON trusted_companies(lower(name));
        `);
        console.log('Indexes applied successfully!');
    } catch (error) {
        console.error('Failed to apply indexes:', error);
    }
}

applyIndexes();
