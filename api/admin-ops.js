
import neonHelper from '../server-utils/dal/neon-helper.js';

async function checkUserData(req, res) {
    try {
        // Get user ID from query
        const userId = req.query.userId || '0659b622-35aa-4e16-b75b-10ea243fb255'; // Default test user

        const results = {
            userId,
            resumes: null,
            userProfile: null,
            error: null
        };

        // Check resumes table
        const resumesResult = await neonHelper.query(
            'SELECT * FROM resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        results.resumes = resumesResult;

        // Check users table profile
        const usersResult = await neonHelper.query(
            'SELECT profile FROM users WHERE user_id = $1',
            [userId]
        );
        results.userProfile = usersResult?.[0]?.profile;

        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
}

async function diagnoseDb(req, res) {
    const results = {
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_DB_URL: !!process.env.DATABASE_URL || !!process.env.NEON_DATABASE_URL,
        },
        tables: {},
        error: null
    };

    try {
        // Check tables
        const tables = ['users', 'resumes', 'user_job_matches', 'resume_stats'];

        for (const table of tables) {
            const exists = await neonHelper.tableExists(table);
            const count = exists ? await neonHelper.count(table) : null;
            results.tables[table] = { exists, count };
        }

        // Check connection by running a simple query
        const now = await neonHelper.query('SELECT NOW()');
        results.dbTime = now?.[0]?.now;

    } catch (error) {
        results.error = error.message;
        results.stack = error.stack;
    }

    res.status(200).json(results);
}

async function runMigration(req, res) {
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

        const alterTableSQL = `
      ALTER TABLE user_job_matches ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP WITH TIME ZONE;
    `;

        // Execute SQL
        await neonHelper.query(createTableSQL);
        await neonHelper.query(alterTableSQL);
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

export default async function handler(req, res) {
    // CORS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).json({});
    }

    const { action } = req.query;

    switch (action) {
        case 'check-user':
            return checkUserData(req, res);
        case 'diagnose':
            return diagnoseDb(req, res);
        case 'migrate':
            return runMigration(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action. Supported actions: check-user, diagnose, migrate' });
    }
}
