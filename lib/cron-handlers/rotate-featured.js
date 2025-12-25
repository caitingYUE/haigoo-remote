
import neonHelper from '../../server-utils/dal/neon-helper.js';

export default async function handler(req, res) {
  console.log('[Cron:RotateFeatured] Starting...');
  
  if (!neonHelper.isConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // 1. Rotate Featured Companies
    // Strategy: Pick 6 random companies with enough jobs and update their updated_at to NOW()
    // This pushes them to the top of "ORDER BY updated_at DESC"
    
    // Get eligible companies (job_count >= 5)
    const companies = await neonHelper.query(`
      SELECT company_id 
      FROM trusted_companies 
      WHERE job_count >= 5 AND status = 'active'
    `);

    if (companies && companies.length > 0) {
      // Shuffle
      const shuffled = companies.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 6);
      
      for (const comp of selected) {
        await neonHelper.query(`
          UPDATE trusted_companies 
          SET updated_at = NOW() 
          WHERE company_id = $1
        `, [comp.company_id]);
      }
      console.log(`[Cron:RotateFeatured] Rotated ${selected.length} companies.`);
    }

    // 2. Rotate Featured Jobs
    // Strategy: Clear previous featured flags, then pick 6 random high-quality jobs
    
    // Clear existing featured
    await neonHelper.query(`UPDATE jobs SET is_featured = false WHERE is_featured = true`);
    
    // Select new featured candidates
    // Criteria: Active, Good Description, Domestic/Both Region, Recent (last 30 days)
    const candidates = await neonHelper.query(`
      SELECT job_id 
      FROM jobs 
      WHERE status = 'active' 
      AND region IN ('domestic', 'both')
      AND LENGTH(description) > 500
      AND published_at > NOW() - INTERVAL '30 days'
      ORDER BY RANDOM()
      LIMIT 6
    `);

    if (candidates && candidates.length > 0) {
      for (const job of candidates) {
        await neonHelper.query(`
          UPDATE jobs 
          SET is_featured = true 
          WHERE job_id = $1
        `, [job.job_id]);
      }
      console.log(`[Cron:RotateFeatured] Rotated ${candidates.length} jobs.`);
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Rotation complete',
      companiesRotated: 6,
      jobsRotated: candidates ? candidates.length : 0
    });

  } catch (error) {
    console.error('[Cron:RotateFeatured] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
