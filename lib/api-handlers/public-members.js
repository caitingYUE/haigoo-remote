import neonHelper from '../../server-utils/dal/neon-helper.js'

function setCorsHeaders(res, req) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://haigoo-admin.vercel.app',
    'https://www.haigooremote.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCorsHeaders(res, req)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Optimized query to fetch only users with titles
    // Limit to 50 to have some pool to shuffle/pick from
    const query = `
      SELECT profile 
      FROM users 
      WHERE profile->>'title' IS NOT NULL 
      AND profile->>'title' != '' 
      ORDER BY created_at DESC 
      LIMIT 50
    `
    
    const result = await neonHelper.query(query)
    
    if (!result || result.length === 0) {
        return res.status(200).json({ success: true, members: [] })
    }

    const members = result.map(row => {
        let title = row.profile.title.trim();
        return {
            title: title
        }
    })
    // Return top 20
    .slice(0, 20)

    return res.status(200).json({
      success: true,
      members: members
    })
  } catch (error) {
    console.error('[public-members] Error:', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}
