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
      case 'stream-fetch-rss': {
        const { default: streamFetchRssHandler } = await import('../../lib/cron-handlers/stream-fetch-rss.js');
        return await streamFetchRssHandler(req, res);
      }
      case 'stream-process-rss': {
        const { default: streamProcessRssHandler } = await import('../../lib/cron-handlers/stream-process-rss.js');
        return await streamProcessRssHandler(req, res);
      }
      case 'stream-translate-jobs': {
        const { default: streamTranslateJobsHandler } = await import('../../lib/cron-handlers/stream-translate-jobs.js');
        return await streamTranslateJobsHandler(req, res);
      }
      case 'stream-enrich-companies': {
        const { default: streamEnrichCompaniesHandler } = await import('../../lib/cron-handlers/stream-enrich-companies.js');
        return await streamEnrichCompaniesHandler(req, res);
      }
      case 'stream-crawl-trusted-jobs': {
        const { default: streamCrawlTrustedJobsHandler } = await import('../../lib/cron-handlers/stream-crawl-trusted-jobs.js');
        return await streamCrawlTrustedJobsHandler(req, res);
      }
      case 'daily-ingest': {
        const { default: streamFetchRssHandler } = await import('../../lib/cron-handlers/stream-fetch-rss.js');
        const { default: streamProcessRssHandler } = await import('../../lib/cron-handlers/stream-process-rss.js');
        return await runSequence(req, res, [
          { name: 'stream-fetch-rss', handler: streamFetchRssHandler },
          { name: 'stream-process-rss', handler: streamProcessRssHandler }
        ]);
      }

      case 'daily-enrich': {
        const { default: streamTranslateJobsHandler } = await import('../../lib/cron-handlers/stream-translate-jobs.js');
        const { default: streamEnrichCompaniesHandler } = await import('../../lib/cron-handlers/stream-enrich-companies.js');
        const { default: streamCrawlTrustedJobsHandler } = await import('../../lib/cron-handlers/stream-crawl-trusted-jobs.js');
        return await runSequence(req, res, [
          { name: 'stream-translate-jobs', handler: streamTranslateJobsHandler },
          { name: 'stream-enrich-companies', handler: streamEnrichCompaniesHandler },
          { name: 'stream-crawl-trusted-jobs', handler: streamCrawlTrustedJobsHandler }
        ]);
      }

      default:
        return res.status(400).json({
          error: `Unknown task: ${taskName}`,
          availableTasks: [
            'stream-fetch-rss',
            'stream-process-rss',
            'stream-translate-jobs',
            'stream-enrich-companies',
            'stream-crawl-trusted-jobs',
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

