import neonHelper from '../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
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
