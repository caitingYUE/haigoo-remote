
import neonHelper from './server-utils/dal/neon-helper.js';

async function checkSources() {
    if (!neonHelper.isConfigured) {
        console.log('Neon not configured');
        return;
    }

    try {
        console.log('Checking trusted_companies sources...');
        const result = await neonHelper.query(`
            SELECT source, COUNT(*) as count 
            FROM trusted_companies 
            GROUP BY source
        `);
        console.table(result);

        console.log('Checking extracted_companies count...');
        const extracted = await neonHelper.query(`
            SELECT COUNT(*) as count FROM extracted_companies
        `);
        console.table(extracted);
        
    } catch (e) {
        console.error(e);
    }
}

checkSources();
