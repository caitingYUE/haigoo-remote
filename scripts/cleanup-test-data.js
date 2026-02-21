
import dotenv from 'dotenv';
import neonHelper from '../server-utils/dal/neon-helper.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function cleanup() {
    console.log('Cleaning up test resumes...');
    if (!neonHelper.isConfigured) return;

    try {
        const res = await neonHelper.query("DELETE FROM resumes WHERE resume_id LIKE 'test_resume_%'");
        console.log(`Deleted ${res.rowCount || 'some'} test resumes.`);
    } catch (e) {
        console.error('Cleanup failed:', e);
    }
    process.exit();
}

cleanup();
