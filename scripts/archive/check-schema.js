
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js');

async function checkSchema() {
    if (!neonHelper.isConfigured) {
        console.error('Neon not configured');
        process.exit(1);
    }
    try {
        const columns = await neonHelper.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'jobs' ORDER BY column_name"
        );
        console.table(columns);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSchema();
