
import neonHelper from '../server-utils/dal/neon-helper.js';

async function diagnose() {
    console.log('Starting local DB diagnosis...');
    console.log('DATABASE_URL configured:', neonHelper.isConfigured);

    if (!neonHelper.isConfigured) {
        console.error('DATABASE_URL not found in environment');
        return;
    }

    try {
        // Check tables
        const tables = ['users', 'resumes', 'user_job_matches', 'resume_stats'];

        for (const table of tables) {
            const exists = await neonHelper.tableExists(table);
            const count = exists ? await neonHelper.count(table) : 'N/A';
            console.log(`Table '${table}': Exists=${exists}, Count=${count}`);
        }

        // Check connection
        const now = await neonHelper.query('SELECT NOW()');
        console.log('DB Time:', now?.[0]?.now);

    } catch (error) {
        console.error('Diagnosis failed:', error);
    }
}

diagnose();
