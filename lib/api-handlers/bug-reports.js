import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'

const TABLE_NAME = 'bug_reports'

export default async function handler(req, res) {
  const method = req.method
  console.log(`[BugReport] Method: ${method}, Headers:`, JSON.stringify(req.headers));
  const token = extractToken(req)
  console.log(`[BugReport] Extracted Token: ${token ? 'Yes (' + token.substring(0, 10) + '...)' : 'No'}`);
  const user = token ? verifyToken(token) : null
  console.log(`[BugReport] Verified User: ${user ? user.userId : 'Null'}`);

  if (method === 'POST') {
    return await createBugReport(req, res, user)
  } else if (method === 'GET') {
    if (req.query.mode === 'leaderboard') {
        return await getLeaderboard(req, res)
    }
    return await listOrGetBugReport(req, res, user)
  } else if (method === 'PATCH') {
    return await updateBugReport(req, res, user)
  } else if (method === 'DELETE') {
    return await deleteBugReport(req, res, user)
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE'])
    return res.status(405).json({ success: false, error: `Method ${method} Not Allowed` })
  }
}

async function createBugReport(req, res, user) {
  const { title, description, imageUrl, userNickname, contactInfo } = req.body

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' })
  }

  const data = {
    user_id: user ? user.userId : null,
    user_nickname: userNickname || (user ? user.email : 'Anonymous'),
    title,
    description,
    image_url: imageUrl,
    status: 'open',
    contact_info: contactInfo
  }

  try {
    console.log('[BugReport] Creating report with data:', JSON.stringify(data))
    const result = await neonHelper.insert(TABLE_NAME, data)
    
    if (!result) {
        console.error('[BugReport] Insert failed (returned null)')
        return res.status(500).json({ success: false, error: 'Database Insert Failed' })
    }

    return res.status(201).json({ success: true, data: result })
  } catch (error) {
    console.error('Create bug report error:', error)
    return res.status(500).json({ success: false, error: 'Internal Server Error' })
  }
}

async function getLeaderboard(req, res) {
    try {
        const query = `
            SELECT 
                user_nickname, 
                COUNT(*) as total_bugs,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as fixed_bugs,
                MAX(created_at) as last_submission
            FROM ${TABLE_NAME}
            WHERE user_nickname IS NOT NULL AND user_nickname != 'Anonymous'
            GROUP BY user_nickname
            ORDER BY total_bugs DESC
            LIMIT 50
        `
        const rows = await neonHelper.query(query)
        return res.json({ success: true, data: rows || [] })
    } catch (error) {
        console.error('Get leaderboard error:', error)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
}

async function deleteBugReport(req, res, user) {
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    // Verify admin
    const userResult = await neonHelper.query('SELECT roles FROM users WHERE user_id = $1', [user.userId])
    let isAdmin = false
    if (userResult && userResult.length > 0) {
      const roles = userResult[0].roles
      isAdmin = roles && roles.admin === true
    }

    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { id } = req.query; // Use query param for DELETE (RESTful style) or body if preferred. req.query.id is safer for DELETE usually.
    // Wait, standard DELETE usually puts ID in URL path or query string.
    // But let's support body too just in case.
    const targetId = id || req.body.id;

    if (!targetId) {
        return res.status(400).json({ success: false, error: 'Missing id' })
    }

    try {
        const query = `DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING id`;
        const result = await neonHelper.query(query, [targetId]);
        
        if (result && result.length > 0) {
            return res.json({ success: true, message: 'Bug report deleted', id: targetId });
        } else {
            return res.status(404).json({ success: false, error: 'Bug report not found' });
        }
    } catch (error) {
        console.error('Delete bug report error:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

async function listOrGetBugReport(req, res, user) {
  let isAdmin = false
  if (user) {
    console.log('[BugReport] Checking roles for user:', user.userId)
    const userResult = await neonHelper.query('SELECT roles FROM users WHERE user_id = $1', [user.userId])
    if (userResult && userResult.length > 0) {
      const roles = userResult[0].roles
      isAdmin = roles && roles.admin === true
      console.log('[BugReport] User roles:', JSON.stringify(roles), 'IsAdmin:', isAdmin)
    } else {
        console.log('[BugReport] User not found in users table or no roles')
    }
  } else {
      console.log('[BugReport] No user token provided (Anonymous)')
  }

  const { id, nickname, mode } = req.query;

  try {
    // === Public List by Nickname (for Leaderboard details) ===
    if (mode === 'public_list' && nickname) {
        const query = `
            SELECT id, title, description, status, created_at, admin_reply
            FROM ${TABLE_NAME}
            WHERE user_nickname = $1
            ORDER BY created_at DESC
        `;
        const rows = await neonHelper.query(query, [nickname]);
        return res.json({ success: true, data: rows || [] });
    }

    // === Get Single Detail (Full Data including Image) ===
    if (id) {
        if (!isAdmin && !user) return res.status(401).json({ success: false, error: 'Unauthorized' });
        
        const query = `SELECT * FROM ${TABLE_NAME} WHERE id = $1`;
        const rows = await neonHelper.query(query, [id]);
        
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Not Found' });
        }

        const report = rows[0];
        // Check permission: Admin or Owner
        if (!isAdmin && report.user_id !== user.userId) {
             return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        return res.json({ success: true, data: report });
    }

    // === List All (Lightweight - No Image Content) ===
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let countQuery = `SELECT COUNT(*) as total FROM ${TABLE_NAME}`;
    let query = `
        SELECT 
            id, user_id, user_nickname, title, description, status, created_at, updated_at, admin_reply, replied_at, contact_info,
            (CASE WHEN image_url IS NOT NULL AND length(image_url) > 0 THEN true ELSE false END) as has_image
        FROM ${TABLE_NAME} 
    `;
    let params = [];

    if (!isAdmin) {
        if (user) {
            console.log('[BugReport] User is not admin, fetching own bugs for:', user.userId)
            countQuery += ` WHERE user_id = $1`;
            query += ` WHERE user_id = $1`;
            params = [user.userId];
        } else {
             console.log('[BugReport] Anonymous user, returning empty list')
             return res.json({ success: true, data: [], pagination: { total: 0, page, limit, totalPages: 0 } })
        }
    } else {
        console.log('[BugReport] Admin fetching ALL bugs')
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    // Execute queries
    const countResult = await neonHelper.query(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0');
    const totalPages = Math.ceil(total / limit);

    const rows = await neonHelper.query(query, params);
    console.log(`[BugReport] Query returned ${rows ? rows.length : 0} rows (Total: ${total})`)
    
    return res.json({ 
        success: true, 
        data: rows || [],
        pagination: {
            total,
            page,
            limit,
            totalPages
        }
    })
  } catch (error) {
    console.error('List bug reports error:', error)
    return res.status(500).json({ success: false, error: 'Internal Server Error: ' + error.message })
  }
}

async function updateBugReport(req, res, user) {
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    // Verify admin
    const userResult = await neonHelper.query('SELECT roles FROM users WHERE user_id = $1', [user.userId])
    let isAdmin = false
    if (userResult && userResult.length > 0) {
      const roles = userResult[0].roles
      isAdmin = roles && roles.admin === true
    }

    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const { id, status, replyContent } = req.body
    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing id' })
    }

    try {
        let query;
        let params;

        if (status) {
            query = `UPDATE ${TABLE_NAME} SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`
            params = [status, id]
        } else if (replyContent) {
            query = `UPDATE ${TABLE_NAME} SET admin_reply = $1, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`
            params = [replyContent, id]
        } else {
             return res.status(400).json({ success: false, error: 'Nothing to update' })
        }

        const rows = await neonHelper.query(query, params)
        return res.json({ success: true, data: rows[0] })
    } catch (error) {
        console.error('Update bug report error:', error)
        return res.status(500).json({ success: false, error: 'Internal Server Error' })
    }
}
