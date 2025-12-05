
import neonHelper from '../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
    const results = {
        success: false,
        message: '',
        error: null
    };

    try {
        // Define the schema SQL
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_job_matches (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        match_score DOUBLE PRECISION NOT NULL,
        match_details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(user_id, job_id)
      );
    `;

        const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_user_job_matches_user_id ON user_job_matches(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_job_matches_expires_at ON user_job_matches(expires_at);
    `;

        // Execute SQL
        await neonHelper.query(createTableSQL);
        await neonHelper.query(createIndexSQL);

        // Verify
        const exists = await neonHelper.tableExists('user_job_matches');

        results.success = exists;
        results.message = exists ? 'Table user_job_matches created successfully' : 'Failed to create table';

    } catch (error) {
        results.error = error.message;
        results.stack = error.stack;
    }

    res.status(200).json(results);
}
