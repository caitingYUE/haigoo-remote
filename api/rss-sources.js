
import { verifyToken } from '../server-utils/auth-helpers.js';
import neonHelper from '../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
    // 1. Verify Authentication
    const auth = await verifyToken(req);
    if (!auth.isValid) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Optional: Check if user is admin (depending on requirements)
    // if (!auth.user.roles?.admin) {
    //     return res.status(403).json({ success: false, error: 'Forbidden' });
    // }

    const { method } = req;
    const { id } = req.query;

    try {
        if (method === 'GET') {
            const result = await neonHelper.query(
                'SELECT * FROM rss_sources ORDER BY id ASC'
            );
            return res.status(200).json({ success: true, data: result || [] });
        }

        if (method === 'POST') {
            const { name, url, category, is_active } = req.body;
            if (!name || !url) {
                return res.status(400).json({ success: false, error: 'Name and URL are required' });
            }
            
            const result = await neonHelper.query(
                'INSERT INTO rss_sources (name, url, category, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, url, category || '其他', is_active !== undefined ? is_active : true]
            );
            return res.status(201).json({ success: true, data: result[0] });
        }

        if (method === 'PUT') {
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            const { name, url, category, is_active } = req.body;
            
            // Construct dynamic update query
            const fields = [];
            const values = [];
            let paramIndex = 1;

            if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
            if (url !== undefined) { fields.push(`url = $${paramIndex++}`); values.push(url); }
            if (category !== undefined) { fields.push(`category = $${paramIndex++}`); values.push(category); }
            if (is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(is_active); }
            
            if (fields.length === 0) {
                return res.status(400).json({ success: false, error: 'No fields to update' });
            }

            fields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);
            
            const query = `UPDATE rss_sources SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
            
            const result = await neonHelper.query(query, values);
            
            if (!result || result.length === 0) {
                 return res.status(404).json({ success: false, error: 'RSS source not found' });
            }
            
            return res.status(200).json({ success: true, data: result[0] });
        }

        if (method === 'DELETE') {
             if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            
            // Hard delete or soft delete? User said "remove", so hard delete is fine for now, 
            // or we could just set is_active = false. Let's do hard delete as per "remove".
            const result = await neonHelper.query('DELETE FROM rss_sources WHERE id = $1 RETURNING id', [id]);
            
            if (!result || result.length === 0) {
                return res.status(404).json({ success: false, error: 'RSS source not found' });
            }
            
            return res.status(200).json({ success: true, id });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (error) {
        console.error('RSS API Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error: ' + error.message });
    }
}
