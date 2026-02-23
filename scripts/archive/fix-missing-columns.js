
import dotenv from 'dotenv';
import neonHelper from '../server-utils/dal/neon-helper.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function fixMissingColumns() {
    console.log('Fixing missing columns...');
    if (!neonHelper.isConfigured) {
        console.error('DB not configured');
        return;
    }

    try {
        // 1. Fix user_job_interactions (snapshot columns)
        console.log('Adding snapshot columns to user_job_interactions...');
        await neonHelper.query(`
            ALTER TABLE user_job_interactions 
            ADD COLUMN IF NOT EXISTS job_title_snapshot VARCHAR(255),
            ADD COLUMN IF NOT EXISTS company_name_snapshot VARCHAR(255)
        `);

        // 2. Fix trusted_companies (hiring_email)
        console.log('Adding hiring_email to trusted_companies...');
        await neonHelper.query(`
            ALTER TABLE trusted_companies 
            ADD COLUMN IF NOT EXISTS hiring_email VARCHAR(255)
        `);

        console.log('Columns added successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

fixMissingColumns();
