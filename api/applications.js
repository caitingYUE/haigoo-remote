import neonHelper from '../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'

function sendJson(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, {}, 200)
  }

  if (req.method === 'POST') {
    try {
      const body = req.body
      
      // Basic validation
      if (!body.experience || !body.careerIdeal || !body.contact) {
        return sendJson(res, { success: false, error: 'Missing required fields' }, 400)
      }

      // Optional: Verify user if token provided, but allow anonymous application too?
      // User said "User professional experience...", usually implies logged in or guest.
      // But the form asks for contact info, so guest is likely fine.
      // However, if we have userId, we save it.
      
      let userId = body.userId || null
      
      // Insert into database
      if (neonHelper.isConfigured) {
        const query = `
          INSERT INTO club_applications 
          (user_id, experience, career_ideal, portfolio, expectations, contribution, contact, contact_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `
        const values = [
          userId,
          body.experience,
          body.careerIdeal,
          body.portfolio || '',
          body.expectations,
          body.contribution,
          body.contact,
          body.contactType || 'wechat'
        ]

        const result = await neonHelper.query(query, values)
        
        return sendJson(res, { success: true, id: result[0].id })
      } else {
        // Fallback or error if DB not configured (should not happen in prod)
        console.warn('DB not configured, application not saved persistently')
        return sendJson(res, { success: true, mock: true })
      }

    } catch (error) {
      console.error('Application submission error:', error)
      return sendJson(res, { success: false, error: error.message }, 500)
    }
  }

  return sendJson(res, { success: false, error: 'Method not allowed' }, 405)
}
