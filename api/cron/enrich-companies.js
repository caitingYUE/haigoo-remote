import { getAllJobs, saveAllJobs } from '../../lib/api-handlers/processed-jobs.js';
import { getAllCompanies } from '../../lib/api-handlers/trusted-companies.js';
import { classifyCompany } from '../../lib/services/classification-service.js';

export default async function handler(req, res) {
  try {
    console.log('[Cron:EnrichCompanies] Starting...');

    const [jobs, companies] = await Promise.all([
      getAllJobs(),
      getAllCompanies()
    ]);

    console.log(`[Cron:EnrichCompanies] Scanned ${jobs.length} jobs and ${companies.length} trusted companies.`);

    let updatedCount = 0;
    const companyMap = new Map(companies.map(c => [c.name.toLowerCase(), c]));

    const enrichedJobs = jobs.map(job => {
      let changed = false;
      const jobCompanyLower = (job.company || '').toLowerCase();
      
      // 1. Match with Trusted Companies
      if (companyMap.has(jobCompanyLower)) {
        const tc = companyMap.get(jobCompanyLower);
        
        if (job.companyId !== tc.id) { job.companyId = tc.id; changed = true; }
        if (!job.companyWebsite && tc.website) { job.companyWebsite = tc.website; changed = true; }
        if (!job.companyDescription && tc.description) { job.companyDescription = tc.description; changed = true; }
        if (!job.companyIndustry && tc.industry) { job.companyIndustry = tc.industry; changed = true; }
        if (!job.isTrusted) { job.isTrusted = true; changed = true; }
      } 
      // 2. AI Classification for Industry/Tags (if not trusted)
      else if (!job.companyIndustry || !job.companyTags || job.companyTags.length === 0) {
        // Only if we have a description to analyze
        if (job.description && job.description.length > 100) {
            const analysis = classifyCompany(job.company, job.description);
            if (analysis.industry !== '其他') {
                job.companyIndustry = analysis.industry;
                changed = true;
            }
            if (analysis.tags.length > 0) {
                job.companyTags = analysis.tags;
                changed = true;
            }
        }
      }

      if (changed) updatedCount++;
      return job;
    });

    if (updatedCount > 0) {
      await saveAllJobs(enrichedJobs);
      console.log(`[Cron:EnrichCompanies] Updated ${updatedCount} jobs with company info.`);
    } else {
      console.log('[Cron:EnrichCompanies] No jobs needed enrichment.');
    }

    return res.status(200).json({ 
      success: true, 
      updated: updatedCount 
    });

  } catch (error) {
    console.error('[Cron:EnrichCompanies] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
