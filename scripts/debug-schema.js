import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import neonHelper from '../server-utils/dal/neon-helper.js';

async function checkSchema() {
    if (!neonHelper.isConfigured) {
        console.error('Neon not configured');
        return;
    }
    
    try {
        // Get columns for 'jobs' table
        const result = await neonHelper.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'jobs'
        `);
        
        console.log('Columns in jobs table:');
        result.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
        
        // Check count of unlinked AlphaSights jobs
        const unlinked = await neonHelper.query(`
            SELECT COUNT(*) 
            FROM jobs 
            WHERE (company ILIKE '%AlphaSights%' OR company ILIKE '%Alpha Insights%')
            AND (company_id IS NULL OR is_trusted IS NOT true)
        `);
        console.log(`\nUnlinked AlphaSights jobs: ${unlinked[0].count}`);
        
        // Check count of linked AlphaSights jobs
        const linked = await neonHelper.query(`
            SELECT COUNT(*) 
            FROM jobs 
            WHERE (company ILIKE '%AlphaSights%' OR company ILIKE '%Alpha Insights%')
            AND is_trusted = true
        `);
        console.log(`Linked AlphaSights jobs: ${linked[0].count}`);

    } catch (e) {
        console.error(e);
    }
}

checkSchema();
