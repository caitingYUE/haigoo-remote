export default async function handler(req, res) {
  const { task } = req.query;

  // Allow passing task in body as well (for manual POSTs)
  const taskName = task || req.body?.task;

  console.log(`[CronRouter] Received request for task: ${taskName}, method: ${req.method}, query: ${JSON.stringify(req.query)}, body: ${JSON.stringify(req.body)}`);

  if (!taskName) {
    return res.status(400).json({
      error: 'Missing task parameter',
      usage: 'GET/POST /api/cron/index?task=<task-name>'
    });
  }

  try {
    switch (taskName) {
      case 'fetch-rss': {
        const { default: fetchRssHandler } = await import('../../lib/cron-handlers/fetch-rss.js');
        return await fetchRssHandler(req, res);
      }
      case 'process-rss': {
        const { default: processRssHandler } = await import('../../lib/cron-handlers/process-rss.js');
        return await processRssHandler(req, res);
      }
      case 'translate-jobs': {
        const { default: translateJobsHandler } = await import('../../lib/cron-handlers/translate-jobs.js');
        return await translateJobsHandler(req, res);
      }
      case 'enrich-companies': {
        const { default: enrichCompaniesHandler } = await import('../../lib/cron-handlers/enrich-companies.js');
        return await enrichCompaniesHandler(req, res);
      }
      case 'crawl-trusted-jobs': {
        const { default: crawlTrustedJobsHandler } = await import('../../lib/cron-handlers/crawl-trusted-jobs.js');
        return await crawlTrustedJobsHandler(req, res);
      }
      case 'daily-ingest': {
        const { default: fetchRssHandler } = await import('../../lib/cron-handlers/fetch-rss.js');
        const { default: processRssHandler } = await import('../../lib/cron-handlers/process-rss.js');
        return await runSequence(req, res, [
          { name: 'fetch-rss', handler: fetchRssHandler },
          { name: 'process-rss', handler: processRssHandler }
        ]);
      }

      case 'daily-enrich': {
        const { default: translateJobsHandler } = await import('../../lib/cron-handlers/translate-jobs.js');
        const { default: enrichCompaniesHandler } = await import('../../lib/cron-handlers/enrich-companies.js');
        const { default: crawlTrustedJobsHandler } = await import('../../lib/cron-handlers/crawl-trusted-jobs.js');
        return await runSequence(req, res, [
          { name: 'translate-jobs', handler: translateJobsHandler },
          { name: 'enrich-companies', handler: enrichCompaniesHandler },
          { name: 'crawl-trusted-jobs', handler: crawlTrustedJobsHandler }
        ]);
      }

      default:
        return res.status(400).json({
          error: `Unknown task: ${taskName}`,
          availableTasks: [
            'fetch-rss',
            'process-rss',
            'translate-jobs',
            'enrich-companies',
            'crawl-trusted-jobs',
            'daily-ingest',
            'daily-enrich'
          ]
        });
    }
  } catch (error) {
    console.error(`[CronRouter] Error executing task ${taskName}:`, error);
    // Ensure we return JSON even on crash
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}

// Helper to run handlers in sequence
async function runSequence(req, mainRes, tasks) {
  const results = [];

  for (const task of tasks) {
    console.log(`[CronSequence] Starting ${task.name}...`);
    try {
      // Mock response object to capture output
      let taskResult = {};
      const mockRes = {
        status: (code) => { taskResult.status = code; return mockRes; },
        json: (data) => { taskResult.data = data; return mockRes; },
        end: () => { return mockRes; },
        setHeader: () => { },
        headersSent: false
      };

      await task.handler(req, mockRes);
      results.push({ task: task.name, status: taskResult.status || 200, result: taskResult.data });
      console.log(`[CronSequence] Finished ${task.name}`);
    } catch (err) {
      console.error(`[CronSequence] Error in ${task.name}:`, err);
      results.push({ task: task.name, status: 500, error: err.message });
    }
  }

  return mainRes.status(200).json({
    success: true,
    sequence: results
  });
}

