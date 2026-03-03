import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function jobBundlesHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!neonHelper.isConfigured) {
        return res.status(503).json({ error: 'Database not configured' });
    }

    try {
        if (req.method === 'GET') {
            const { id, is_active } = req.query;

            if (id) {
                const result = await neonHelper.query(
                    'SELECT * FROM job_bundles WHERE id = $1',
                    [id]
                );
                if (!result || result.length === 0) {
                    return res.status(404).json({ error: 'Bundle not found' });
                }
                return res.status(200).json({ success: true, data: result[0] });
            }

            let query = 'SELECT * FROM job_bundles';
            const params = [];
            const conditions = [];

            if (is_active !== undefined) {
                conditions.push(`is_active = $${params.length + 1}`);
                params.push(is_active === 'true');
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY priority ASC, created_at DESC';

            const result = await neonHelper.query(query, params);
            const bundles = result || [];
            const now = new Date();

            const validBundles = bundles.filter(b => {
                if (b.start_time && new Date(b.start_time) > now) return false;
                if (b.end_time && new Date(b.end_time) < now) return false;
                return true;
            });

            return res.status(200).json({ success: true, data: validBundles });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('[Public JobBundles] API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
