
import dotenv from 'dotenv';
import neonHelper from '../server-utils/dal/neon-helper.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function migrate() {
    console.log('Starting migration...');
    if (!neonHelper.isConfigured) {
        console.error('DB not configured');
        return;
    }

    try {
        // 1. Add columns to users (sequentially)
        console.log('Adding resume_url to users...');
        await neonHelper.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_url VARCHAR(1024)`);
        
        console.log('Adding has_used_copilot_trial to users...');
        await neonHelper.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS has_used_copilot_trial BOOLEAN DEFAULT FALSE`);

        // 2. Create copilot_sessions table
        console.log('Creating copilot_sessions table...');
        await neonHelper.query(`
            CREATE TABLE IF NOT EXISTS copilot_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
                goal VARCHAR(50),
                timeline VARCHAR(50),
                background JSONB,
                plan_data JSONB,
                is_trial BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // 3. Add index
        console.log('Adding index...');
        await neonHelper.query(`CREATE INDEX IF NOT EXISTS idx_copilot_sessions_user_id ON copilot_sessions(user_id)`);

        console.log('Migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    }
    process.exit();
}

migrate();
