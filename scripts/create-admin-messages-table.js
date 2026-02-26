import neonHelper from '../server-utils/dal/neon-helper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

async function main() {
  try {
    if (!neonHelper.isConfigured) {
      console.error('Neon is not configured. Check DATABASE_URL in .env.local');
      return;
    }

    const query = `
      CREATE TABLE IF NOT EXISTS admin_messages (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL, -- 'user_register', 'user_feedback', 'system_error'
        title VARCHAR(255) NOT NULL,
        content TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // We can use query directly
    const result = await neonHelper.query(query);
    console.log('admin_messages table created successfully', result);
  } catch (err) {
    console.error('Error creating admin_messages table', err);
  }
}

main();
