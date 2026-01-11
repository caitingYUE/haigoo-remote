
import neonHelper from '../server-utils/dal/neon-helper.js';

async function migrate() {
  console.log('Running migration...');
  try {
    const result = await neonHelper.query(`
      CREATE TABLE IF NOT EXISTS job_bundles (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        content TEXT,
        job_ids JSONB DEFAULT '[]',
        priority INTEGER DEFAULT 10,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        is_public BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Migration successful:', result);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
