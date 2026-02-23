
import dotenv from 'dotenv';
import neonHelper from '../server-utils/dal/neon-helper.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function inspect() {
    console.log('Inspecting users table...');
    if (!neonHelper.isConfigured) {
        console.error('DB not configured');
        return;
    }

    try {
        const res = await neonHelper.query("SELECT * FROM users LIMIT 1");
        if (res && res.length > 0) {
            console.log('Columns:', Object.keys(res[0]));
            console.log('First row:', res[0]);
        } else {
            console.log('No users found, cannot determine columns easily without querying schema.');
            // Try querying information_schema
            const schema = await neonHelper.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'users'
            `);
            console.log('Schema:', schema);
        }
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit();
}

inspect();
