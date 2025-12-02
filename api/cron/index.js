import fetchRssHandler from '../../lib/cron-handlers/fetch-rss.js';
import processRssHandler from '../../lib/cron-handlers/process-rss.js';
import translateJobsHandler from '../../lib/cron-handlers/translate-jobs.js';
import enrichCompaniesHandler from '../../lib/cron-handlers/enrich-companies.js';
import crawlTrustedJobsHandler from '../../lib/cron-handlers/crawl-trusted-jobs.js';

export default async function handler(req, res) {
  const { task } = req.query;

  // Allow passing task in body as well (for manual POSTs)
  const taskName = task || req.body?.task;

  console.log(`[CronRouter] Received request for task: ${taskName}`);

  if (!taskName) {
      return res.status(400).json({ 
          error: 'Missing task parameter',
          usage: 'GET/POST /api/cron/index?task=<task-name>' 
      });
  }

  try {
    switch (taskName) {
      case 'fetch-rss':
        return await fetchRssHandler(req, res);
      case 'process-rss':
        return await processRssHandler(req, res);
      case 'translate-jobs':
        return await translateJobsHandler(req, res);
      case 'enrich-companies':
        return await enrichCompaniesHandler(req, res);
      case 'crawl-trusted-jobs':
        return await crawlTrustedJobsHandler(req, res);
      default:
        return res.status(400).json({ 
          error: `Unknown task: ${taskName}`,
          availableTasks: [
            'fetch-rss', 
            'process-rss', 
            'translate-jobs', 
            'enrich-companies', 
            'crawl-trusted-jobs'
          ]
        });
    }
  } catch (error) {
    console.error(`[CronRouter] Error executing task ${taskName}:`, error);
    // Ensure we return JSON even on crash
    if (!res.headersSent) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
  }
}
