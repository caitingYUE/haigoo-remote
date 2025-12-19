import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!neonHelper.isConfigured) {
        return res.status(503).json({ error: 'Database not configured' });
    }

    // GET: Fetch forest trees (paginated)
    if (req.method === 'GET') {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 12;
        const offset = (page - 1) * limit;

        try {
            const trees = await neonHelper.query(`
                SELECT id, tree_id, tree_data, star_label, user_nickname, created_at, likes
                FROM campaign_forest
                WHERE is_public = true
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            `, [limit, offset]);

            // Get total count for pagination
            const countResult = await neonHelper.query(`
                SELECT COUNT(*) as total FROM campaign_forest WHERE is_public = true
            `);
            const total = parseInt(countResult[0]?.total || '0');

            return res.status(200).json({
                success: true,
                data: trees,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('[Forest API] Fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch forest' });
        }
    }

    // POST: Plant a tree (Publish)
    if (req.method === 'POST') {
        const { tree_id, tree_data, star_label, user_nickname } = req.body;

        if (!tree_id || !tree_data) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            // Check if already exists
            const existing = await neonHelper.query(`
                SELECT id FROM campaign_forest WHERE tree_id = $1
            `, [tree_id]);

            if (existing.length > 0) {
                return res.status(409).json({ error: 'Tree already planted' });
            }

            // Create table if not exists (Lazy migration)
            await neonHelper.query(`
                CREATE TABLE IF NOT EXISTS campaign_forest (
                    id SERIAL PRIMARY KEY,
                    tree_id VARCHAR(255) UNIQUE NOT NULL,
                    tree_data JSONB NOT NULL,
                    star_label VARCHAR(100),
                    user_nickname VARCHAR(100) DEFAULT 'Anonymous',
                    is_public BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    likes INTEGER DEFAULT 0
                )
            `);

            // Insert
            await neonHelper.query(`
                INSERT INTO campaign_forest (tree_id, tree_data, star_label, user_nickname, is_public)
                VALUES ($1, $2, $3, $4, true)
            `, [tree_id, JSON.stringify(tree_data), star_label || 'Christmas Star', user_nickname || 'Anonymous']);

            return res.status(201).json({ success: true, message: 'Tree planted successfully' });
        } catch (error) {
            console.error('[Forest API] Plant error:', error);
            return res.status(500).json({ error: 'Failed to plant tree' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
