import neonHelper from '../server-utils/dal/neon-helper.js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Parallel queries for efficiency
    const [jobsCount, domesticJobsResult, companiesCount, usersCount] = await Promise.all([
      neonHelper.count('jobs', { status: 'active' }),
      neonHelper.query("SELECT COUNT(*) as count FROM jobs WHERE status = 'active' AND (region = 'domestic' OR region = 'both')"),
      neonHelper.count('trusted_companies', { status: 'active' }),
      neonHelper.count('users')
    ])

    const domesticJobsCount = domesticJobsResult && domesticJobsResult[0] 
      ? parseInt(domesticJobsResult[0].count, 10) 
      : 0

    return res.status(200).json({
      success: true,
      stats: {
        totalJobs: jobsCount || 0,
        domesticJobs: domesticJobsCount || 0,
        companiesCount: companiesCount || 0,
        activeUsers: usersCount || 0
      }
    })
  } catch (error) {
    console.error('[Stats] Error fetching stats:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch statistics' 
    })
  }
}
