import neonHelper from '../../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'

const TABLE_NAME = 'bug_reports'

export default async function handler(req, res) {
  const method = req.method
  const token = extractToken(req)
  const user = token ? verifyToken(token) : null

  if (method === 'POST') {
    return await createBugReport(req, res, user)
  } else if (method === 'GET') {
    if (req.query.mode === 'leaderboard') {
        return await getLeaderboard(req, res)
    }
    return await listOrGetBugReport(req, res, user)
  } else if (method === 'PATCH') {
    return await updateBugReport(req, res, user)
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH'])
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
    const result = await neonHelper.insert(TABLE_NAME, data)
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

async function listOrGetBugReport(req, res, user) {
  let isAdmin = false
  if (user) {
    const userResult = await neonHelper.query('SELECT roles FROM users WHERE user_id = $1', [user.userId])
    if (userResult && userResult.length > 0) {
      const roles = userResult[0].roles
      isAdmin = roles && roles.admin === true
    }
  }

  const { id, nickname, mode } = req.query;

  try {
    // === Public List by Nickname (for Leaderboard details) ===
    if (mode === 'public_list' && nickname) {
        const query = `
            SELECT id, title, status, created_at, admin_reply
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
    // We check if image_url is present and long, we replace it with a boolean flag or truncate
    // Actually, to keep it simple for frontend, let's just NOT select image_url, but select a flag
    let query = `
        SELECT 
            id, user_id, user_nickname, title, description, status, created_at, updated_at, admin_reply, replied_at, contact_info,
            (CASE WHEN image_url IS NOT NULL AND length(image_url) > 0 THEN true ELSE false END) as has_image
        FROM ${TABLE_NAME} 
        ORDER BY created_at DESC
    `
    let params = []

    if (!isAdmin) {
        if (user) {
            query = `
                SELECT 
                    id, user_id, user_nickname, title, description, status, created_at, updated_at, admin_reply, replied_at, contact_info,
                    (CASE WHEN image_url IS NOT NULL AND length(image_url) > 0 THEN true ELSE false END) as has_image
                FROM ${TABLE_NAME} 
                WHERE user_id = $1 
                ORDER BY created_at DESC
            `
            params = [user.userId]
        } else {
             return res.json({ success: true, data: [] })
        }
    }

    const rows = await neonHelper.query(query, params)
    return res.json({ success: true, data: rows || [] })
  } catch (error) {
    console.error('List bug reports error:', error)
    return res.status(500).json({ success: false, error: 'Internal Server Error' })
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
