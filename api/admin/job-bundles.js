
import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check DB configuration
  if (!neonHelper.isConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // GET: List or Get Single
    if (req.method === 'GET') {
      const { id, is_active } = req.query;

      if (id) {
        // Get Single Bundle
        const result = await neonHelper.query(
          'SELECT * FROM job_bundles WHERE id = $1',
          [id]
        );
        if (!result || result.length === 0) {
          return res.status(404).json({ error: 'Bundle not found' });
        }
        
        // Enrich with job details? Maybe not for admin list, but for edit view yes.
        // For simplicity, we just return the bundle. The frontend can fetch job details separately if needed.
        return res.status(200).json({ success: true, data: result[0] });
      }

      // List Bundles
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

      query += ' ORDER BY priority ASC, created_at DESC'; // Priority first, then newest

      const result = await neonHelper.query(query, params);
      return res.status(200).json({ success: true, data: result || [] });
    }

    // POST: Create Bundle
    if (req.method === 'POST') {
      const { title, subtitle, content, job_ids, priority, start_time, end_time, is_public, is_active } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const result = await neonHelper.query(
        `INSERT INTO job_bundles 
        (title, subtitle, content, job_ids, priority, start_time, end_time, is_public, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          title,
          subtitle || '',
          content || '',
          JSON.stringify(job_ids || []),
          priority || 10,
          start_time || null,
          end_time || null,
          is_public !== undefined ? is_public : true,
          is_active !== undefined ? is_active : true
        ]
      );

      return res.status(201).json({ success: true, data: result[0] });
    }

    // PUT: Update Bundle
    if (req.method === 'PUT') {
      const { id, title, subtitle, content, job_ids, priority, start_time, end_time, is_public, is_active } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }

      // Build dynamic update query
      const fields = [];
      const values = [];
      let idx = 1;

      if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
      if (subtitle !== undefined) { fields.push(`subtitle = $${idx++}`); values.push(subtitle); }
      if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
      if (job_ids !== undefined) { fields.push(`job_ids = $${idx++}`); values.push(JSON.stringify(job_ids)); }
      if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
      if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(start_time); }
      if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(end_time); }
      if (is_public !== undefined) { fields.push(`is_public = $${idx++}`); values.push(is_public); }
      if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE job_bundles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
      
      const result = await neonHelper.query(query, values);
      
      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Bundle not found' });
      }

      return res.status(200).json({ success: true, data: result[0] });
    }

    // DELETE: Delete Bundle
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });

      await neonHelper.query('DELETE FROM job_bundles WHERE id = $1', [id]);
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[JobBundles] API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
