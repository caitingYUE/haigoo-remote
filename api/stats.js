import neonHelper from '../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      if (!neonHelper.isConfigured) {
        return res.status(503).json({ error: 'Database not configured' });
      }

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Parallel queries for performance
      const [
        totalJobsResult,
        domesticJobsResult,
        dailyJobsResult,
        companiesResult
      ] = await Promise.all([
        neonHelper.query('SELECT COUNT(*) FROM jobs'),
        neonHelper.query("SELECT COUNT(*) FROM jobs WHERE region IN ('domestic', 'both')"),
        neonHelper.query('SELECT COUNT(*) FROM jobs WHERE published_at >= $1', [oneDayAgo]),
        neonHelper.query('SELECT COUNT(*) FROM trusted_companies')
      ]);

      const stats = {
        totalJobs: parseInt(totalJobsResult[0].count, 10) || 0,
        domesticJobs: parseInt(domesticJobsResult[0].count, 10) || 0,
        dailyJobs: parseInt(dailyJobsResult[0].count, 10) || 0,
        companiesCount: parseInt(companiesResult[0].count, 10) || 0
      };

      // Set cache headers (cache for 5 minutes)
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      
      return res.status(200).json({ success: true, stats });
    } catch (error) {
      console.error('Stats API error:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
