
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js');

async function migrate() {
    if (!neonHelper.isConfigured) {
        console.error('Neon not configured');
        process.exit(1);
    }
    try {
        console.log('Adding expires_at column...');
        await neonHelper.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expires_at timestamp without time zone");
        console.log('Successfully added expires_at column');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}
migrate();
