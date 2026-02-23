
import dotenv from 'dotenv';
import neonHelper from '../server-utils/dal/neon-helper.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function checkTables() {
    if (!neonHelper.isConfigured) return;

    try {
        const res = await neonHelper.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        const tables = res.map(r => r.table_name);
        console.log('Tables:', tables);
        console.log('Has copilot_sessions:', tables.includes('copilot_sessions'));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkTables();
