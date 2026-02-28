import neonHelper from '../server-utils/dal/neon-helper.js';

async function main() {
    console.log('Running migration...');
    try {
        await neonHelper.query('ALTER TABLE copilot_sessions ADD COLUMN IF NOT EXISTS invested_hours VARCHAR(50);');
        console.log('ALTER TABLE copilot_sessions SUCCESS');
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit(0);
}

main();
