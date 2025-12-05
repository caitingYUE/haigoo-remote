
import neonHelper from '../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
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
