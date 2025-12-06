
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
        logs: [],
        error: null
    };

    try {
        // Migration 1: user_job_matches table (Keep existing)
        const createMatchesTableSQL = `
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
        await neonHelper.query(createMatchesTableSQL);
        results.logs.push('Checked/Created user_job_matches table');

        // Migration 2: jobs table - Add featured, trusted, company_id columns
        // Use separate ALTER TABLE statements to handle potential failures cleanly
        const jobsColumns = [
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT false',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS can_refer BOOLEAN DEFAULT false',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id VARCHAR(255)',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo VARCHAR(2000)',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_website VARCHAR(2000)',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_description TEXT'
        ];

        for (const sql of jobsColumns) {
            await neonHelper.query(sql);
            results.logs.push(`Executed: ${sql}`);
        }

        results.success = true;
        results.message = 'Migration completed successfully';

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
