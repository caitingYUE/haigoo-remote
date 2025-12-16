
import neonHelper from '../server-utils/dal/neon-helper.js';

async function main() {
  try {
    console.log('Adding nickname column to subscriptions table...');
    const sql = 'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);';
    await neonHelper.query(sql);
    console.log('Successfully added nickname column.');
  } catch (error) {
    console.error('Failed to update schema:', error);
    process.exit(1);
  }
}

main();
