import { sendLog } from '../../lib/services/lark-message.js';

export default async function handler(req, res) {
  const { task } = req.query;

  // Allow passing task in body as well (for manual POSTs)
  const taskName = task || req.body?.task;

  console.log(`[CronRouter] Received request for task: ${taskName}, method: ${req.method}, query: ${JSON.stringify(req.query)}, body: ${JSON.stringify(req.body)}`);
  sendLog(
    `[CronRouter] Received request for task: ${taskName}, method: ${req.method}, query: ${JSON.stringify(req.query)}, body: ${JSON.stringify(req.body)}`,
    'green',
    '定时任务调度通知'
  );

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
      case 'rotate-featured': {
        const { default: rotateFeaturedHandler } = await import('../../lib/cron-handlers/rotate-featured.js');
        return await rotateFeaturedHandler(req, res);
      }
      case 'daily-digest': {
        const { sendDailyDigests } = await import('../../lib/cron-handlers/daily-digest.js');
        return await sendDailyDigests(res);
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
        // stream-crawl-trusted-jobs runs separately every 4 hours, no need to duplicate here
        return await runSequence(req, res, [
          { name: 'stream-translate-jobs', handler: streamTranslateJobsHandler },
          { name: 'stream-enrich-companies', handler: streamEnrichCompaniesHandler }
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
            'daily-digest',
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

// Helper to run handlers in sequence with SSE streaming support
async function runSequence(req, mainRes, tasks) {
  // Set SSE headers for the entire sequence
  mainRes.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  mainRes.setHeader('Cache-Control', 'no-cache');
  mainRes.setHeader('Connection', 'keep-alive');
  mainRes.setHeader('Transfer-Encoding', 'chunked');
  mainRes.setHeader('Access-Control-Allow-Origin', '*');
  mainRes.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  console.log(`[CronSequence] Starting sequence with ${tasks.length} tasks...`);

  // Send sequence start event
  mainRes.write(`event: sequence_start\ndata: ${JSON.stringify({
    type: 'sequence_start',
    message: `开始执行定时任务序列，共 ${tasks.length} 个任务`,
    tasks: tasks.map(t => t.name),
    timestamp: new Date().toISOString()
  })}\n\n`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[CronSequence] Starting task ${i + 1}/${tasks.length}: ${task.name}...`);

    // Send task start event
    mainRes.write(`event: task_start\ndata: ${JSON.stringify({
      type: 'task_start',
      task: task.name,
      index: i + 1,
      total: tasks.length,
      message: `开始执行任务: ${task.name}`,
      timestamp: new Date().toISOString()
    })}\n\n`);

    try {
      // Create a pass-through response object that forwards SSE events to the main response
      const passThroughRes = {
        write: (chunk) => {
          // Forward all SSE events to the main response
          return mainRes.write(chunk);
        },
        end: () => {
          // Do nothing - let the main response handle ending
          return passThroughRes;
        },
        setHeader: () => {
          // Headers are already set on mainRes
          return passThroughRes;
        },
        status: () => {
          // Status is handled by SSE events
          return passThroughRes;
        },
        json: () => {
          // JSON responses are not used in SSE mode
          return passThroughRes;
        },
        headersSent: false
      };

      // Execute the task handler
      await task.handler(req, passThroughRes);

      // Send task completion event
      mainRes.write(`event: task_complete data: ${JSON.stringify({
        type: 'task_complete',
        task: task.name,
        index: i + 1,
        total: tasks.length,
        message: `任务完成: ${task.name}`,
        timestamp: new Date().toISOString()
      })}\n\n`);

      console.log(`[CronSequence] Finished task ${i + 1}/${tasks.length}: ${task.name}`);

    } catch (err) {
      console.error(`[CronSequence] Error in task ${task.name}:`, err);

      // Send task error event
      mainRes.write(`event: task_error data: ${JSON.stringify({
        type: 'task_error',
        task: task.name,
        index: i + 1,
        total: tasks.length,
        error: err.message,
        message: `任务执行失败: ${task.name}`,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  }

  // Send sequence completion event
  mainRes.write(`event: sequence_complete\ndata: ${JSON.stringify({
    type: 'sequence_complete',
    message: '定时任务序列执行完成',
    totalTasks: tasks.length,
    timestamp: new Date().toISOString()
  })}\n\n`);

  console.log('[CronSequence] Sequence completed successfully.');
  mainRes.end();
}

