import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function jobBundlesHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Cache GET responses at CDN layer to avoid cold starts on direct link loads
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    }

    if (!neonHelper.isConfigured) {
        return res.status(503).json({ error: 'Database not configured' });
    }

    try {
        if (req.method === 'GET') {
            const { id, is_active } = req.query;

            if (id) {
                // Fetch by ID — return as array so frontend shape is consistent with list endpoint
                const result = await neonHelper.query(
                    'SELECT * FROM job_bundles WHERE id = $1 AND is_active = true',
                    [id]
                );
                if (!result || result.length === 0) {
                    return res.status(200).json({ success: true, data: [] });
                }
                // Return as array for consistent shape: { success, data: [...] }
                const bundle = result[0];
                if (bundle.job_ids && bundle.job_ids.length > 0) {
                    const jobsResult = await neonHelper.query(
                        `SELECT job_id FROM jobs WHERE job_id = ANY($1) AND is_approved = true AND status = 'active'`,
                        [bundle.job_ids]
                    );
                    bundle.job_ids = jobsResult.map(row => row.job_id);
                }
                return res.status(200).json({ success: true, data: [bundle] });
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

            // Filter unapproved jobs from each bundle
            for (let b of validBundles) {
                if (b.job_ids && b.job_ids.length > 0) {
                    const jobsResult = await neonHelper.query(
                        `SELECT job_id FROM jobs WHERE job_id = ANY($1) AND is_approved = true AND status = 'active'`,
                        [b.job_ids]
                    );
                    b.job_ids = jobsResult.map(row => row.job_id);
                }
            }

            const visibleBundles = validBundles.filter((bundle) => Array.isArray(bundle.job_ids) && bundle.job_ids.length > 0);

            return res.status(200).json({ success: true, data: visibleBundles });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('[Public JobBundles] API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
